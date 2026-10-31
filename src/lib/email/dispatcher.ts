import { adminDb, getAdminDb } from '../adminDb';
import { logEmailEvent, logSystemEvent } from '../logger';
import {
  checkQuota,
  crossedWarning,
  EmailQuotaStore,
  FlushSummary,
  flushHeldEmails,
  isQuotaRejection,
  prismaQuotaStore,
  quotaSettings,
  recipientCount,
} from './daily-limit';
import { getEmailConfig, getResolvedEmailConfig } from './config';
import { sendWithBrevo } from './providers/brevo';
import { sendWithConsole } from './providers/console';
import { sendWithResend } from './providers/resend';
import { sendWithSmtp } from './providers/smtp';
import {
  getAssignmentEmailTemplate,
  getBroadcastEmailTemplate,
  getClearanceConfirmationEmailTemplate,
  getClearanceApprovalEmailTemplate,
  getInvitationEmailTemplate,
  getMissionCancelledEmailTemplate,
  getMissionRepairEmailTemplate,
  getNudgeEmailTemplate,
  getPasswordResetEmailTemplate,
  getWelcomeEmailTemplate,
} from './templates';
import {
  AssignmentEmailParams,
  BroadcastEmailParams,
  ClearanceConfirmationParams,
  ClearanceApprovalParams,
  EmailConfig,
  EmailMessage,
  EmailResult,
  InvitationEmailParams,
  MissionCancelledEmailParams,
  MissionRepairEmailParams,
  NudgeEmailParams,
  PasswordResetEmailParams,
  WelcomeEmailParams,
} from './types';

/**
 * Universal Email Dispatcher with Automatic Exponential Backoff Retry Engine.
 * Dispatches transactional email through Brevo REST API, Direct SMTP (Nodemailer), Resend, or Console mock.
 * Automatically retries transient network, timeout, 429, and 5xx errors up to maxRetries attempts.
 * Brevo sends are kept under the daily quota (src/lib/email/daily-limit.ts): an email that would pass
 * the cap, or that Brevo rejects for quota, is held and sent after midnight Pacific. A held email
 * returns `success: true, held: true`.
 */
export async function sendEmail(
  message: EmailMessage,
  overrideConfig?: Partial<EmailConfig>,
  maxRetries = 3
): Promise<EmailResult> {
  const baseConfig = await getResolvedEmailConfig();
  const config: EmailConfig = { ...baseConfig, ...overrideConfig };

  const store = config.provider === 'brevo' ? quotaStoreFor(config) : null;
  if (!store) return deliverEmail(message, config, maxRetries);

  const settings = quotaSettings(quotaEnv(config));
  const recipients = recipientCount(message);
  let usedBefore: number;
  try {
    const decision = await checkQuota(store, recipients, settings);
    usedBefore = decision.usedBefore;
    if (!decision.send) {
      return holdEmail(store, message, recipients, `Daily limit reached (${decision.usedBefore}/${settings.cap} sent today)`, config);
    }
  } catch (err: unknown) {
    // Fail open: a ledger outage must not stop mail. The cap's reserve absorbs uncounted sends.
    console.warn('[EMAIL:QUOTA] Send ledger unavailable; sending without the daily check:', err instanceof Error ? err.message : err);
    return deliverEmail(message, config, maxRetries);
  }

  const result = await deliverEmail(message, config, maxRetries);
  if (result.success) {
    await store.recordSent(recipients, message.subject).catch((err: unknown) => {
      console.warn('[EMAIL:QUOTA] Could not record the send:', err instanceof Error ? err.message : err);
    });
    if (crossedWarning(usedBefore, recipients, settings)) {
      await logSystemEvent({
        level: 'WARN',
        category: 'EMAIL',
        message: `Daily email quota at ${usedBefore + recipients}/${settings.quota}: emails past ${settings.cap} today are held until midnight Pacific.`,
        metadata: { sentToday: usedBefore + recipients, quota: settings.quota, cap: settings.cap },
        dbClient: config.dbClient,
        env: config.env,
      }).catch(() => {});
    }
    return result;
  }
  if (isQuotaRejection(result.error)) {
    return holdEmail(store, message, recipients, result.error || 'quota rejection', config);
  }
  return result;
}

/**
 * Sends held emails, oldest first, while today's quota allows (Brevo only). Called by the Worker's
 * hourly cron and the self-hosted scheduler. Returns null when no quota applies.
 */
