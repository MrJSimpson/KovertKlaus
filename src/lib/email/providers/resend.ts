import { EmailConfig, EmailMessage, EmailResult } from '../types';

/**
 * Resend Transactional Email Provider (REST API fallback).
 * Uses standard fetch — zero external dependencies.
 */
export async function sendWithResend(message: EmailMessage, config: EmailConfig): Promise<EmailResult> {
  const apiKey = config.resendApiKey;
  if (!apiKey) {
    return {
      success: false,
      provider: 'resend',
      error: 'RESEND_API_KEY is not configured in the environment.',
    };
  }

  const rawTo = Array.isArray(message.to) ? message.to : [message.to];
  const toList = rawTo.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : t.email.trim().toLowerCase()));

  const senderEmail = message.from?.trim() || config.defaultFromEmail;
  const senderName = message.fromName?.trim() || config.defaultFromName;
  const formattedFrom = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formattedFrom,
        to: toList,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });

    const data = await response.json().catch(() => null) as { id?: string; message?: string } | null;

    if (!response.ok) {
      const errorMsg = data?.message || `Resend API HTTP ${response.status}: ${response.statusText}`;
      console.error('[EMAIL:RESEND] Dispatch failed:', errorMsg);
      return {
        success: false,
        provider: 'resend',
        error: errorMsg,
      };
    }

    return {
      success: true,
      provider: 'resend',
      messageId: data?.id,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[EMAIL:RESEND] Network error:', errorMsg);
    return {
      success: false,
      provider: 'resend',
      error: errorMsg,
    };
  }
}
