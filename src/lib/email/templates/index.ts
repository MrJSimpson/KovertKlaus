import {
  AssignmentEmailParams,
  BroadcastEmailParams,
  ClearanceConfirmationParams,
  ClearanceApprovalParams,
  InvitationEmailParams,
  NudgeEmailParams,
  WelcomeEmailParams,
} from '../types';

/**
 * Utility to strip HTML tags for plain-text email fallback.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Email palette: the light, classic Christmas theme, always.
 *
 * Emails never follow a viewer's theme preference. Mail clients cannot read the in-app toggle,
 * and a fixed light palette renders the same in every client. Values match the light `kk-*`
 * tokens in `src/app/globals.css`; every text color meets WCAG AA on the surface it sits on.
 */
export const EMAIL_PALETTE = {
  page: '#f0f0f0',
  surface: '#ffffff',
  panel: '#f8f3ec',
  border: '#e0d2c5',
  ink: '#1c2618',
  muted: '#535233',
  pine: '#34502b',
  holly: '#a70006',
  cranberry: '#941f1f',
  gold: '#bca875',
  goldInk: '#6e5c2e',
  candleGold: '#f0d890',
  parchment: '#eee0b7',
  dangerSoft: '#f9e3e3',
} as const;

/**
 * Responsive, highly-compatible HTML email container in the light KovertKlaus palette
 * (`EMAIL_PALETTE`). `color-scheme: light only` asks clients not to recolor it for dark mode.
 */
