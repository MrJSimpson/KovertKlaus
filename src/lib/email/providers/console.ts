import { EmailConfig, EmailMessage, EmailResult } from '../types';

/**
 * Console Mock Provider for Local Development & Testing.
 * Prints structured email payload directly to terminal logs when no live email service is configured.
 */
export async function sendWithConsole(message: EmailMessage, config: EmailConfig): Promise<EmailResult> {
  const fromEmail = message.from || config.defaultFromEmail;
  const fromName = message.fromName || config.defaultFromName;
  const formattedFrom = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const rawTo = Array.isArray(message.to) ? message.to : [message.to];
  const toSummary = rawTo
    .map((t) => (typeof t === 'string' ? t : t.name ? `${t.name} (${t.email})` : t.email))
    .join(', ');

  const fakeMessageId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  console.log('\n======================================================');
  console.log('📨 [EMAIL:CONSOLE MOCK DISPATCH]');
  console.log(`From:    ${formattedFrom}`);
  console.log(`To:      ${toSummary}`);
  console.log(`Subject: ${message.subject}`);
  if (message.replyTo) {
    console.log(`Reply-To: ${message.replyTo}`);
  }
  console.log('------------------------------------------------------');
  if (message.text) {
    console.log(message.text);
  } else {
    // Basic text summary from HTML
    const preview = message.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    console.log(preview.substring(0, 300) + (preview.length > 300 ? '...' : ''));
  }
  console.log('======================================================\n');

  return {
    success: true,
    provider: 'console',
    messageId: fakeMessageId,
  };
}
