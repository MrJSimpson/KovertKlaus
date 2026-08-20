import { getEmailConfig } from './config';
import { sendEmail, sendInvitationEmail, sendAssignmentEmail, sendNudgeEmail, sendClearanceConfirmationEmail } from './dispatcher';
import {
  getInvitationEmailTemplate,
  getAssignmentEmailTemplate,
  getNudgeEmailTemplate,
  getClearanceConfirmationEmailTemplate,
  stripHtml,
} from './templates';

async function runTests() {
  console.log('🧪 Starting Universal Email Dispatcher Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // --- Test 1: Config Auto-Detection Priority ---
  console.log('--- Test 1: Config Auto-Detection ---');
  const originalEnv = { ...process.env };

  try {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.BREVO_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.RESEND_API_KEY;

    let cfg = getEmailConfig();
    assert(cfg.provider === 'console', 'Defaults to console mock when no env variables are set');

    process.env.BREVO_API_KEY = 'xkeysib-test-123';
    cfg = getEmailConfig();
    assert(cfg.provider === 'brevo', 'Auto-detects Brevo when BREVO_API_KEY is present');

    delete process.env.BREVO_API_KEY;
    process.env.SMTP_HOST = 'smtp.test.com';
    cfg = getEmailConfig();
    assert(cfg.provider === 'smtp', 'Auto-detects SMTP when SMTP_HOST is present');

    delete process.env.SMTP_HOST;
    process.env.RESEND_API_KEY = 're_test_123';
    cfg = getEmailConfig();
    assert(cfg.provider === 'resend', 'Auto-detects Resend when RESEND_API_KEY is present');

    process.env.EMAIL_PROVIDER = 'brevo';
    cfg = getEmailConfig();
    assert(cfg.provider === 'brevo', 'Respects explicit EMAIL_PROVIDER override');
  } finally {
    process.env = { ...originalEnv };
  }

  // --- Test 2: HTML Stripper & Template Generators ---
  console.log('\n--- Test 2: Templates & Plaintext Extraction ---');
  const rawHtml = '<div style="color:red"><p>Hello <strong>Agent</strong>!</p><br/><a href="https://kovertklaus.com">Link</a></div>';
  const cleanText = stripHtml(rawHtml);
  assert(cleanText.includes('Hello Agent!') && cleanText.includes('Link'), 'stripHtml successfully extracts clean plaintext');

  const inviteTpl = getInvitationEmailTemplate({
    recipientEmail: 'operative@example.com',
    organizerName: 'Nick Fury',
    exchangeTitle: 'Operation Secret Klaus',
    inviteCode: 'KOVERT-87WZ',
    joinUrl: 'https://kovertklaus.com/exchange/KOVERT-87WZ',
  });
  assert(inviteTpl.subject.includes('Operation Secret Klaus'), 'Invite template generates proper subject');
  assert(inviteTpl.html.includes('KOVERT-87WZ') && inviteTpl.text.includes('KOVERT-87WZ'), 'Invite template contains code in both HTML and text');

  const assignTpl = getAssignmentEmailTemplate({
    recipientEmail: 'han@example.com',
    recipientName: 'Han Solo',
    targetCodename: 'Agent-Chewbacca',
    exchangeTitle: 'Millennium Exchange',
    exchangeUrl: 'https://kovertklaus.com/exchange/MILL-1234',
    shippingDeadline: 'Dec 15, 2026',
  });
  assert(assignTpl.html.includes('Agent-Chewbacca') && assignTpl.html.includes('Dec 15, 2026'), 'Assignment template renders target codename and deadline');

  const nudgeTpl = getNudgeEmailTemplate({
    recipientEmail: 'luke@example.com',
    recipientName: 'Luke Skywalker',
    organizerName: 'Leia Organa',
    exchangeTitle: 'Rebel Secret Santa',
    message: 'Update your wishlist before the cutoff!',
    actionUrl: 'https://kovertklaus.com/exchange/REBEL-123',
  });
  assert(nudgeTpl.html.includes('Update your wishlist') && nudgeTpl.html.includes('Leia Organa'), 'Nudge template contains custom organizer message');

  const clearanceTpl = getClearanceConfirmationEmailTemplate({
    recipientEmail: 'earlybird@example.com',
    positionNumber: 42,
  });
  assert(clearanceTpl.html.includes('#42') && clearanceTpl.html.includes('STAGED FOR LAUNCH'), 'Clearance lead template generates waitlist confirmation');

  // --- Test 3: Console Mock Dispatch Execution ---
  console.log('\n--- Test 3: Console Mock Dispatch Execution ---');
  const consoleResult = await sendEmail(
    {
      to: 'agent.test@kovertklaus.com',
      subject: 'Unit Test Dispatch',
      html: '<p>Unit test payload</p>',
    },
    { provider: 'console' }
  );

  assert(consoleResult.success === true, 'Console dispatch returns success: true');
  assert(consoleResult.provider === 'console', 'Console dispatch reports provider: console');
  assert(typeof consoleResult.messageId === 'string', 'Console dispatch returns mock messageId');

  // --- Test 4: Dispatcher Helper Wrappers ---
  console.log('\n--- Test 4: Dispatcher Helper Wrappers ---');
  const inviteRes = await sendInvitationEmail({
    recipientEmail: 'agent.smith@matrix.com',
    organizerName: 'Morpheus',
    exchangeTitle: 'Zion Secret Santa',
    inviteCode: 'ZION-9999',
    joinUrl: 'https://kovertklaus.com/exchange/ZION-9999',
  });
  assert(inviteRes.success === true, 'sendInvitationEmail executes successfully');

  const assignRes = await sendAssignmentEmail({
    recipientEmail: 'agent.neo@matrix.com',
    recipientName: 'Neo',
    targetCodename: 'Agent-Trinity',
    exchangeTitle: 'Zion Secret Santa',
    exchangeUrl: 'https://kovertklaus.com/exchange/ZION-9999',
  });
  assert(assignRes.success === true, 'sendAssignmentEmail executes successfully');

  const nudgeRes = await sendNudgeEmail({
    recipientEmail: 'agent.neo@matrix.com',
    recipientName: 'Neo',
    organizerName: 'Morpheus',
    exchangeTitle: 'Zion Secret Santa',
    message: 'Take the red pill and choose your gift.',
    actionUrl: 'https://kovertklaus.com/exchange/ZION-9999',
  });
  assert(nudgeRes.success === true, 'sendNudgeEmail executes successfully');

  const clearanceRes = await sendClearanceConfirmationEmail({
    recipientEmail: 'agent.neo@matrix.com',
    positionNumber: 1,
  });
  assert(clearanceRes.success === true, 'sendClearanceConfirmationEmail executes successfully');

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
