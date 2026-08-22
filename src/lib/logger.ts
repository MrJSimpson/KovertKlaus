import { db } from './db';

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export type LogCategory = 'EMAIL' | 'AUTH' | 'DB' | 'SCRAPER' | 'WORKER' | 'OPERATION' | 'ADMIN';

export interface LogEntryOptions {
  level?: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown> | null;
  path?: string;
  method?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  dbClient?: any;
  env?: Record<string, any>;
}

// In-memory burst deduplication cache: key -> { count, timestamp }
const dedupCache = new Map<string, { count: number; lastLogged: number }>();
const DEDUP_WINDOW_MS = 60000; // 60 seconds
let insertCounter = 0;

const SENSITIVE_KEY_REGEX = /password|passwordhash|token|session|secret|apikey|brevoapikey|resendapikey|smtppass|authorization|cookie|x-admin-token|x-user-token/i;

/**
 * Deep security sanitizer that recursively redacts sensitive credentials, tokens,
 * passwords, and session headers from metadata objects before logging.
 */
export function sanitizeLogMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH_EXCEEDED]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Truncate excessively long individual string values
    if (obj.length > 1000) {
      return obj.slice(0, 1000) + '... [TRUNCATED]';
    }
    return obj;
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 25).map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = sanitizeLogMetadata(value, depth + 1);
    }
  }
  return cleaned;
}

/**
 * Bounding utility to guarantee that metadata JSON payloads never exceed 2,048 bytes.
 */
function boundMetadataPayload(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  try {
    const sanitized = sanitizeLogMetadata(metadata);
    const jsonStr = JSON.stringify(sanitized);
    if (jsonStr.length <= 2048) {
      return sanitized as Record<string, unknown>;
    }
    // Truncate payload safely
    return {
      _truncated: true,
      _originalSize: jsonStr.length,
      payload: jsonStr.slice(0, 1800) + '... [TRUNCATED_TO_2KB_LIMIT]',
    };
  } catch {
    return { _error: 'Failed to serialize log metadata' };
  }
}

/**
 * Appends formatted log entry to local centralized project log directory when in Node.js runtime.
 */
