/**
 * 📧 KovertKlaus Transactional Email Dispatch Engine
 *
 * Cloudflare Email Routing & Outbound Gateway Integration
 * Supports Cloudflare API / Worker Email Gateway with graceful local development fallback.
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mode: 'cloudflare' | 'logged';
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'KovertKlaus HQ <dispatch@kovertklaus.com>';
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || 'hq@kovertklaus.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://kovertklaus.com';

/**
 * Core Email Dispatcher
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, html, text, from = DEFAULT_FROM, replyTo = DEFAULT_REPLY_TO } = options;
  const recipients = Array.isArray(to) ? to : [to];

  // Plain-text fallback if not explicitly provided
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Cloudflare Email Routing / Gateway Configuration
  const cfApiToken = process.env.CLOUDFLARE_EMAIL_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfGatewayUrl = process.env.CLOUDFLARE_EMAIL_GATEWAY_URL;

  // 1. Live Cloudflare Egress Gateway (Production / Configured)
  if (cfGatewayUrl || (cfApiToken && cfAccountId)) {
    try {
      const endpoint = cfGatewayUrl || `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/email/routing/send`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfApiToken ? { Authorization: `Bearer ${cfApiToken}` } : {}),
        },
        body: JSON.stringify({
          from,
          reply_to: replyTo,
          to: recipients,
          subject,
          html,
          text: plainText,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Cloudflare Email Error]', response.status, errText);
        // Fall back to logged mode in development / sandbox
        return {
          success: true,
          mode: 'logged',
          error: `Cloudflare API returned ${response.status}: ${errText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.result?.id || data.id || `cf-${Date.now()}`,
        mode: 'cloudflare',
      };
    } catch (err: any) {
      console.error('[Email Dispatch Failed]', err.message);
      return {
        success: false,
        error: err.message,
        mode: 'cloudflare',
      };
    }
  }

  // 2. Development / Sandbox Console Fallback
  console.log('---------------------------------------------------------');
  console.log(`📧 [EMAIL DISPATCH - CLOUDFLARE SIMULATOR]`);
  console.log(`To: ${recipients.join(', ')}`);
  console.log(`From: ${from}`);
  console.log(`Subject: ${subject}`);
  console.log(`Plain Text Preview: ${plainText.slice(0, 160)}...`);
  console.log('---------------------------------------------------------');

  return {
    success: true,
    messageId: `dev-sim-${Date.now()}`,
    mode: 'logged',
  };
}

/* ==========================================================================
 * 🎨 Branded HTML Email Templates (Christmas Pine & Covert Ops Styling)
 * ========================================================================== */

