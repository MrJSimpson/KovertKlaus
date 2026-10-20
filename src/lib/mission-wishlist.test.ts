import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import {
  addWishlistItem,
  checkWishlistPrice,
  getMissionWishlist,
  handleWishlistRequest,
  memberWishlistCreate,
  parsePrice,
  removeWishlistItem,
  updateWishlistItem,
  wishlistRules,
} from './mission-wishlist';

interface FakeItem { id: string; name: string; price: number; url: string; thumbnailUrl: string | null; description: string | null; properties: unknown; createdAt: Date }

/** One member (`u1`) of mission `ex1`, with a list holding `items`. */
function fakeDb(opts: { items?: Array<[string, number]>; budgetMax?: number; allowOver?: boolean; whiteElephant?: boolean; hasList?: boolean } = {}) {
  const items: FakeItem[] = (opts.items ?? []).map(([name, price], i) => ({
    id: `i${i + 1}`, name, price, url: '', thumbnailUrl: null, description: 'Any color', properties: { isPersonalized: true }, createdAt: new Date(i),
  }));
  let list = opts.hasList === false ? null : { id: 'w1', type: opts.whiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD' };
  let next = items.length;
  const db = {
    exchangeMember: {
      findUnique: async ({ where }: { where: { exchangeId_userId: { exchangeId: string; userId: string } } }) => {
        const { exchangeId, userId } = where.exchangeId_userId;
        if (exchangeId !== 'ex1' || userId !== 'u1') return null;
        return {
          id: 'm1',
          exchange: { budgetMax: opts.budgetMax ?? 30, allowWishlistOverBudget: opts.allowOver ?? true, isWhiteElephant: Boolean(opts.whiteElephant), currency: 'USD' },
          wishlist: list && { ...list, wishlistItems: items.map((item) => ({ item })) },
        };
      },
    },
    wishlist: {
      create: async ({ data }: { data: { memberId: string; type: string } }) => {
        list = { id: 'w-new', type: data.type };
        return { ...list, wishlistItems: [] };
      },
    },
    item: {
      create: async ({ data }: { data: { name: string; price: number; url: string; description: string | null; thumbnailUrl: string | null; properties?: unknown } }) => {
        const item = { id: `i${++next}`, name: data.name, price: data.price, url: data.url, thumbnailUrl: data.thumbnailUrl, description: data.description, properties: data.properties ?? null, createdAt: new Date() };
        items.push(item);
        return item;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeItem> }) => {
        const item = items.find((i) => i.id === where.id)!;
        Object.assign(item, data);
        return item;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        items.splice(items.findIndex((i) => i.id === where.id), 1);
      },
    },
    productCatalog: { findUnique: async () => null },
  };
  return { db: db as unknown as PrismaClient, items, list: () => list };
}

/** A personalized gift as the mission page sends it. */
const gift = (title: string, price?: unknown) => ({ title, price, description: 'Any color', properties: { isPersonalized: true } });

const rules = (budgetMax: number, allowOver: boolean, isWhiteElephant = false) =>
  wishlistRules({ budgetMax, allowWishlistOverBudget: allowOver, isWhiteElephant, currency: 'USD' });

test('Mission wishlist rules', async (t) => {
  await t.test('parsePrice: positive dollars rounded to cents; missing, zero or junk is null', () => {
    assert.equal(parsePrice(19.999), 20);
    assert.equal(parsePrice('12.345'), 12.35);
    for (const bad of [undefined, null, '', '  ', 0, -5, 'abc', NaN, Infinity * 0]) assert.equal(parsePrice(bad), null);
  });

  await t.test('a price is required', () => {
    assert.match(checkWishlistPrice(null, [], rules(30, true))!, /needs a price/);
  });

  await t.test('no single item may cost more than the limit, even with the toggle on', () => {
    assert.equal(checkWishlistPrice(30, [], rules(30, true)), null);
    assert.match(checkWishlistPrice(30.01, [], rules(30, true))!, /\$30\.00 or less/);
  });

  await t.test('toggle on: the list may total more than the limit', () => {
    assert.equal(rules(30, true).totalMax, null);
    assert.equal(checkWishlistPrice(25, [25, 25], rules(30, true)), null);
  });

  await t.test('toggle off: the whole list may not total more than the limit (cent-exact)', () => {
    assert.equal(rules(30, false).totalMax, 30);
    assert.equal(checkWishlistPrice(10.1, [9.9, 10], rules(30, false)), null);
    assert.match(checkWishlistPrice(10.11, [9.9, 10], rules(30, false))!, /\$30\.00 in total.*\$19\.90/);
  });

  await t.test('White Elephant: no total limit, the item limit still applies', () => {
    assert.equal(rules(25, false, true).totalMax, null);
    assert.match(checkWishlistPrice(26, [], rules(25, false, true))!, /\$25\.00 or less/);
  });

  await t.test('memberWishlistCreate picks the list type from the mission', () => {
    assert.equal(memberWishlistCreate('u1', false).create.type, 'STANDARD');
    assert.equal(memberWishlistCreate('u1', true).create.type, 'WHITE_ELEPHANT');
  });
});