export async function flushHeldEmailQueue(overrideConfig?: Partial<EmailConfig>): Promise<FlushSummary | null> {
  const baseConfig = await getResolvedEmailConfig();
  const config: EmailConfig = { ...baseConfig, ...overrideConfig };
  const store = config.provider === 'brevo' ? quotaStoreFor(config) : null;
  if (!store) return null;

  const summary = await flushHeldEmails(store, (message) => deliverEmail(message, config), quotaSettings(quotaEnv(config)));
  if (summary.sent || summary.failed) {
    await logSystemEvent({
      level: summary.gaveUp ? 'ERROR' : summary.failed ? 'WARN' : 'INFO',
      category: 'EMAIL',
      message: `Held emails: ${summary.sent} sent, ${summary.failed} failed (${summary.gaveUp} given up), ${summary.remaining} still held.`,
      metadata: { ...summary },
      dbClient: config.dbClient,
      env: config.env,
    }).catch(() => {});
  }
  return summary;
}

/** Environment the quota settings read (`EMAIL_DAILY_QUOTA`): the Worker's env or process.env. */
function quotaEnv(config: EmailConfig): Record<string, string | undefined> | undefined {
  return config.env ?? (typeof process !== 'undefined' ? process.env : undefined);
}

/**
 * The send ledger for this runtime: the Worker's admin connection, then a client passed in the
 * config (the Worker's admin client, or a test double), then the Node admin client. Null without a
 * database.
 */
function quotaStoreFor(config: EmailConfig): EmailQuotaStore | null {
  const env = config.env;
  const adminConnStr = env?.DATABASE_ADMIN_URL || env?.DIRECT_URL || env?.DATABASE_URL;
  let client = adminConnStr ? getAdminDb(adminConnStr) : config.dbClient;
  if (!client && typeof process !== 'undefined' && (process.env?.DATABASE_ADMIN_URL || process.env?.DIRECT_URL || process.env?.DATABASE_URL)) {
    client = adminDb;
  }
  return client ? prismaQuotaStore(client) : null;
}

/** Holds an email for the next quota day; if even that fails, the email is reported as failed. */
async function holdEmail(store: EmailQuotaStore, message: EmailMessage, recipients: number, reason: string, config: EmailConfig): Promise<EmailResult> {
  const to = describeRecipients(message);
  try {
    await store.hold(message, recipients, reason);
  } catch (err: unknown) {
    const error = `Not sent and could not be held (${reason}): ${err instanceof Error ? err.message : String(err)}`;
    await logEmailEvent(config.provider, to, message.subject, { success: false, error }, { dbClient: config.dbClient, env: config.env }).catch(() => {});
    return { success: false, provider: config.provider, error, mode: config.provider };
  }
  await logSystemEvent({
    level: 'WARN',
    category: 'EMAIL',
    message: `Email to ${to} held until the daily quota resets: ${reason}`,
    metadata: { recipient: to, subject: message.subject, reason },
    dbClient: config.dbClient,
    env: config.env,
  }).catch(() => {});
  return { success: true, held: true, provider: config.provider, mode: config.provider };
}

/** Recipient list as one string, for logs. */
function describeRecipients(message: EmailMessage): string {
  return Array.isArray(message.to)
    ? message.to.map((t) => (typeof t === 'string' ? t : t.email)).join(', ')
    : typeof message.to === 'string'
    ? message.to
    : message.to.email;
}

/**
 * Sends one message through the configured provider with retries and logs the outcome. No quota
 * check: `sendEmail` and the held-email flush decide that first.
 */
