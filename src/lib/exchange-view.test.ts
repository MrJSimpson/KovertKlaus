import test from 'node:test';
import assert from 'node:assert';
import { memberCodenameMap, sanitizeExchangeMember } from './exchange-view';

const member = {
  id: 'm1',
  userId: 'giver',
  codename: 'Snowy Spider',
  codenameAcceptedAt: null,
  role: 'MEMBER',
  trackingNumber: '9400111899562537624132',
  targetUserId: 'target',
  user: { id: 'giver', name: 'Gina', streetAddress: '1 Main', city: 'X', state: 'WA', zipCode: '98000' },
  targetUser: {
    id: 'target',
    name: 'Tom',
    streetAddress: '2 Elm',
    city: 'Y',
    state: 'WA',
    zipCode: '98001',
    topHalfSize: 'L',
    favoriteColors: 'Green',
    allergiesDiet: 'Peanuts',
    allowOrganizerViewSizes: false,
    allowOrganizerViewFavorites: false,
    allowOrganizerViewAllergies: true,
    allowOrganizerViewMeasurements: false,
    wishlists: [{ wishlistItems: [{ item: { id: 'i1', name: 'Scarf', price: '20', url: 'https://x.test', thumbnailUrl: null } }] }],
  },
};

test('Exchange View - the giver sees their target dossier and Wishlist Manifest', () => {
  const view = sanitizeExchangeMember(member, { activeUserId: 'giver', isOrganizer: false, organizerId: 'organizer' });
  assert.strictEqual(view.targetUser?.topHalfSize, 'L');
  assert.strictEqual(view.targetUser?.favoriteColors, 'Green');
  assert.deepStrictEqual(view.targetUser?.wishlistItems.map((i: { title: string }) => i.title), ['Scarf']);
  assert.strictEqual(view.trackingNumber, '9400111899562537624132');
});

test('Exchange View - another agent sees no address, tracking or target', () => {
  const view = sanitizeExchangeMember(member, { activeUserId: 'someone', isOrganizer: false, organizerId: 'organizer' });
  assert.strictEqual(view.targetUser, null);
  assert.strictEqual(view.targetUserId, null);
  assert.strictEqual(view.user.streetAddress, null);
  assert.strictEqual(view.trackingNumber, undefined);
});

test('Exchange View - the Head Elf sees only dossier fields the target allowed', () => {
  const view = sanitizeExchangeMember(member, { activeUserId: 'organizer', isOrganizer: true, organizerId: 'organizer' });
  assert.strictEqual(view.targetUser?.topHalfSize, undefined);
  assert.strictEqual(view.targetUser?.favoriteColors, undefined);
  assert.strictEqual(view.targetUser?.allergiesDiet, 'Peanuts');
});

test('Exchange View - only the mission organizer is shown as Head Elf', () => {
  const promoted = { ...member, role: 'ORGANIZER' };
  const viewer = { activeUserId: 'giver', isOrganizer: false, organizerId: 'organizer' };
  assert.strictEqual(sanitizeExchangeMember(promoted, viewer).role, 'MEMBER');
  const headElf = { ...member, userId: 'organizer', role: 'MEMBER' };
  assert.strictEqual(sanitizeExchangeMember(headElf, viewer).role, 'ORGANIZER');
});

test('Exchange View - codenames come from the mission, not the account', () => {
  const memberCodenames = memberCodenameMap([{ userId: 'giver', codename: 'Snowy Spider' }, { userId: 'target', codename: 'Polar Owl' }]);
  const view = sanitizeExchangeMember(member, { activeUserId: 'giver', isOrganizer: false, organizerId: 'organizer', memberCodenames });
  assert.strictEqual(view.codename, 'Snowy Spider');
  assert.strictEqual(view.user.codename, 'Snowy Spider');
  assert.strictEqual(view.targetUser?.codename, 'Polar Owl');
});

test('Exchange View - only the agent sees whether their codename is accepted', () => {
  const accepted = { ...member, codenameAcceptedAt: new Date() };
  assert.strictEqual(sanitizeExchangeMember(member, { activeUserId: 'giver', isOrganizer: false, organizerId: 'organizer' }).codenameAccepted, false);
  assert.strictEqual(sanitizeExchangeMember(accepted, { activeUserId: 'giver', isOrganizer: false, organizerId: 'organizer' }).codenameAccepted, true);
  assert.strictEqual(sanitizeExchangeMember(accepted, { activeUserId: 'organizer', isOrganizer: true, organizerId: 'organizer' }).codenameAccepted, undefined);
});
