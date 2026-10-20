/**
 * @file templates.test.ts
 * @description Emails always render in the light, classic Christmas palette.
 *
 * Tier 1 (what): Renders each template and checks the palette and the light-only color scheme.
 * Tier 2 (why): Emails never follow a viewer's theme. A stray dark color would put dark text on a
 * dark panel in some clients, which is the contrast bug this palette replaced.
 * Tier 3 (how): Every hex color in the output must come from `EMAIL_PALETTE` (or white, used on
 * the pine header and holly button).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_PALETTE,
  getAssignmentEmailTemplate,
  getBroadcastEmailTemplate,
  getClearanceApprovalEmailTemplate,
  getClearanceConfirmationEmailTemplate,
  getInvitationEmailTemplate,
  getNudgeEmailTemplate,
  getWelcomeEmailTemplate,
} from './templates';

const ALLOWED = new Set<string>([...Object.values(EMAIL_PALETTE), '#ffffff']);

const rendered: Record<string, string> = {
  invitation: getInvitationEmailTemplate({
    organizerName: 'Agent: Holly',
    exchangeTitle: 'Family Exchange',
    inviteCode: 'K9X2-R7M4',
    joinUrl: 'https://kovertklaus.com/exchange/K9X2R7M4',
    budgetMin: 20,
    budgetMax: 50,
    isLatePass: true,
  }).html,
  covertInvitation: getInvitationEmailTemplate({
    organizerName: 'Agent: Holly',
    exchangeTitle: 'Porch Drop',
    inviteCode: 'K9X2-R7M4',
    joinUrl: 'https://kovertklaus.com/exchange/K9X2R7M4',
    isCovertDelivery: true,
  }).html,
  assignment: getAssignmentEmailTemplate({
    agentName: 'Agent: Holly',
    exchangeTitle: 'Family Exchange',
    exchangeUrl: 'https://kovertklaus.com/exchange/K9X2R7M4',
    targetName: 'Agent: Ivy',
  }).html,
  nudge: getNudgeEmailTemplate({
    organizerName: 'Agent: Holly',
    exchangeTitle: 'Family Exchange',
    message: 'Please add your wishlist.',
    actionUrl: 'https://kovertklaus.com/exchange/K9X2R7M4',
  }).html,
  welcome: getWelcomeEmailTemplate({ name: 'Ivy' }).html,
  broadcast: getBroadcastEmailTemplate({
    to: 'elf@demo.invalid',
    exchangeTitle: 'Family Exchange',
    subject: 'Party time',
    message: 'Bring cocoa.',
    senderName: 'Agent: Holly',
    exchangeUrl: 'https://kovertklaus.com/exchange/K9X2R7M4',
  }).html,
  clearance: getClearanceConfirmationEmailTemplate({ recipientEmail: 'elf@demo.invalid', positionNumber: 3 }).html,
  approval: getClearanceApprovalEmailTemplate({ recipientEmail: 'elf@demo.invalid', inviteCode: 'K9X2-R7M4' }).html,
};

test('Email templates use only the light email palette', async (t) => {
  for (const [name, html] of Object.entries(rendered)) {
    await t.test(`${name} declares a light-only color scheme`, () => {
      assert.match(html, /<meta name="color-scheme" content="light only">/);
    });

    await t.test(`${name} uses no colors outside EMAIL_PALETTE`, () => {
      const colors = (html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toLowerCase());
      const stray = colors.filter((c) => !ALLOWED.has(c));
      assert.deepEqual(stray, [], `${name} has non-palette colors: ${stray.join(', ')}`);
      assert.ok(!/rgba\(/.test(html), `${name} has an rgba() color`);
    });
  }
});
