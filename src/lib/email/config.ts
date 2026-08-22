import { EmailConfig, EmailProviderType } from './types';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';

/**
 * Loads and normalizes email dispatch configuration.
 * Prioritizes database SystemConfig values (managed via /northpole), falling back to process.env.
 */
export function getEmailConfig(
  dbOverride?: {
    emailProvider?: string | null;
    emailFrom?: string | null;
    emailFromName?: string | null;
    brevoApiKey?: string | null;
    brevoSenderEmail?: string | null;
    brevoSenderName?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUser?: string | null;
    smtpPass?: string | null;
    smtpSecure?: boolean | null;
    smtpFrom?: string | null;
    resendApiKey?: string | null;
  },
  envOverride?: Record<string, string | undefined>
): EmailConfig {
  const env: Record<string, string | undefined> =
    envOverride || (typeof process !== 'undefined' && process.env ? process.env : {});

  const explicitProvider = (
    dbOverride?.emailProvider ||
    env.EMAIL_PROVIDER ||
    'auto'
  ).toLowerCase().trim() as EmailProviderType;

  const brevoApiKey = (dbOverride?.brevoApiKey?.trim() || env.BREVO_API_KEY?.trim()) || undefined;
  const brevoSenderEmail =
    (dbOverride?.brevoSenderEmail?.trim() ||
      env.BREVO_SENDER_EMAIL?.trim() ||
      dbOverride?.emailFrom?.trim() ||
      env.EMAIL_FROM?.trim()) ||
    'admin@kovertklaus.com';
  const brevoSenderName =
    (dbOverride?.brevoSenderName?.trim() ||
      env.BREVO_SENDER_NAME?.trim() ||
      dbOverride?.emailFromName?.trim() ||
      env.EMAIL_FROM_NAME?.trim()) ||
    'KovertKlaus HQ';

  const smtpHost = (dbOverride?.smtpHost?.trim() || env.SMTP_HOST?.trim()) || undefined;
  const smtpPort =
    dbOverride?.smtpPort !== undefined && dbOverride?.smtpPort !== null
      ? dbOverride.smtpPort
      : env.SMTP_PORT
      ? parseInt(env.SMTP_PORT, 10)
      : 587;
  const smtpUser = (dbOverride?.smtpUser?.trim() || env.SMTP_USER?.trim()) || undefined;
  const smtpPass = (dbOverride?.smtpPass?.trim() || env.SMTP_PASS?.trim()) || undefined;
  const smtpSecure =
    dbOverride?.smtpSecure !== undefined && dbOverride?.smtpSecure !== null
      ? Boolean(dbOverride.smtpSecure)
      : env.SMTP_SECURE
      ? env.SMTP_SECURE === 'true'
      : smtpPort === 465;
  const smtpFrom =
    (dbOverride?.smtpFrom?.trim() ||
      env.SMTP_FROM?.trim() ||
      dbOverride?.emailFrom?.trim() ||
      env.EMAIL_FROM?.trim()) ||
    'admin@kovertklaus.com';

  const resendApiKey = (dbOverride?.resendApiKey?.trim() || env.RESEND_API_KEY?.trim()) || undefined;

  const defaultFromEmail =
    (dbOverride?.emailFrom?.trim() || env.EMAIL_FROM?.trim()) ||
    brevoSenderEmail ||
    smtpFrom ||
    'admin@kovertklaus.com';
  const defaultFromName =
    (dbOverride?.emailFromName?.trim() || env.EMAIL_FROM_NAME?.trim()) ||
    brevoSenderName ||
    'KovertKlaus HQ';

  // Determine active provider if set to 'auto'
  let activeProvider: EmailProviderType = explicitProvider;
  if (activeProvider === 'auto') {
    if (brevoApiKey) {
      activeProvider = 'brevo';
    } else if (smtpHost) {
      activeProvider = 'smtp';
    } else if (resendApiKey) {
      activeProvider = 'resend';
    } else {
      activeProvider = 'console';
    }
  }

  return {
    provider: activeProvider,
    brevoApiKey,
    brevoSenderEmail,
    brevoSenderName,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    smtpFrom,
    resendApiKey,
    defaultFromEmail,
    defaultFromName,
  };
}

/**
 * Resolves EmailConfig asynchronously by querying SystemConfig from the database first.
 */
export async function getResolvedEmailConfig(
  dbClient?: any,
  envOverride?: Record<string, string | undefined>
): Promise<EmailConfig> {
  const env = envOverride || (typeof process !== 'undefined' && process.env ? process.env : {});
  try {
    let client = dbClient;
    if (!client && typeof process !== 'undefined' && (process.env?.DATABASE_ADMIN_URL || process.env?.DIRECT_URL || process.env?.DATABASE_URL)) {
      client = adminDb || db;
    }

    if (client && typeof client.systemConfig?.findUnique === 'function') {
      const config = await client.systemConfig.findUnique({
        where: { id: 'singleton' },
      });
      if (config) {
        return getEmailConfig(
          {
            emailProvider: config.emailProvider,
            emailFrom: config.emailFrom,
            emailFromName: config.emailFromName,
            brevoApiKey: config.brevoApiKey,
            brevoSenderEmail: config.brevoSenderEmail,
            brevoSenderName: config.brevoSenderName,
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort,
            smtpUser: config.smtpUser,
            smtpPass: config.smtpPass,
            smtpSecure: config.smtpSecure,
            smtpFrom: config.smtpFrom,
            resendApiKey: config.resendApiKey,
          },
          env
        );
      }
    }
  } catch (error) {
    // Database query failed (or offline during static build), fallback to env
  }
  return getEmailConfig(undefined, env);
}

