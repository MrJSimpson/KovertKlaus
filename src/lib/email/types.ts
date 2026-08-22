export type EmailProviderType = 'auto' | 'brevo' | 'smtp' | 'resend' | 'console';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: string | EmailAddress | (string | EmailAddress)[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  tags?: string[];
}

export interface EmailResult {
  success: boolean;
  provider: EmailProviderType;
  mode?: EmailProviderType;
  messageId?: string;
  error?: string;
  attempts?: number;
}

export interface EmailConfig {
  provider: EmailProviderType;
  // Brevo API settings
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  brevoSenderName?: string;
  // Direct SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFrom?: string;
  // Resend API settings
  resendApiKey?: string;
  // Global defaults
  defaultFromEmail: string;
  defaultFromName: string;
  // Edge runtime context & DB persistence bindings
  dbClient?: any;
  env?: Record<string, any>;
}


export interface InvitationEmailParams {
  recipientEmail?: string;
  to?: string;
  recipientName?: string;
  organizerName: string;
  exchangeTitle: string;
  inviteCode: string;
  joinUrl: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isLatePass?: boolean;
  overrideConfig?: Partial<EmailConfig>;
}

export interface AssignmentEmailParams {
  recipientEmail?: string;
  to?: string;
  recipientName?: string;
  agentName?: string;
  targetCodename?: string;
  targetName?: string;
  exchangeTitle: string;
  exchangeUrl: string;
  shippingDeadline?: string;
  exchangeDate?: string;
  overrideConfig?: Partial<EmailConfig>;
}

export interface NudgeEmailParams {
  recipientEmail?: string;
  to?: string;
  recipientName?: string;
  organizerName: string;
  exchangeTitle: string;
  message: string;
  actionUrl: string;
  overrideConfig?: Partial<EmailConfig>;
}

export interface WelcomeEmailParams {
  recipientEmail?: string;
  to?: string;
  name: string;
  codename?: string;
  overrideConfig?: Partial<EmailConfig>;
}

export interface BroadcastEmailParams {
  to: string | string[];
  exchangeTitle: string;
  subject: string;
  message: string;
  senderName: string;
  exchangeUrl: string;
  overrideConfig?: Partial<EmailConfig>;
}

export interface ClearanceConfirmationParams {
  recipientEmail?: string;
  to?: string;
  name?: string;
  positionNumber?: number;
  overrideConfig?: Partial<EmailConfig>;
}

