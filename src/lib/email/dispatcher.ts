import { logEmailEvent } from '../logger';
import { getEmailConfig, getResolvedEmailConfig } from './config';
import { sendWithBrevo } from './providers/brevo';
import { sendWithConsole } from './providers/console';
import { sendWithResend } from './providers/resend';
import { sendWithSmtp } from './providers/smtp';
import {
  getAssignmentEmailTemplate,
  getBroadcastEmailTemplate,
  getClearanceConfirmationEmailTemplate,
  getInvitationEmailTemplate,
  getNudgeEmailTemplate,
  getWelcomeEmailTemplate,
} from './templates';
import {
  AssignmentEmailParams,
  BroadcastEmailParams,
  ClearanceConfirmationParams,
  EmailConfig,
  EmailMessage,
  EmailResult,
  InvitationEmailParams,
  NudgeEmailParams,
  WelcomeEmailParams,
} from './types';

/**
 * Universal Email Dispatcher with Automatic Exponential Backoff Retry Engine.
 * Dispatches transactional email through Brevo REST API, Direct SMTP (Nodemailer), Resend, or Console mock.
 * Automatically retries transient network, timeout, 429, and 5xx errors up to maxRetries attempts.
 */
export async function sendEmail(
  message: EmailMessage,
  overrideConfig?: Partial<EmailConfig>,
  maxRetries = 3
): Promise<EmailResult> {
  const baseConfig = await getResolvedEmailConfig();
  const config: EmailConfig = { ...baseConfig, ...overrideConfig };

  const targetRecipient = Array.isArray(message.to)
    ? message.to.map((t) => (typeof t === 'string' ? t : t.email)).join(', ')
    : typeof message.to === 'string'
    ? message.to
    : message.to.email;

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

