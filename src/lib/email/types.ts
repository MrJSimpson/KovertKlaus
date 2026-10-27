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
  /** True when the email was held over the daily quota; it is sent after midnight Pacific. */
  held?: boolean;
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
  /** True when the recipient already has an account: the button opens the mission to accept. */
  isExistingUser?: boolean;
  kdmToken?: string;
  isCovertDelivery?: boolean;
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

export interface ClearanceApprovalParams {
  recipientEmail?: string;
  to?: string;
  name?: string;
  inviteCode: string;
  registrationUrl?: string;
  overrideConfig?: Partial<EmailConfig>;
}


export interface MissionCancelledEmailParams {
  recipientEmail?: string;
  to?: string;
  recipientName?: string;
  exchangeTitle: string;
  /** Who cancelled, as shown to agents: "the Head Elf", "a KovertKlaus admin" or "KovertKlaus". */
  cancelledByLabel: string;
  reason?: string;
  /** Line meant only for this recipient (e.g. which issue of theirs blocked the draw). */
  personalNote?: string;
  /** Extra line for the Head Elf (when the mission will be deleted). */
  headElfNote?: string;
  actionUrl: string;
  overrideConfig?: Partial<EmailConfig>;
}

export interface MissionRepairEmailParams {
  recipientEmail?: string;
  to?: string;
  recipientName?: string;
  exchangeTitle: string;
  /** What blocks the draw (Head Elf) or what this agent must do. */
  lines: string[];
  /** Day the mission is cancelled if still blocked. */
  deadlineText: string;
  isHeadElf: boolean;
  actionUrl: string;
  overrideConfig?: Partial<EmailConfig>;
}