function writeToFileLog(entry: {
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown> | null;
  path?: string;
  statusCode?: number;
}) {
  try {
    if (typeof process !== 'undefined' && process.versions?.node && !process.env.DISABLE_FILE_LOGGING) {
      // Dynamic import to remain safe in Cloudflare Worker edge runtimes
      import('fs').then((fs) => {
        import('path').then((path) => {
          import('os').then((os) => {
            const logDir = path.join(os.homedir(), 'projects', 'logs', 'kovertklaus');
            if (!fs.existsSync(logDir)) {
              fs.mkdirSync(logDir, { recursive: true });
            }
            const logLine = `[${new Date().toISOString()}] [${entry.level}] [${entry.category}] ${entry.message} ${
              entry.path ? `(${entry.path} -> ${entry.statusCode || 200})` : ''
            } ${entry.metadata ? JSON.stringify(entry.metadata) : ''}\n`;

            fs.appendFileSync(path.join(logDir, 'kovertklaus.log'), logLine, 'utf-8');
            if (entry.level === 'ERROR') {
              fs.appendFileSync(path.join(logDir, 'error.log'), logLine, 'utf-8');
            }
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    }
  } catch {
    // Ignore file logging errors in serverless/edge environments
  }
}

/**
 * Core log ingestion engine.
 * Enforces production level filtering (WARN/ERROR only to PostgreSQL), metadata size bounding (max 2KB),
 * secret sanitization, deduplication, and non-blocking asynchronous database writes.
 */
export async function logSystemEvent(options: LogEntryOptions): Promise<void> {
  const level: LogLevel = options.level || 'INFO';
  const category: LogCategory = options.category;
  const message = (options.message || '').slice(0, 1000); // Cap message length to 1,000 chars
  const boundedMeta = boundMetadataPayload(options.metadata);

  // 1. Output to local console in development
  const consolePrefix = `[${level}] [${category}]`;
  if (level === 'ERROR') {
    console.error(`${consolePrefix} ${message}`, boundedMeta || '');
  } else if (level === 'WARN') {
    console.warn(`${consolePrefix} ${message}`, boundedMeta || '');
  } else {
    console.log(`${consolePrefix} ${message}`);
  }

  // 2. Append to local file log in Node.js
  writeToFileLog({
    level,
    category,
    message,
    metadata: boundedMeta,
    path: options.path,
    statusCode: options.statusCode,
  });

  // 3. Level Filtering: In production, do NOT write INFO/DEBUG logs to PostgreSQL (avoids table bloat)
  const isProd =
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ||
    (options.env && options.env.MODE === 'production');

  if (isProd && (level === 'INFO' || level === 'DEBUG')) {
    return;
  }

  // 4. Consecutive Burst Deduplication: Throttles identical error storms
  const dedupKey = `${level}:${category}:${message.slice(0, 120)}`;
  const now = Date.now();
  const cached = dedupCache.get(dedupKey);

  if (cached && now - cached.lastLogged < DEDUP_WINDOW_MS) {
    cached.count++;
    if (cached.count > 3) {
      // Suppress repeated duplicate writes within window
      return;
    }
  } else {
    dedupCache.set(dedupKey, { count: 1, lastLogged: now });
  }

  // 5. Asynchronous Non-Blocking Database Persistence
  try {
    let client = options.dbClient;
    if (!client && typeof process !== 'undefined' && process.env?.DATABASE_URL) {
      client = db;
    }

    if (client && typeof client.systemLog?.create === 'function') {
      // Execute asynchronously without awaiting so client response is never delayed
      client.systemLog
        .create({
          data: {
            level,
            category,
            message,
            metadata: boundedMeta as any,
            path: options.path ? options.path.slice(0, 255) : null,
            method: options.method ? options.method.slice(0, 10) : null,
            statusCode: options.statusCode || null,
            ip: options.ip ? options.ip.slice(0, 64) : null,
            userAgent: options.userAgent ? options.userAgent.slice(0, 255) : null,
          },
        })
        .then(() => {
          insertCounter++;
          // Circular Buffer: Periodically prune oldest records if table exceeds 5,000 rows
          if (insertCounter % 50 === 0 && typeof client.systemLog?.count === 'function') {
            client.systemLog.count().then((count: number) => {
              if (count > 5000) {
                client.systemLog
                  .findMany({
                    select: { id: true },
                    orderBy: { createdAt: 'asc' },
                    take: 500,
                  })
                  .then((oldRecords: { id: string }[]) => {
                    const idsToDelete = oldRecords.map((r: { id: string }) => r.id);
                    client.systemLog.deleteMany({
                      where: { id: { in: idsToDelete } },
                    }).catch(() => {});
                  })
                  .catch(() => {});
              }
            }).catch(() => {});
          }
        })
        .catch((dbErr: any) => {
          console.warn('[SystemLog Ingestion Failed]', dbErr?.message || dbErr);
        });
    }
  } catch (err: any) {
    console.warn('[Logger Dispatch Exception]', err?.message || err);
  }
}

/**
 * Helper to record an ERROR level system event.
 */
export function logError(
  category: LogCategory,
  message: string,
  options?: Partial<LogEntryOptions>
): Promise<void> {
  return logSystemEvent({
    level: 'ERROR',
    category,
    message,
    ...options,
  });
}

/**
 * Helper to record a WARN level system event.
 */
export function logWarn(
  category: LogCategory,
  message: string,
  options?: Partial<LogEntryOptions>
): Promise<void> {
  return logSystemEvent({
    level: 'WARN',
    category,
    message,
    ...options,
  });
}

/**
 * Helper to record an INFO level system event.
 */
export function logInfo(
  category: LogCategory,
  message: string,
  options?: Partial<LogEntryOptions>
): Promise<void> {
  return logSystemEvent({
    level: 'INFO',
    category,
    message,
    ...options,
  });
}

/**
 * Helper for logging transactional email dispatch outcomes and retries.
 */
export function logEmailEvent(
  provider: string,
  recipient: string,
  subject: string,
  result: { success: boolean; error?: string; attempts?: number; messageId?: string },
  options?: Partial<LogEntryOptions>
): Promise<void> {
  const level: LogLevel = result.success ? (result.attempts && result.attempts > 1 ? 'WARN' : 'INFO') : 'ERROR';
  const message = result.success
    ? `Email dispatched to ${recipient} via ${provider} (Attempts: ${result.attempts || 1})`
    : `Email failed to ${recipient} via ${provider}: ${result.error || 'Unknown error'}`;

  return logSystemEvent({
    level,
    category: 'EMAIL',
    message,
    metadata: {
      provider,
      recipient,
      subject,
      success: result.success,
      attempts: result.attempts || 1,
      messageId: result.messageId,
      error: result.error,
    },
    ...options,
  });
}

/**
 * Helper for logging scraper SSRF defenses, protocol blocks, or network timeouts.
 */
export function logScraperEvent(
  url: string,
  action: 'BLOCKED_SSRF' | 'TIMEOUT' | 'SCRAPE_SUCCESS' | 'SCRAPE_FAILURE',
  details?: Record<string, unknown>,
  options?: Partial<LogEntryOptions>
): Promise<void> {
  const level: LogLevel = action === 'BLOCKED_SSRF' || action === 'TIMEOUT' || action === 'SCRAPE_FAILURE' ? 'WARN' : 'INFO';
  const message = `Product Scraper [${action}]: ${url.slice(0, 150)}`;

  return logSystemEvent({
    level,
    category: 'SCRAPER',
    message,
    metadata: { url, action, ...details },
    ...options,
  });
}