export function renderBaseEmail({
  title,
  preheader,
  bodyHtml,
  actionText,
  actionUrl,
  footerNote,
}: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  actionText?: string;
  actionUrl?: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    body { margin: 0; padding: 0; background-color: ${EMAIL_PALETTE.page}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${EMAIL_PALETTE.ink}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; table-layout: fixed; background-color: ${EMAIL_PALETTE.page}; padding: 24px 0 40px 0; }
    .main { background-color: ${EMAIL_PALETTE.surface}; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border: 1px solid ${EMAIL_PALETTE.border}; border-radius: 12px; overflow: hidden; }
    .header-cell { background-color: ${EMAIL_PALETTE.pine}; padding: 32px 24px; text-align: center; border-bottom: 4px solid ${EMAIL_PALETTE.holly}; }
    .brand-title { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: ${EMAIL_PALETTE.candleGold}; margin: 0 0 6px 0; text-transform: uppercase; }
    .brand-subtitle { font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #ffffff; margin: 0; text-transform: uppercase; }
    .content-cell { padding: 32px 28px; color: ${EMAIL_PALETTE.ink}; font-size: 15px; line-height: 1.6; }
    .content-title { font-size: 20px; font-weight: 700; color: ${EMAIL_PALETTE.ink}; margin-top: 0; margin-bottom: 16px; }
    .code-box { background-color: ${EMAIL_PALETTE.panel}; border: 1px dashed ${EMAIL_PALETTE.gold}; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: ${EMAIL_PALETTE.pine}; text-transform: uppercase; margin-bottom: 6px; }
    .code-value { font-size: 24px; font-weight: 800; letter-spacing: 4px; color: ${EMAIL_PALETTE.holly}; font-family: Courier, monospace; margin: 0; }
    .btn-container { text-align: center; margin: 32px 0 16px 0; }
    .btn-link { display: inline-block; background-color: ${EMAIL_PALETTE.holly}; color: #ffffff !important; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-transform: uppercase; }
    .footer-cell { background-color: ${EMAIL_PALETTE.page}; padding: 24px 28px; text-align: center; border-top: 1px solid ${EMAIL_PALETTE.border}; color: ${EMAIL_PALETTE.muted}; font-size: 12px; line-height: 1.5; }
    .footer-cell a { color: ${EMAIL_PALETTE.pine}; text-decoration: underline; }
  </style>
</head>
<body style="background-color: ${EMAIL_PALETTE.page}; color: ${EMAIL_PALETTE.ink};">
  ${preheader ? `<div style="display:none;font-size:1px;color:${EMAIL_PALETTE.page};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <center class="wrapper">
    <table class="main" width="100%">
      <!-- Header -->
      <tr>
        <td class="header-cell">
          <h1 class="brand-title">🎄 KOVERT KLAUS 🕶️</h1>
          <p class="brand-subtitle">Santa's Whimsical Secret Service Division</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td class="content-cell">
          <h2 class="content-title">${title}</h2>
          ${bodyHtml}
          ${actionText && actionUrl ? `
          <div class="btn-container">
            <a href="${actionUrl}" class="btn-link" target="_blank" rel="noopener noreferrer">${actionText}</a>
          </div>` : ''}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td class="footer-cell">
          <p style="margin:0 0 8px 0;">${footerNote || 'Encrypted dispatch sent by KovertKlaus HQ. Zero trackers, 100% privacy.'}</p>
          <p style="margin:0;"><a href="https://kovertklaus.com">kovertklaus.com</a> &bull; Classified Operation Network</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

/**
 * Generates an Invitation email template.
 */
export function getInvitationEmailTemplate(params: InvitationEmailParams): { subject: string; html: string; text: string } {
  const { organizerName, exchangeTitle, inviteCode, joinUrl, budgetMin, budgetMax, isLatePass, kdmToken, isCovertDelivery, isExistingUser } = params;
  // New recipients register with the mission code (their alpha clearance); existing users open the mission to accept.
  const actionText = isCovertDelivery ? 'Review Accord & Join Operation' : isExistingUser ? 'Review & Accept Invitation' : 'Join Exchange';
  
  const budgetText = budgetMin && budgetMax
    ? `$${budgetMin} – $${budgetMax}`
    : budgetMax
    ? `Up to $${budgetMax}`
    : 'OpsLeader Discretion';

  let subject = isLatePass
    ? `🚨 [LATE PASS] Mission Invitation: "${exchangeTitle}"`
    : `📩 Mission Recruitment: Join "${exchangeTitle}" on KovertKlaus`;

  if (isCovertDelivery) {
    subject = `🕶️ Kovert Delivery Invitation: "${exchangeTitle}" (Classified Key Enclosed)`;
  }

  const bodyHtml = `
    <p>Agent, you have been officially recruited by <strong>${organizerName}</strong> to join the classified gift exchange operation: <strong>${exchangeTitle}</strong>.</p>
    
    ${isCovertDelivery ? `
    <div style="background-color: ${EMAIL_PALETTE.parchment}; border-left: 4px solid ${EMAIL_PALETTE.gold}; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <strong style="color: ${EMAIL_PALETTE.goldInk};">🕶️ KOVERT DELIVERY MISSION</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: ${EMAIL_PALETTE.muted};">This is a local stealth porch-drop operation for trusted friends & family. A mandatory Property Access & Safe Conduct Accord is required upon joining.</p>
    </div>` : isLatePass ? `
    <div style="background-color: ${EMAIL_PALETTE.dangerSoft}; border-left: 4px solid ${EMAIL_PALETTE.holly}; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <strong style="color: ${EMAIL_PALETTE.holly};">⚠️ LATE PASS AUTHORIZATION ACTIVE</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: ${EMAIL_PALETTE.cranberry};">The standard RSVP cutoff for this operation has passed. The OpsLeader has granted you late emergency clearance to enroll.</p>
    </div>` : `
    <p>Prepare your Wishlist Manifest, accept your assignment, and get ready for a covert gift exchange mission.</p>`}

    <div style="background-color: ${EMAIL_PALETTE.panel}; border: 1px solid ${EMAIL_PALETTE.border}; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="font-size: 11px; font-family: monospace; color: ${EMAIL_PALETTE.holly}; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">OPERATION DIRECTIVE</div>
      <div style="font-size: 16px; font-weight: bold; color: ${EMAIL_PALETTE.ink}; margin-bottom: 8px;">${exchangeTitle}</div>
      <div style="font-size: 13px; color: ${EMAIL_PALETTE.muted};">Host: <strong style="color: ${EMAIL_PALETTE.ink};">${organizerName}</strong></div>
      <div style="font-size: 13px; color: ${EMAIL_PALETTE.muted};">Target Budget: <strong style="color: ${EMAIL_PALETTE.pine};">${budgetText}</strong></div>
    </div>

    <div class="code-box">
      <div class="code-label">${kdmToken ? 'Personal Single-Use KDM Token' : 'Classified Invite Code'}</div>
      <div class="code-value">${kdmToken || inviteCode}</div>
    </div>

    <p style="text-align: center; color: ${EMAIL_PALETTE.muted}; font-size: 13px;">
      ${kdmToken
        ? 'Click the button below to review the Property Access Accord and accept your classified mission.'
        : isExistingUser
        ? 'Open the mission to accept or decline. You can also answer from Active Operations on your dashboard.'
        : 'Click Join Exchange to create your operative profile. Your invitation clears you for the KovertKlaus alpha and enrolls you in this mission.'}
    </p>
  `;

  const html = renderBaseEmail({
    title: `Recruitment Order: ${exchangeTitle}`,
    preheader: `${organizerName} has recruited you to join ${exchangeTitle}!`,
    bodyHtml,
    actionText,
    actionUrl: joinUrl,
  });

  const text = stripHtml(`
    KOVERT KLAUS // CLASSIFIED DISPATCH
    --------------------------------------------------
    Recruitment Order: ${exchangeTitle}

    Agent, you have been recruited by ${organizerName} to join: ${exchangeTitle}.
    Budget: ${budgetText}
    ${isLatePass ? '\n[LATE PASS AUTHORIZATION ACTIVE] The standard RSVP cutoff has passed; emergency clearance granted.\n' : ''}
    Your Invite Code: ${inviteCode}

    ${isExistingUser ? 'Accept or decline here:' : 'Join here (creates your profile and enrolls you):'}
    ${joinUrl}

    --------------------------------------------------
    Sent by KovertKlaus HQ (admin@kovertklaus.com)
  `);

  return { subject, html, text };
}

/**
 * Generates a Target Assignment email template.
 */
export function getAssignmentEmailTemplate(params: AssignmentEmailParams): { subject: string; html: string; text: string } {
  const recipientName = params.recipientName || params.agentName || 'Operative';
  const targetCodename = params.targetCodename || 'Classified Target';
  const { targetName, exchangeTitle, exchangeUrl, shippingDeadline, exchangeDate } = params;

  const subject = `🎯 Target Assigned for Operation: "${exchangeTitle}"`;

  const bodyHtml = `
    <p>Greetings, <strong>${recipientName}</strong>.</p>
    <p>The randomized Sattolo derangement algorithm has executed for <strong>${exchangeTitle}</strong>. Your classified gift recipient has been locked in.</p>

    <div class="code-box">
      <div class="code-label">Your Assigned Target</div>
      <div class="code-value">${targetCodename}</div>
      ${targetName ? `<p style="margin: 6px 0 0 0; font-size: 14px; color: ${EMAIL_PALETTE.ink};">(Operative: ${targetName})</p>` : ''}
    </div>

    <div style="background-color: ${EMAIL_PALETTE.panel}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: ${EMAIL_PALETTE.pine};">📅 OPERATION TIMELINE DIRECTIVES:</p>
      ${shippingDeadline ? `<p style="margin: 4px 0; font-size: 14px; color: ${EMAIL_PALETTE.ink};">📦 <strong>Shipping Deadline:</strong> ${shippingDeadline}</p>` : ''}
      ${exchangeDate ? `<p style="margin: 4px 0; font-size: 14px; color: ${EMAIL_PALETTE.ink};">🎉 <strong>Exchange Event Day:</strong> ${exchangeDate}</p>` : ''}
    </div>

    <p style="font-size: 14px; color: ${EMAIL_PALETTE.muted};">
      Inspect your target's classified Wishlist Manifest and log your package tracking number to earn Demerit Immunity!
    </p>
  `;

  const html = renderBaseEmail({
    title: '🎯 Target Assignment Locked',
    preheader: `Your target for ${exchangeTitle} has been assigned!`,
    bodyHtml,
    actionText: 'View Target Dossier & Wishlist Manifest',
    actionUrl: exchangeUrl,
  });

  const text = stripHtml(`
    KOVERT KLAUS // TARGET ASSIGNED
    --------------------------------------------------
    Greetings, ${recipientName}.
    
    Your target for "${exchangeTitle}" is: ${targetCodename} ${targetName ? `(${targetName})` : ''}

    ${shippingDeadline ? `Shipping Deadline: ${shippingDeadline}` : ''}
    ${exchangeDate ? `Exchange Event Day: ${exchangeDate}` : ''}

    View your target's wishlist here:
    ${exchangeUrl}
    --------------------------------------------------
  `);

  return { subject, html, text };
}

/**
 * Generates an OpsLeader Nudge / Reminder email template.
 */
export function getNudgeEmailTemplate(params: NudgeEmailParams): { subject: string; html: string; text: string } {
  const recipientName = params.recipientName || 'Operative';
  const { organizerName, exchangeTitle, message, actionUrl } = params;

  const subject = `🔔 Reminder Alert: "${exchangeTitle}" from OpsLeader ${organizerName}`;

  const bodyHtml = `
    <p>Agent <strong>${recipientName}</strong>,</p>
    <p>Your OpsLeader <strong>${organizerName}</strong> has broadcast an operational nudge for <strong>${exchangeTitle}</strong>:</p>

    <div style="background-color: ${EMAIL_PALETTE.panel}; border-left: 4px solid ${EMAIL_PALETTE.gold}; padding: 14px 18px; margin: 20px 0; border-radius: 6px; font-style: italic; color: ${EMAIL_PALETTE.ink};">
      "${message}"
    </div>

    <p style="font-size: 14px; color: ${EMAIL_PALETTE.muted};">
      Please access the Command Center to review your tasks and keep your operation compliant.
    </p>
  `;

  const html = renderBaseEmail({
    title: '🔔 Operation Nudge Alert',
    preheader: `${organizerName} sent you a reminder for ${exchangeTitle}`,
    bodyHtml,
    actionText: 'Access Command Center',
    actionUrl,
  });

  const text = stripHtml(`
    KOVERT KLAUS // OPERATION NUDGE
    --------------------------------------------------
    Agent ${recipientName},

    OpsLeader ${organizerName} sent a reminder for "${exchangeTitle}":
    "${message}"

    Access Command Center:
    ${actionUrl}
    --------------------------------------------------
  `);

  return { subject, html, text };
}

/**
 * Generates a Welcome / Operative Onboarding email template.
 */
export function getWelcomeEmailTemplate(params: WelcomeEmailParams): { subject: string; html: string; text: string } {
  const { name, codename } = params;
  const agentDisplay = codename ? `Agent ${codename} (${name})` : name;
  const subject = `🕶️ Welcome to KovertKlaus, ${codename ? `Agent ${codename}` : name}!`;

  const bodyHtml = `
    <p>Welcome to the Division, <strong>${name}</strong>!</p>
    <p>Your official operative profile is now active on <strong>kovertklaus.com</strong>.</p>

    <div class="code-box">
      <div class="code-label">OPERATIVE PROFILE</div>
      <div class="code-value" style="font-size: 18px; color: ${EMAIL_PALETTE.holly};">${agentDisplay}</div>
    </div>

    <div style="background-color: ${EMAIL_PALETTE.panel}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: ${EMAIL_PALETTE.pine};">⚡ QUICK START DIRECTIVES:</p>
      <ul style="margin: 0; padding-left: 20px; color: ${EMAIL_PALETTE.ink}; font-size: 13px; line-height: 1.8;">
        <li><strong>Initialize Your Wishlist Manifest:</strong> Add Manifest Items from Amazon, Target, Etsy, or any store link.</li>
        <li><strong>Set Sizing & Preferences:</strong> Add hobbies, clothing/shoe sizes, and dietary notes for tailored gifting.</li>
        <li><strong>Join or Create an Exchange:</strong> Host an operation for your family or join with an invite code.</li>
      </ul>
    </div>
  `;

  const html = renderBaseEmail({
    title: 'Welcome to KovertKlaus',
    preheader: `Welcome to KovertKlaus, ${name}!`,
    bodyHtml,
    actionText: 'Access Operative Dashboard',
    actionUrl: 'https://kovertklaus.com/dashboard',
  });

  const text = stripHtml(`
    KOVERT KLAUS // WELCOME OPERATIVE
    --------------------------------------------------
    Welcome to the Division, ${name}!
    Profile: ${agentDisplay}

    Directives:
    1. Initialize your Wishlist Manifest.
    2. Set sizing and preferences.
    3. Join or create an exchange.

    Access Dashboard: https://kovertklaus.com/dashboard
    --------------------------------------------------
  `);

  return { subject, html, text };
}

/**
 * Generates an OpsTeam Broadcast email template.
 */
export function getBroadcastEmailTemplate(params: BroadcastEmailParams): { subject: string; html: string; text: string } {
  const { exchangeTitle, subject: broadcastSubject, message, senderName, exchangeUrl } = params;
  const subject = `📢 [${exchangeTitle}] ${broadcastSubject}`;

  const bodyHtml = `
    <p>Message from <strong>${senderName}</strong> regarding <strong>${exchangeTitle}</strong>:</p>

    <div style="background-color: ${EMAIL_PALETTE.panel}; border-left: 4px solid ${EMAIL_PALETTE.pine}; border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 20px 0; color: ${EMAIL_PALETTE.ink}; font-size: 14px; line-height: 1.7;">
      ${message.replace(/\n/g, '<br>')}
    </div>
  `;

  const html = renderBaseEmail({
    title: `Broadcast: ${exchangeTitle}`,
    preheader: `${senderName} broadcast a message for ${exchangeTitle}`,
    bodyHtml,
    actionText: 'Open Operation Command Center',
    actionUrl: exchangeUrl,
  });

  const text = stripHtml(`
    KOVERT KLAUS // BROADCAST
    --------------------------------------------------
    Operation: ${exchangeTitle}
    From: ${senderName}

    ${message}

    Access Command Center: ${exchangeUrl}
    --------------------------------------------------
  `);

  return { subject, html, text };
}

/**
 * Generates a Clearance Lead / Pre-Launch Confirmation email template.
 */
export function getClearanceConfirmationEmailTemplate(params: ClearanceConfirmationParams): { subject: string; html: string; text: string } {
  const recipientEmail = params.recipientEmail || params.to || 'Operative';
  const { positionNumber } = params;

  const subject = `🕶️ Clearance Confirmed: Welcome to KovertKlaus Early Access`;

  const bodyHtml = `
    <p>Operative,</p>
    <p>Your clearance request for <strong>${recipientEmail}</strong> has been encrypted and logged to the KovertKlaus pre-launch registry.</p>

    <div class="code-box">
      <div class="code-label">Access Status</div>
      <div class="code-value" style="font-size: 18px; color: ${EMAIL_PALETTE.pine};">STAGED FOR LAUNCH</div>
      ${positionNumber ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: ${EMAIL_PALETTE.muted};">Roster Position: #${positionNumber}</p>` : ''}
    </div>

    <p style="font-size: 14px; color: ${EMAIL_PALETTE.ink};">
      When our global operation opens for the upcoming holiday season, you will receive your priority activation cipher directly to this email address.
    </p>
  `;

  const html = renderBaseEmail({
    title: 'Clearance Confirmed',
    preheader: 'Your KovertKlaus early access clearance is registered.',
    bodyHtml,
    actionText: 'Visit KovertKlaus HQ',
    actionUrl: 'https://kovertklaus.com',
  });

  const text = stripHtml(`
    KOVERT KLAUS // CLEARANCE CONFIRMED
    --------------------------------------------------
    Operative,

    Your clearance request for ${recipientEmail} has been logged.
    Status: STAGED FOR LAUNCH ${positionNumber ? `(#${positionNumber})` : ''}

    You will receive your priority activation cipher upon official launch.
    https://kovertklaus.com
    --------------------------------------------------
  `);

  return { subject, html, text };
}

/**
 * Generates email markup for Alpha Clearance Approval with one-time invite cipher.
 */
export function getClearanceApprovalEmailTemplate(params: ClearanceApprovalParams): { subject: string; html: string; text: string } {
  const recipientEmail = params.recipientEmail || params.to || 'Operative';
  const { inviteCode } = params;
  const registrationUrl = params.registrationUrl || `https://kovertklaus.com/register?code=${inviteCode}&email=${encodeURIComponent(recipientEmail)}`;

  const subject = `🎄 Alpha Clearance Granted: Your KovertKlaus Activation Cipher`;

  const bodyHtml = `
    <p>Operative${params.name ? ` ${params.name}` : ''},</p>
    <p>Your request for early clearance has been <strong>APPROVED</strong> by North Pole Command. You have been granted priority clearance to participate in the KovertKlaus Public Alpha.</p>

    <div class="code-box">
      <div class="code-label">Single-Use Alpha Activation Cipher</div>
      <div class="code-value" style="font-size: 22px; letter-spacing: 2px; color: ${EMAIL_PALETTE.pine};">${inviteCode}</div>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: ${EMAIL_PALETTE.muted};">This code is tied to ${recipientEmail} and is consumed upon registration.</p>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_PALETTE.ink};">
      Click the button below to register your account and start organizing or joining covert Secret Santa missions.
    </p>
  `;

  const html = renderBaseEmail({
    title: 'Alpha Clearance Approved',
    preheader: `Your KovertKlaus Public Alpha activation cipher is ${inviteCode}.`,
    bodyHtml,
    actionText: 'Complete Alpha Registration →',
    actionUrl: registrationUrl,
  });

  const text = stripHtml(`
    KOVERT KLAUS // ALPHA CLEARANCE GRANTED
    --------------------------------------------------
    Operative${params.name ? ` ${params.name}` : ''},

    Your clearance request for ${recipientEmail} has been APPROVED by North Pole Command.
    Your Single-Use Alpha Activation Cipher: ${inviteCode}

    Complete your registration at:
    ${registrationUrl}

    This code is tied to your email and expires immediately upon registration.
  `);

  return { subject, html, text };
}
