import { EmailConfig, EmailProviderType } from './types';

/**
 * Loads and normalizes email dispatch configuration from process.env.
 * Automatically resolves the active provider based on explicit overrides or detected API keys / SMTP host settings.
 */
export function getEmailConfig(): EmailConfig {
  const explicitProvider = (process.env.EMAIL_PROVIDER?.toLowerCase().trim() || 'auto') as EmailProviderType;
  
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.EMAIL_FROM?.trim() || 'admin@kovertklaus.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME?.trim() || process.env.EMAIL_FROM_NAME?.trim() || 'KovertKlaus HQ';

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
  const smtpFrom = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || 'admin@kovertklaus.com';

  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  const defaultFromEmail = process.env.EMAIL_FROM?.trim() || brevoSenderEmail || smtpFrom || 'admin@kovertklaus.com';
  const defaultFromName = process.env.EMAIL_FROM_NAME?.trim() || brevoSenderName || 'KovertKlaus HQ';

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
