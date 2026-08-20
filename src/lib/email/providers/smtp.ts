import { EmailConfig, EmailMessage, EmailResult } from '../types';

/**
 * Direct SMTP Provider for Self-Hosted Home Users & Docker Deployments.
 * Uses dynamic import of 'nodemailer' to prevent bundling overhead or edge runtime failures.
 */
export async function sendWithSmtp(message: EmailMessage, config: EmailConfig): Promise<EmailResult> {
  const host = config.smtpHost;
  if (!host) {
    return {
      success: false,
      provider: 'smtp',
      error: 'SMTP_HOST is not configured in the environment.',
    };
  }

  let nodemailer: typeof import('nodemailer');
  try {
    // Dynamic import to keep edge runtimes and static builds 100% clean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodemailer = (await import('nodemailer')) as any;
  } catch {
    const errorMsg = "Direct SMTP requires 'nodemailer' package. Install it via 'npm install nodemailer @types/nodemailer' or use BREVO_API_KEY for dependency-free API email.";
    console.error('[EMAIL:SMTP]', errorMsg);
    return {
      success: false,
      provider: 'smtp',
      error: errorMsg,
    };
  }

  try {
    const transportOptions: Record<string, unknown> = {
      host,
      port: config.smtpPort || 587,
      secure: config.smtpSecure ?? (config.smtpPort === 465),
    };

    if (config.smtpUser && config.smtpPass) {
      transportOptions.auth = {
        user: config.smtpUser,
        pass: config.smtpPass,
      };
    }

    const transporter = nodemailer.createTransport(transportOptions as Parameters<typeof nodemailer.createTransport>[0]);

    const fromAddress = message.from || config.smtpFrom || config.defaultFromEmail;
    const fromName = message.fromName || config.defaultFromName;
    const formattedFrom = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

    const rawTo = Array.isArray(message.to) ? message.to : [message.to];
    const formattedTo = rawTo
      .map((t) => (typeof t === 'string' ? t : t.name ? `"${t.name}" <${t.email}>` : t.email))
      .join(', ');

    // Send mail via transporter
    const info = await transporter.sendMail({
      from: formattedFrom,
      to: formattedTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });

    return {
      success: true,
      provider: 'smtp',
      messageId: (info as { messageId?: string })?.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[EMAIL:SMTP] Dispatch failed:', errorMsg);
    return {
      success: false,
      provider: 'smtp',
      error: errorMsg,
    };
  }
}
