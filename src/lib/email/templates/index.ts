import {
  AssignmentEmailParams,
  BroadcastEmailParams,
  ClearanceConfirmationParams,
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
 * Responsive, highly-compatible HTML email container matching KovertKlaus aesthetic.
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
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #090d16; padding-bottom: 40px; }
    .main { background-color: #0f172a; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    .header-cell { background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #059669; }
    .brand-title { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #10b981; margin: 0 0 6px 0; text-transform: uppercase; }
    .brand-subtitle { font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #94a3b8; margin: 0; text-transform: uppercase; }
    .content-cell { padding: 32px 28px; color: #cbd5e1; font-size: 15px; line-height: 1.6; }
    .content-title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 16px; }
    .code-box { background-color: #1e293b; border: 1px dashed #38bdf8; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px; }
    .code-value { font-size: 24px; font-weight: 800; letter-spacing: 4px; color: #f59e0b; font-family: Courier, monospace; margin: 0; }
    .btn-container { text-align: center; margin: 32px 0 16px 0; }
    .btn-link { display: inline-block; background-color: #059669; color: #ffffff !important; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); text-transform: uppercase; }
    .footer-cell { background-color: #090d16; padding: 24px 28px; text-align: center; border-top: 1px solid #1e293b; color: #64748b; font-size: 12px; line-height: 1.5; }
    .footer-cell a { color: #10b981; text-decoration: none; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#090d16;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
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
  const { organizerName, exchangeTitle, inviteCode, joinUrl, budgetMin, budgetMax, isLatePass } = params;
  
  const budgetText = budgetMin && budgetMax
    ? `$${budgetMin} – $${budgetMax}`
    : budgetMax
    ? `Up to $${budgetMax}`
    : 'OpsLeader Discretion';

  const subject = isLatePass
    ? `🚨 [LATE PASS] Mission Invitation: "${exchangeTitle}"`
    : `📩 Mission Recruitment: Join "${exchangeTitle}" on KovertKlaus`;

  const bodyHtml = `
    <p>Agent, you have been officially recruited by <strong>${organizerName}</strong> to join the classified gift exchange operation: <strong>${exchangeTitle}</strong>.</p>
    
    ${isLatePass ? `
    <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <strong style="color: #f87171;">⚠️ LATE PASS AUTHORIZATION ACTIVE</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #fca5a5;">The standard RSVP cutoff for this operation has passed. The OpsLeader has granted you late emergency clearance to enroll.</p>
    </div>` : `
    <p>Prepare your wishlist (OpKit), accept your assignment, and get ready for a covert gift exchange mission.</p>`}

    <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="font-size: 11px; font-family: monospace; color: #38bdf8; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">OPERATION DIRECTIVE</div>
      <div style="font-size: 16px; font-weight: bold; color: #ffffff; margin-bottom: 8px;">${exchangeTitle}</div>
      <div style="font-size: 13px; color: #94a3b8;">Host: <strong style="color: #f8fafc;">${organizerName}</strong></div>
      <div style="font-size: 13px; color: #94a3b8;">Target Budget: <strong style="color: #10b981;">${budgetText}</strong></div>
    </div>

    <div class="code-box">
      <div class="code-label">Classified Invite Code</div>
      <div class="code-value">${inviteCode}</div>
    </div>

    <p style="text-align: center; color: #94a3b8; font-size: 13px;">
      Click the button below to review mission directives and accept your assignment.
    </p>
  `;

  const html = renderBaseEmail({
    title: `Recruitment Order: ${exchangeTitle}`,
    preheader: `${organizerName} has recruited you to join ${exchangeTitle}!`,
    bodyHtml,
    actionText: 'Accept Mission Directive',
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

    Accept your mission here:
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
      ${targetName ? `<p style="margin: 6px 0 0 0; font-size: 14px; color: #cbd5e1;">(Operative: ${targetName})</p>` : ''}
    </div>

    <div style="background-color: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #10b981;">📅 OPERATION TIMELINE DIRECTIVES:</p>
      ${shippingDeadline ? `<p style="margin: 4px 0; font-size: 14px; color: #cbd5e1;">📦 <strong>Shipping Deadline:</strong> ${shippingDeadline}</p>` : ''}
      ${exchangeDate ? `<p style="margin: 4px 0; font-size: 14px; color: #cbd5e1;">🎉 <strong>Exchange Event Day:</strong> ${exchangeDate}</p>` : ''}
    </div>

    <p style="font-size: 14px; color: #94a3b8;">
      Inspect your target's classified OpKit wishlist and log your package tracking number to earn Demerit Immunity!
    </p>
  `;

  const html = renderBaseEmail({
    title: '🎯 Target Assignment Locked',
    preheader: `Your target for ${exchangeTitle} has been assigned!`,
    bodyHtml,
    actionText: 'View Target Dossier & OpKit',
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

    <div style="background-color: #1e293b; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 20px 0; border-radius: 6px; font-style: italic; color: #f1f5f9;">
      "${message}"
    </div>

    <p style="font-size: 14px; color: #94a3b8;">
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
      <div class="code-value" style="font-size: 18px; color: #38bdf8;">${agentDisplay}</div>
    </div>

    <div style="background-color: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #10b981;">⚡ QUICK START DIRECTIVES:</p>
      <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
        <li><strong>Initialize Your OpKit:</strong> Add items to your wishlist from Amazon, Target, Etsy, or any store link.</li>
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
    1. Initialize your OpKit wishlist.
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

    <div style="background-color: #1e293b; border-left: 4px solid #38bdf8; border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 20px 0; color: #f8fafc; font-size: 14px; line-height: 1.7;">
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
      <div class="code-value" style="font-size: 18px; color: #10b981;">STAGED FOR LAUNCH</div>
      ${positionNumber ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Roster Position: #${positionNumber}</p>` : ''}
    </div>

    <p style="font-size: 14px; color: #cbd5e1;">
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