test('Mission wishlist API', async (t) => {
  await t.test('GET returns the list and rules; non-members get 404', async () => {
    const { db } = fakeDb({ items: [['Cocoa', 12]], allowOver: false });
    const res = await getMissionWishlist(db, 'u1', 'ex1');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.wishlist?.items.map((i) => [i.title, i.price]), [['Cocoa', 12]]);
    assert.deepEqual(res.body.rules, { itemMax: 30, totalMax: 30, isWhiteElephant: false, currency: 'USD' });
    assert.equal((await getMissionWishlist(db, 'stranger', 'ex1')).status, 404);
    assert.equal((await getMissionWishlist(db, 'u1', 'other-mission')).status, 404);
    assert.equal((await getMissionWishlist(db, 'u1', null)).status, 404);
  });

  await t.test('GET creates a list for an older membership that has none', async () => {
    const { db, list } = fakeDb({ hasList: false, whiteElephant: true });
    const res = await getMissionWishlist(db, 'u1', 'ex1');
    assert.equal(res.status, 200);
    assert.equal(list()?.type, 'WHITE_ELEPHANT');
  });

  await t.test('POST adds a priced item and refuses one without a price or over the limit', async () => {
    const { db, items } = fakeDb();
    const ok = await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Knit hat', '18') });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.item?.price, 18);
    assert.equal((await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Cookies') })).status, 400);
    assert.equal((await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Drone', 31) })).status, 400);
    assert.equal(items.length, 1);
  });

  await t.test('POST respects the total limit when the Head Elf turns it on', async () => {
    const { db } = fakeDb({ items: [['Book', 20]], allowOver: false });
    const res = await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Socks', 11) });
    assert.equal(res.status, 400);
    assert.match(res.body.error!, /in total/);
    assert.equal((await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Socks', 10) })).status, 200);
  });

  await t.test('POST: a White Elephant list holds one gift', async () => {
    const { db } = fakeDb({ items: [['Singing fish', 20]], whiteElephant: true });
    const res = await addWishlistItem(db, 'u1', { exchangeId: 'ex1', ...gift('Second gift', 5) });
    assert.equal(res.status, 400);
  });

  await t.test('PATCH checks the new price against the other items, not itself', async () => {
    const { db } = fakeDb({ items: [['Book', 20], ['Tea', 5]], allowOver: false });
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', price: 25 })).status, 200);
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', price: 25.01 })).status, 400);
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', price: '' })).status, 400);
  });

  await t.test('PATCH keeps the stored price when none is sent, so an item over a lowered limit must be fixed', async () => {
    const { db } = fakeDb({ items: [['Board game', 40]], budgetMax: 30 });
    const res = await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', title: 'Board game (co-op)' });
    assert.equal(res.status, 400);
    assert.match(res.body.error!, /\$30\.00 or less/);
  });

  await t.test('PATCH and DELETE only touch items on the caller\'s list for that mission', async () => {
    const { db, items } = fakeDb({ items: [['Book', 20]] });
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'someone-elses', price: 5 })).status, 404);
    assert.equal((await removeWishlistItem(db, 'u1', 'ex1', 'someone-elses')).status, 404);
    assert.equal((await removeWishlistItem(db, 'stranger', 'ex1', 'i1')).status, 404);
    assert.equal((await removeWishlistItem(db, 'u1', 'ex1', 'i1')).status, 200);
    assert.equal(items.length, 0);
  });

  await t.test('a personalized gift needs a description, on add and on edit', async () => {
    const { db } = fakeDb({ items: [['Knit hat', 18]] });
    const add = await addWishlistItem(db, 'u1', { exchangeId: 'ex1', title: 'Cookies', price: 10, properties: { isPersonalized: true } });
    assert.equal(add.status, 400);
    assert.match(add.body.error!, /Describe the gift/);
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', description: '' })).status, 400);
    assert.equal((await updateWishlistItem(db, 'u1', { exchangeId: 'ex1', itemId: 'i1', title: 'Knit hat (blue)' })).status, 200);
  });

  await t.test('handleWishlistRequest routes by method and refuses others', async () => {
    const { db } = fakeDb({ items: [['Book', 20]] });
    const params = new URLSearchParams({ exchangeId: 'ex1', itemId: 'i1' });
    assert.equal((await handleWishlistRequest(db, 'u1', 'GET', params, async () => ({}))).status, 200);
    assert.equal((await handleWishlistRequest(db, 'u1', 'PUT', params, async () => ({}))).status, 405);
    assert.equal((await handleWishlistRequest(db, 'u1', 'DELETE', params, async () => ({}))).status, 200);
  });
});
