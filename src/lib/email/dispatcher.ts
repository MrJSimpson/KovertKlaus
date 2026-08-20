import { getEmailConfig } from './config';
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
 * Universal Email Dispatcher
 * Dispatches transactional email through Brevo REST API, Direct SMTP (Nodemailer), Resend, or Console mock.
 */
export async function sendEmail(
  message: EmailMessage,
  overrideConfig?: Partial<EmailConfig>
): Promise<EmailResult> {
  const baseConfig = getEmailConfig();
  const config: EmailConfig = { ...baseConfig, ...overrideConfig };

  switch (config.provider) {
    case 'brevo':
      return sendWithBrevo(message, config);

    case 'smtp':
      return sendWithSmtp(message, config);

    case 'resend':
      return sendWithResend(message, config);

    case 'console':
    default:
      return sendWithConsole(message, config);
  }
}

/**
 * Dispatches an Exchange Recruitment / Invitation Email.
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getInvitationEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail({
    to: params.recipientName
      ? { email: targetEmail, name: params.recipientName }
      : targetEmail,
    subject,
    html,
    text,
    tags: ['invitation', 'recruitment', params.isLatePass ? 'late-pass' : 'standard'],
  });
}

/**
 * Dispatches a Secret Santa Target Assignment Email.
 */
export async function sendAssignmentEmail(params: AssignmentEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getAssignmentEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || params.agentName || 'Operative';
  return sendEmail({
    to: { email: targetEmail, name: recipientName },
    subject,
    html,
    text,
    tags: ['assignment', 'target-draw'],
  });
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
  return sendEmail({
    to: { email: targetEmail, name: params.name },
    subject,
    html,
    text,
    tags: ['welcome', 'onboarding'],
  });
}

/**
 * Dispatches an OpsLeader Team Broadcast Email.
 */
export async function sendBroadcastEmail(params: BroadcastEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getBroadcastEmailTemplate(params);
  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    tags: ['broadcast', 'opteam'],
  });
}

/**
 * Dispatches an OpsLeader Nudge / Reminder Email.
 */
export async function sendNudgeEmail(params: NudgeEmailParams): Promise<EmailResult> {
  const { subject, html, text } = getNudgeEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  const recipientName = params.recipientName || 'Operative';
  return sendEmail({
    to: { email: targetEmail, name: recipientName },
    subject,
    html,
    text,
    tags: ['nudge', 'reminder'],
  });
}

/**
 * Dispatches a Clearance Lead / Pre-Launch Confirmation Email.
 */
export async function sendClearanceConfirmationEmail(params: ClearanceConfirmationParams): Promise<EmailResult> {
  const { subject, html, text } = getClearanceConfirmationEmailTemplate(params);
  const targetEmail = params.recipientEmail || params.to || '';
  return sendEmail({
    to: targetEmail,
    subject,
    html,
    text,
    tags: ['clearance', 'pre-launch-waitlist'],
  });
}
