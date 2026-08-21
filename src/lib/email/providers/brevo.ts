import { EmailAddress, EmailConfig, EmailMessage, EmailResult } from '../types';

/**
 * Brevo (formerly Sendinblue) Transactional Email Provider
 * Uses pure REST API over standard fetch — zero dependencies, 100% edge and Cloudflare Worker compatible.
 */
export async function sendWithBrevo(message: EmailMessage, config: EmailConfig): Promise<EmailResult> {
  const apiKey = config.brevoApiKey;
  if (!apiKey) {
    return {
      success: false,
      provider: 'brevo',
      error: 'Brevo API Key is missing. Please configure your Brevo API key.',
    };
  }

  // Normalize 'to' recipients array
  const rawTo = Array.isArray(message.to) ? message.to : [message.to];
  const toList: EmailAddress[] = rawTo.map((recipient) => {
    if (typeof recipient === 'string') {
      return { email: recipient.trim().toLowerCase() };
    }
    return {
      email: recipient.email.trim().toLowerCase(),
      name: recipient.name?.trim(),
    };
  });

  const senderEmail = (message.from || config.brevoSenderEmail || config.defaultFromEmail || '').trim();
  if (!senderEmail) {
    return {
      success: false,
      provider: 'brevo',
      error: 'Sender email is missing or empty. A valid Sender Email is required for Brevo dispatch.',
    };
  }

  const senderName = (message.fromName || config.brevoSenderName || config.defaultFromName || '').trim();
  if (!senderName) {
    return {
      success: false,
      provider: 'brevo',
      error: 'Sender name is missing or empty. A valid Sender Name is required for Brevo dispatch.',
    };
  }

  const payload: Record<string, unknown> = {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: toList,
    subject: message.subject,
    htmlContent: message.html,
  };

  if (message.text) {
    payload.textContent = message.text;
  }

  if (message.replyTo) {
    payload.replyTo = { email: message.replyTo.trim() };
  }

  if (message.tags && message.tags.length > 0) {
    payload.tags = message.tags;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null) as { messageId?: string; message?: string; code?: string } | null;

    if (!response.ok) {
      const errorMsg = data?.message || `Brevo API HTTP ${response.status}: ${response.statusText}`;
      console.error('[EMAIL:BREVO] Dispatch failed:', errorMsg);
      return {
        success: false,
        provider: 'brevo',
        error: errorMsg,
      };
    }

    return {
      success: true,
      provider: 'brevo',
      messageId: data?.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[EMAIL:BREVO] Network or execution error:', errorMsg);
    return {
      success: false,
      provider: 'brevo',
      error: errorMsg,
    };
  }
}
