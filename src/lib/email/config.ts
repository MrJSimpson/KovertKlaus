import { EmailConfig, EmailProviderType } from './types';
import { db } from '@/lib/db';

/**
 * Loads and normalizes email dispatch configuration.
 * Prioritizes database SystemConfig values (managed via /northpole), falling back to process.env.
 */
export function getEmailConfig(dbOverride?: {
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
}): EmailConfig {
  const explicitProvider = (
    dbOverride?.emailProvider ||
    process.env.EMAIL_PROVIDER ||
    'auto'
  ).toLowerCase().trim() as EmailProviderType;

  const brevoApiKey = (dbOverride?.brevoApiKey?.trim() || process.env.BREVO_API_KEY?.trim()) || undefined;
  const brevoSenderEmail =
    (dbOverride?.brevoSenderEmail?.trim() ||
      process.env.BREVO_SENDER_EMAIL?.trim() ||
      dbOverride?.emailFrom?.trim() ||
      process.env.EMAIL_FROM?.trim()) ||
    'admin@kovertklaus.com';
  const brevoSenderName =
    (dbOverride?.brevoSenderName?.trim() ||
      process.env.BREVO_SENDER_NAME?.trim() ||
      dbOverride?.emailFromName?.trim() ||
      process.env.EMAIL_FROM_NAME?.trim()) ||
    'KovertKlaus HQ';

  const smtpHost = (dbOverride?.smtpHost?.trim() || process.env.SMTP_HOST?.trim()) || undefined;
  const smtpPort =
    dbOverride?.smtpPort !== undefined && dbOverride?.smtpPort !== null
      ? dbOverride.smtpPort
      : process.env.SMTP_PORT
      ? parseInt(process.env.SMTP_PORT, 10)
      : 587;
  const smtpUser = (dbOverride?.smtpUser?.trim() || process.env.SMTP_USER?.trim()) || undefined;
  const smtpPass = (dbOverride?.smtpPass?.trim() || process.env.SMTP_PASS?.trim()) || undefined;
  const smtpSecure =
    dbOverride?.smtpSecure !== undefined && dbOverride?.smtpSecure !== null
      ? Boolean(dbOverride.smtpSecure)
      : process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : smtpPort === 465;
  const smtpFrom =
    (dbOverride?.smtpFrom?.trim() ||
      process.env.SMTP_FROM?.trim() ||
      dbOverride?.emailFrom?.trim() ||
      process.env.EMAIL_FROM?.trim()) ||
    'admin@kovertklaus.com';

  const resendApiKey = (dbOverride?.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim()) || undefined;

  const defaultFromEmail =
    (dbOverride?.emailFrom?.trim() || process.env.EMAIL_FROM?.trim()) ||
    brevoSenderEmail ||
    smtpFrom ||
    'admin@kovertklaus.com';
  const defaultFromName =
    (dbOverride?.emailFromName?.trim() || process.env.EMAIL_FROM_NAME?.trim()) ||
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
export async function getResolvedEmailConfig(): Promise<EmailConfig> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { id: 'singleton' },
    });
    if (config) {
      return getEmailConfig({
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
      });
    }
  } catch (error) {
    // Database query failed (or offline during static build), fallback to process.env
  }
  return getEmailConfig();
}