async function deliverEmail(message: EmailMessage, config: EmailConfig, maxRetries = 3): Promise<EmailResult> {
  const targetRecipient = describeRecipients(message);

  let lastResult: EmailResult | null = null;
  const backoffDelays = [500, 1500, 3000];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result: EmailResult;
      switch (config.provider) {
        case 'brevo':
          result = await sendWithBrevo(message, config);
          break;
        case 'smtp':
          result = await sendWithSmtp(message, config);
          break;
        case 'resend':
          result = await sendWithResend(message, config);
          break;
        case 'console':
        default:
          result = await sendWithConsole(message, config);
          break;
      }

      if (result.success) {
        if (attempt > 1) {
          console.log(`[EMAIL:RETRY] Dispatch succeeded on attempt ${attempt}/${maxRetries} via ${result.provider}`);
        }
        await logEmailEvent(
          config.provider,
          targetRecipient,
          message.subject,
          {
            success: true,
            attempts: attempt,
            messageId: result.messageId,
          },
          { dbClient: config.dbClient, env: config.env }
        ).catch(() => {});

        return { ...result, attempts: attempt, mode: result.provider };
      }

      lastResult = result;

      // Fail fast without retrying for permanent client-side errors (400, 401, missing credentials)
      const err = (result.error || '').toLowerCase();
      if (
        err.includes('http 400') ||
        err.includes('http 401') ||
        err.includes('http 403') ||
        err.includes('missing') ||
        err.includes('invalid')
      ) {
        console.warn(`[EMAIL:DISPATCH] Non-retryable client error (${result.error}). Terminating retry loop.`);
        break;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastResult = {
        success: false,
        provider: config.provider,
        error: errorMsg,
      };
    }

    if (attempt < maxRetries) {
      const delay = backoffDelays[attempt - 1] || 1000;
      console.warn(`[EMAIL:RETRY] Dispatch attempt ${attempt}/${maxRetries} failed (${lastResult?.error}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const finalError = lastResult?.error || 'Email dispatch failed after maximum retry attempts';
  await logEmailEvent(
    config.provider,
    targetRecipient,
    message.subject,
    {
      success: false,
      attempts: maxRetries,
      error: finalError,
    },
    { dbClient: config.dbClient, env: config.env }
  ).catch(() => {});

  return {
    success: false,
    provider: config.provider,
    error: finalError,
    attempts: maxRetries,
    mode: config.provider,
  };
}


/**
 * Dispatches an Exchange Recruitment / Invitation Email.
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getInvitationEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail(
    {
      to: params.recipientName
        ? { email: targetEmail, name: params.recipientName }
        : targetEmail,
      subject,
      html,
      text,
      tags: ['invitation', 'recruitment', params.isLatePass ? 'late-pass' : 'standard'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches a Secret Santa Target Assignment Email.
 */
export async function sendAssignmentEmail(params: AssignmentEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getAssignmentEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || params.agentName || 'Operative';
  return sendEmail(
    {
      to: { email: targetEmail, name: recipientName },
      subject,
      html,
      text,
      tags: ['assignment', 'target-draw'],
    },
    params.overrideConfig
  );
}

/**
 * Backwards-compatible alias for sendAssignmentEmail.
 */
export const sendTargetAssignmentEmail = sendAssignmentEmail;

/**
 * Dispatches a Welcome / Operative Onboarding Email.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getWelcomeEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail(
    {
      to: { email: targetEmail, name: params.name },
      subject,
      html,
      text,
      tags: ['welcome', 'onboarding'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches an OpsLeader Team Broadcast Email.
 */
export async function sendBroadcastEmail(params: BroadcastEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getBroadcastEmailTemplate(params);
  return sendEmail(
    {
      to: params.to,
      subject,
      html,
      text,
      tags: ['broadcast', 'opteam'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches an OpsLeader Nudge / Reminder Email.
 */
export async function sendNudgeEmail(params: NudgeEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getNudgeEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || 'Operative';
  return sendEmail(
    {
      to: { email: targetEmail, name: recipientName },
      subject,
      html,
      text,
      tags: ['nudge', 'reminder'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches a Clearance Lead / Pre-Launch Confirmation Email.
 */
export async function sendClearanceConfirmationEmail(params: ClearanceConfirmationParams): Promise<EmailResult> {
  const { subject, html, text } = getClearanceConfirmationEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail(
    {
      to: targetEmail,
      subject,
      html,
      text,
      tags: ['clearance', 'pre-launch-waitlist'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches an Alpha Clearance Approval Email containing the single-use invite cipher.
 */
export async function sendClearanceApprovalEmail(params: ClearanceApprovalParams): Promise<EmailResult> {
  const { subject, html, text } = getClearanceApprovalEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail(
    {
      to: targetEmail,
      subject,
      html,
      text,
      tags: ['clearance-approved', 'pre-launch-approval', 'alpha'],
    },
    params.overrideConfig
  );
}


/**
 * Dispatches a password reset link email.
 */
export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getPasswordResetEmailTemplate(params);
  return sendEmail(
    {
      to: { email: params.to, name: params.name },
      subject,
      html,
      text,
      tags: ['account', 'password-reset'],
    },
    params.overrideConfig
  );
}

/**
 * True when one more email today would be held until midnight Pacific (Brevo only). Lets a caller
 * tell the user before sending; a ledger outage reads as "not reached", matching `sendEmail`.
 */
export async function isDailyEmailQuotaReached(overrideConfig?: Partial<EmailConfig>): Promise<boolean> {
  const baseConfig = await getResolvedEmailConfig();
  const config: EmailConfig = { ...baseConfig, ...overrideConfig };
  const store = config.provider === 'brevo' ? quotaStoreFor(config) : null;
  if (!store) return false;
  try {
    const decision = await checkQuota(store, 1, quotaSettings(quotaEnv(config)));
    return !decision.send;
  } catch {
    return false;
  }
}

/**
 * Dispatches the "mission cancelled" email to one agent.
 */
export async function sendMissionCancelledEmail(params: MissionCancelledEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getMissionCancelledEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || 'Operative';
  return sendEmail(
    {
      to: { email: targetEmail, name: recipientName },
      subject,
      html,
      text,
      tags: ['mission', 'cancelled'],
    },
    params.overrideConfig
  );
}

/**
 * Dispatches the "draw paused" email (Head Elf reminder or agent to-do).
 */
export async function sendMissionRepairEmail(params: MissionRepairEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getMissionRepairEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || 'Operative';
  return sendEmail(
    {
      to: { email: targetEmail, name: recipientName },
      subject,
      html,
      text,
      tags: ['mission', 'repair'],
    },
    params.overrideConfig
  );
}