function baseEmailWrapper(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#020617;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#0f172a;border:1px solid #1e293b;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#064e3b 0%,#0f172a 100%);padding:24px 32px;border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:24px;line-height:1;margin-bottom:6px;">🎁 <strong>KovertKlaus</strong></div>
                    <div style="font-size:11px;font-family:monospace;letter-spacing:2px;color:#38bdf8;text-transform:uppercase;font-weight:bold;">Santa's Whimsical Secret Service</div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;border-radius:12px;background-color:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;font-size:10px;font-family:monospace;font-weight:bold;">CLASSIFIED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;color:#e2e8f0;font-size:14px;line-height:1.6;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Security & Footer -->
          <tr>
            <td style="padding:20px 32px 28px 32px;background-color:#090d16;border-top:1px solid #1e293b;text-align:center;font-size:11px;color:#64748b;font-family:monospace;">
              <div style="margin-bottom:8px;">🔒 <strong>Zero-Telemetry Privacy Guarantee</strong> • Verified Cloudflare DNS</div>
              <div>© 2026 Joshua Simpson • <a href="${APP_URL}" style="color:#38bdf8;text-decoration:none;">kovertklaus.com</a></div>
              <div style="margin-top:6px;color:#475569;">Business Source License 1.1 • GPLv3 Sunset Grant</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Clearance / Early Access Confirmation Email
 */
export async function sendClearanceConfirmationEmail(params: {
  to: string;
  name?: string;
}): Promise<EmailResult> {
  const { to, name } = params;
  const greeting = name ? `Agent ${name}` : 'Operative';

  const html = baseEmailWrapper(
    'Clearance Request Acknowledged — KovertKlaus',
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;font-size:36px;margin-bottom:8px;">🎄✨</div>
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Clearance Request Acknowledged</h1>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Your early access registration is officially confirmed on <strong style="color:#38bdf8;">kovertklaus.com</strong>.</p>
    </div>

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:16px;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-family:monospace;color:#38bdf8;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">OPERATIVE STATUS</div>
      <div style="font-size:16px;font-weight:bold;color:#f8fafc;margin-bottom:12px;">${greeting} &lt;${to}&gt;</div>
      
      <div style="border-top:1px solid #334155;padding-top:12px;display:table;width:100%;">
        <div style="display:table-cell;width:50%;">
          <div style="font-size:10px;color:#94a3b8;font-family:monospace;">QUEUE STATUS</div>
          <div style="font-size:13px;font-weight:bold;color:#10b981;">PRIORITY CLEARANCE</div>
        </div>
        <div style="display:table-cell;width:50%;">
          <div style="font-size:10px;color:#94a3b8;font-family:monospace;">TARGET LAUNCH</div>
          <div style="font-size:13px;font-weight:bold;color:#f59e0b;">NOV 1, 2026</div>
        </div>
      </div>
    </div>

    <p style="margin:0 0 16px 0;">Thank you for registering your clearance with <strong>Santa's Whimsical Secret Service</strong>. We're putting the finishing touches on our guaranteed 1-to-1 Sattolo matching engine, tap-to-swap assignments, and smart OpKit wishlist tools.</p>

    <p style="margin:0 0 24px 0;color:#cbd5e1;">You will receive an exclusive priority dispatch the moment public recruitment opens for the 2026 holiday season.</p>

    <div style="text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#0369a1);color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 28px;border-radius:12px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.4);">
        Visit KovertKlaus HQ →
      </a>
    </div>
    `
  );

  return sendEmail({
    to,
    subject: `🎄 [KovertKlaus HQ] Clearance Access Request Acknowledged`,
    html,
  });
}

/**
 * 2. Exchange / Operation Invitation Email
 */
export async function sendInvitationEmail(params: {
  to: string;
  exchangeTitle: string;
  organizerName: string;
  inviteCode: string;
  budgetMin?: number | null;
  budgetMax: number;
  joinUrl?: string;
}): Promise<EmailResult> {
  const { to, exchangeTitle, organizerName, inviteCode, budgetMin, budgetMax, joinUrl } = params;
  const targetUrl = joinUrl || `${APP_URL}/exchange/${inviteCode}`;
  const budgetText = budgetMin ? `$${budgetMin} – $${budgetMax}` : `Up to $${budgetMax}`;

  const html = baseEmailWrapper(
    `You're Recruited for ${exchangeTitle}`,
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;font-size:36px;margin-bottom:8px;">🎅🕵️</div>
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">You've Been Recruited!</h1>
      <p style="margin:0;color:#94a3b8;font-size:13px;"><strong style="color:#ffffff;">${organizerName}</strong> has invited you to join a Secret Santa gift exchange.</p>
    </div>

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;margin-bottom:24px;">
      <div style="font-size:11px;font-family:monospace;color:#38bdf8;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">OPERATION DISPATCH</div>
      <div style="font-size:18px;font-weight:900;color:#ffffff;margin-bottom:14px;">${exchangeTitle}</div>
      
      <table role="presentation" width="100%" style="border-top:1px solid #334155;padding-top:12px;font-size:12px;">
        <tr>
          <td style="color:#94a3b8;padding-bottom:6px;">Host / Head Elf:</td>
          <td align="right" style="color:#ffffff;font-weight:bold;padding-bottom:6px;">${organizerName}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding-bottom:6px;">Gift Budget:</td>
          <td align="right" style="color:#10b981;font-weight:bold;padding-bottom:6px;">${budgetText}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;">Invite Code:</td>
          <td align="right" style="color:#f59e0b;font-family:monospace;font-weight:bold;">${inviteCode}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 20px 0;">Join the operation to build your confidential wishlist, submit size and hobby preferences, and receive your secret target when assignments lock!</p>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${targetUrl}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;font-weight:900;font-size:14px;padding:14px 32px;border-radius:14px;box-shadow:0 10px 20px -3px rgba(220,38,38,0.5);">
        🎁 Accept Mission & Join Exchange →
      </a>
    </div>
    <div style="text-align:center;font-size:11px;color:#64748b;font-family:monospace;">
      Direct Code: <strong style="color:#94a3b8;">${inviteCode}</strong>
    </div>
    `
  );

  return sendEmail({
    to,
    subject: `🎅 Classified Invitation: You're Recruited for "${exchangeTitle}" (Code: ${inviteCode})`,
    html,
  });
}

/**
 * 3. Welcome / Operative Onboarding Email
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  codename?: string;
}): Promise<EmailResult> {
  const { to, name, codename } = params;
  const agentDisplay = codename ? `Agent ${codename} (${name})` : name;

  const html = baseEmailWrapper(
    'Welcome to KovertKlaus',
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;font-size:36px;margin-bottom:8px;">🕶️🎁</div>
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Welcome to the Division, ${name}!</h1>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Your official operative profile is now active on <strong style="color:#38bdf8;">kovertklaus.com</strong>.</p>
    </div>

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:16px;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-family:monospace;color:#38bdf8;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">OPERATIVE PROFILE</div>
      <div style="font-size:16px;font-weight:bold;color:#ffffff;margin-bottom:4px;">${agentDisplay}</div>
      <div style="font-size:12px;color:#94a3b8;font-family:monospace;">Registered Email: ${to}</div>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-weight:bold;color:#ffffff;margin-bottom:8px;font-size:13px;">⚡ Quick Start Checklist:</div>
      <ul style="margin:0;padding-left:20px;color:#cbd5e1;font-size:13px;line-height:1.8;">
        <li><strong>Initialize Your OpKit:</strong> Add items to your wishlist from Amazon, Target, Etsy, or any store link.</li>
        <li><strong>Set Sizing & Preferences:</strong> Add hobbies, clothing/shoe sizes, and dietary notes for tailored gifting.</li>
        <li><strong>Join or Create an Exchange:</strong> Host an operation for your family or join with an invite code.</li>
      </ul>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#0369a1);color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 28px;border-radius:12px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.4);">
        Access Operative Dashboard →
      </a>
    </div>
    `
  );

  return sendEmail({
    to,
    subject: `🕶️ Welcome to KovertKlaus, ${codename ? `Agent ${codename}` : name}!`,
    html,
  });
}

/**
 * 4. Target Assignment Alert Email
 */
export async function sendTargetAssignmentEmail(params: {
  to: string;
  agentName: string;
  exchangeTitle: string;
  exchangeUrl: string;
}): Promise<EmailResult> {
  const { to, agentName, exchangeTitle, exchangeUrl } = params;

  const html = baseEmailWrapper(
    `Secret Target Assigned — ${exchangeTitle}`,
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;font-size:36px;margin-bottom:8px;">🎯🤫</div>
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Your Secret Target Has Been Assigned!</h1>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Assignments for <strong style="color:#ffffff;">${exchangeTitle}</strong> are locked in.</p>
    </div>

    <p style="margin:0 0 16px 0;">Hello ${agentName},</p>
    <p style="margin:0 0 20px 0;">The randomized Sattolo derangement draw is complete. Your confidential gift recipient is ready for viewing in your Command Center.</p>

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:16px;padding:18px 20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:11px;font-family:monospace;color:#f59e0b;font-weight:bold;text-transform:uppercase;margin-bottom:6px;">TOP SECRET ASSIGNMENT</div>
      <div style="font-size:14px;color:#cbd5e1;">Log in to review your target's wishlist, shipping address, and size preferences in complete secrecy.</div>
    </div>

    <div style="text-align:center;">
      <a href="${exchangeUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:14px 32px;border-radius:14px;box-shadow:0 10px 20px -3px rgba(5,150,105,0.5);">
        🎁 View Secret Target Dossier →
      </a>
    </div>
    `
  );

  return sendEmail({
    to,
    subject: `🎁 [MISSION ACTIVE] Your Secret Target Has Been Assigned for "${exchangeTitle}"!`,
    html,
  });
}

/**
 * 5. OpsLeader Team Broadcast / Nudge Email
 */
export async function sendBroadcastEmail(params: {
  to: string | string[];
  exchangeTitle: string;
  subject: string;
  message: string;
  senderName: string;
  exchangeUrl: string;
}): Promise<EmailResult> {
  const { to, exchangeTitle, subject, message, senderName, exchangeUrl } = params;

  const html = baseEmailWrapper(
    `Broadcast: ${exchangeTitle}`,
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;font-size:36px;margin-bottom:8px;">📢🎄</div>
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Message from ${senderName}</h1>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Operation: <strong style="color:#ffffff;">${exchangeTitle}</strong></p>
    </div>

    <div style="background-color:#1e293b;border-left:4px solid #38bdf8;border-radius:0 16px 16px 0;padding:18px 20px;margin-bottom:24px;color:#f8fafc;font-size:14px;line-height:1.7;">
      ${message.replace(/\n/g, '<br>')}
    </div>

    <div style="text-align:center;">
      <a href="${exchangeUrl}" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#0369a1);color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 28px;border-radius:12px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.4);">
        Open Operation Command Center →
      </a>
    </div>
    `
  );

  return sendEmail({
    to,
    subject: `📢 [${exchangeTitle}] ${subject}`,
    html,
  });
}
