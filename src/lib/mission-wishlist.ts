/**
 * @file mission-wishlist.ts
 * @description Mission-scoped Wishlist Manifests: one list per agent per Holiday Mission.
 *
 * Tier 1 (what): `getMissionWishlist`, `addWishlistItem`, `updateWishlistItem` and
 * `removeWishlistItem` implement `/api/wishlist` for both the edge worker (SaaS) and the Next.js
 * route (self-hosted). `wishlistRules` and `checkWishlistPrice` are the pure budget rules, and
 * `memberWishlistCreate` is the nested create every enrollment path uses.
 * Tier 2 (why): Alpha feedback (2026-10-20): reusable account-wide manifests confused agents, and
 * nobody reused one list across missions. A list now belongs to one `ExchangeMember`, is created
 * when the agent joins and is deleted with the membership. Every item needs a price, no item may
 * cost more than the mission's `budgetMax`, and the Head Elf decides whether the whole list may
 * total more than `budgetMax` (`Exchange.allowWishlistOverBudget`, on by default). A personalized
 * gift (handmade or specially crafted, no store link) also needs a description, since the Santa
 * has nothing else to go on.
 * Beta (2026-10-29): a Secret Santa list holds at most `maxWishlistItems` different items (20) and
 * each item a quantity from 1 to `maxItemQuantity` (25), both platform limits an admin may tune. The
 * price limit applies to one unit; the whole-list total counts price × quantity, so 25 boxes of $2
 * pencils are one item worth $50.
 * Tier 3 (how): Prices are compared in whole cents. Rules are checked on every add and edit, so
 * items saved before a Head Elf lowered the budget stay until the agent edits or removes them;
 * the mission page flags them. A White Elephant list holds exactly one item, quantity 1. The
 * quantity lives on the `WishlistItem` join row.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { sanitizeText, normalizeProductUrl } from '@/lib/security';
import { sanitizeItemDetails, updateCatalogIntelligence, type ItemDetail } from '@/lib/product-intelligence';
import { validateAndSanitizeManifestItem } from '@/lib/validations/manifest';
import { isMissionClosed, MISSION_CLOSED_RESULT } from '@/lib/mission-cancel';
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@/lib/platform-limits';

/** The platform limits the list rules read. */
export type WishlistLimits = Pick<PlatformSettings, 'maxWishlistItems' | 'maxItemQuantity'>;

/** Highest price an item may carry, in dollars (matches the manifest validator). */
const MAX_ITEM_PRICE = 100000;

/** The budget rules for one mission's lists, as the mission page shows them. */
export interface WishlistRules {
  /** Highest price for any one item: the mission's `budgetMax`. */
  itemMax: number;
  /** Highest total for the whole list, or null when the Head Elf allows going over. */
  totalMax: number | null;
  /** White Elephant lists hold exactly one item. */
  isWhiteElephant: boolean;
  currency: string;
  /** Most different items on the list (1 for White Elephant). */
  maxItems: number;
  /** Highest quantity of one item (1 for White Elephant). */
  maxQuantity: number;
}

/** One Manifest Item as the client sees it. */
export interface WishlistItemView {
  id: string;
  title: string;
  price: number;
  /** How many the agent wants; the price is per unit. */
  quantity: number;
  url: string;
  thumbnail?: string;
  description?: string;
  properties?: unknown;
}

/** HTTP-shaped result shared by the worker and the Next route. */
export interface WishlistResult {
  status: number;
  body: {
    success?: boolean;
    error?: string;
    wishlist?: { id: string; type: string; items: WishlistItemView[] };
    rules?: WishlistRules;
    item?: WishlistItemView;
  };
}

/** Mission fields the rules need. */
interface MissionBudget {
  budgetMax: Prisma.Decimal | number;
  allowWishlistOverBudget: boolean;
  isWhiteElephant: boolean;
  currency: string;
}

/**
 * Builds a mission's list rules.
 *
 * @param exchange - The mission's budget fields.
 * @param limits - The platform's item and quantity limits.
 * @returns The rules shown to agents and enforced on every write.
 */
export function wishlistRules(exchange: MissionBudget, limits: WishlistLimits = DEFAULT_PLATFORM_SETTINGS): WishlistRules {
  const itemMax = Number(exchange.budgetMax);
  return {
    itemMax,
    totalMax: exchange.isWhiteElephant || exchange.allowWishlistOverBudget ? null : itemMax,
    isWhiteElephant: exchange.isWhiteElephant,
    currency: exchange.currency,
    maxItems: exchange.isWhiteElephant ? 1 : limits.maxWishlistItems,
    maxQuantity: exchange.isWhiteElephant ? 1 : limits.maxItemQuantity,
  };
}

/** Whole cents, so comparisons never trip over floating point. */
const cents = (dollars: number) => Math.round(dollars * 100);

const money = (dollars: number) => `$${dollars.toFixed(2)}`;

/**
 * Reads a price from a request: a positive number of dollars, rounded to cents.
 *
 * @param raw - The submitted value (number or numeric string).
 * @returns The price, or null when it is missing, not a number, or not above zero.
 */
export function parsePrice(raw: unknown): number | null {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = cents(Math.min(value, MAX_ITEM_PRICE)) / 100;
  return rounded > 0 ? rounded : null;
}

/**
 * Reads a quantity from a request. A missing value means 1.
 *
 * @param raw - The submitted value (number or numeric string).
 * @param max - The mission's `maxQuantity`.
 * @returns The quantity, or null when it is not a whole number from 1 to `max`.
 */
export function parseQuantity(raw: unknown, max: number): number | null {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return 1;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
}

/** Error for a quantity outside 1..`maxQuantity`. */
export function quantityError(rules: WishlistRules): string {
  return rules.maxQuantity === 1
    ? 'A White Elephant gift is a single item (quantity 1).'
    : `Quantity must be a whole number from 1 to ${rules.maxQuantity}.`;
}

/**
 * Checks one item's price against the mission's rules.
 *
 * @param price - The item's price per unit in dollars, already parsed (null when missing).
 * @param otherTotals - Price × quantity of each of the list's other items (excluding the one being saved).
 * @param rules - The mission's rules.
 * @param quantity - How many of this item the agent wants.
 * @returns An error message for the agent, or null when the price is allowed.
 */
export function checkWishlistPrice(price: number | null, otherTotals: number[], rules: WishlistRules, quantity = 1): string | null {
  if (price === null) return 'Every item needs a price. Enter what it costs (an estimate is fine for handmade gifts).';
  if (cents(price) > cents(rules.itemMax)) {
    return `Each item must cost ${money(rules.itemMax)} or less, the mission's spending limit.`;
  }
  if (rules.totalMax !== null) {
    const otherTotal = otherTotals.reduce((sum, p) => sum + cents(p), 0);
    if (otherTotal + cents(price) * quantity > cents(rules.totalMax)) {
      const line = quantity > 1 ? ` This item × ${quantity} comes to ${money((cents(price) * quantity) / 100)}.` : '';
      return `The Head Elf limits each wishlist to ${money(rules.totalMax)} in total. Your other items come to ${money(otherTotal / 100)}.${line}`;
    }
  }
  return null;
}

/** Price × quantity of one list line, in dollars. */
const lineTotal = (line: { item: { price: Prisma.Decimal | number }; quantity: number }) => Number(line.item.price) * line.quantity;

/**
 * The nested `wishlist` create for a new `ExchangeMember`, so every agent starts with an empty list.
 *
 * @param userId - The joining agent.
 * @param isWhiteElephant - The mission's type; decides the list type.
 * @returns A value for `exchangeMember.create({ data: { wishlist } })`.
 */
export function memberWishlistCreate(userId: string, isWhiteElephant: boolean) {
  return {
    create: {
      userId,
      name: isWhiteElephant ? 'White Elephant Gift' : 'Wishlist',
      type: isWhiteElephant ? ('WHITE_ELEPHANT' as const) : ('STANDARD' as const),
    },
  };
}

/** Maps a stored `Item` (and its list quantity) to the client shape. */
export function toWishlistItemView(item: {
  id: string;
  name: string;
  price: Prisma.Decimal | number;
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  properties: unknown;
}, quantity = 1): WishlistItemView {
  return {
    id: item.id,
    title: item.name,
    price: Number(item.price),
    quantity,
    url: item.url,
    thumbnail: item.thumbnailUrl || undefined,
    description: item.description || undefined,
    properties: item.properties || undefined,
  };
}

/** Error when a personalized gift has no description. */
export const PERSONALIZED_NEEDS_DESCRIPTION = 'Describe the gift for your Santa: what to make, and any details they need.';

const NOT_A_MEMBER: WishlistResult = { status: 404, body: { error: 'You are not an agent in this mission.' } };

/**
 * Loads the caller's membership, the mission's budget and their list (creating the list if an
 * older membership has none).
 */
async function loadMemberWishlist(db: PrismaClient, userId: string, exchangeId: unknown, limits: WishlistLimits) {
  if (typeof exchangeId !== 'string' || !exchangeId) return null;
  const member = await db.exchangeMember.findUnique({
    where: { exchangeId_userId: { exchangeId, userId } },
    select: {
      id: true,
      exchange: { select: { budgetMax: true, allowWishlistOverBudget: true, isWhiteElephant: true, currency: true, status: true } },
      wishlist: { select: { id: true, type: true, wishlistItems: { include: { item: true }, orderBy: { item: { createdAt: 'asc' } } } } },
    },
  });
  if (!member) return null;
  const wishlist = member.wishlist ?? await db.wishlist.create({
    data: { ...memberWishlistCreate(userId, member.exchange.isWhiteElephant).create, memberId: member.id },
    select: { id: true, type: true, wishlistItems: { include: { item: true } } },
  });
  const lines = wishlist.wishlistItems.map((wi) => ({ linkId: wi.id, item: wi.item, quantity: wi.quantity }));
  return { rules: wishlistRules(member.exchange, limits), wishlist, lines, closed: isMissionClosed(member.exchange.status) };
}

/** Feeds an item's detail rows into the shared product catalog. Failures are logged, never fatal. */
async function learnCatalogDetails(db: PrismaClient, url: string, details: ItemDetail[]) {
  if (!url || details.length === 0) return;
  try {
    const normalizedUrl = normalizeProductUrl(url);
    const cat = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
    if (cat) {
      await db.productCatalog.update({
        where: { url: normalizedUrl },
        data: { properties: updateCatalogIntelligence(cat.properties, details) as unknown as Prisma.InputJsonValue },
      });
    }
  } catch (e) {
    console.warn('[ProductCatalog Intelligence Update Error]', e);
  }
}

/**
 * GET /api/wishlist?exchangeId=…: the caller's list for one mission, with the mission's rules.
 */
export async function getMissionWishlist(db: PrismaClient, userId: string, exchangeId: unknown, limits: WishlistLimits = DEFAULT_PLATFORM_SETTINGS): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, exchangeId, limits);
  if (!loaded) return NOT_A_MEMBER;
  return {
    status: 200,
    body: {
      success: true,
      wishlist: { id: loaded.wishlist.id, type: loaded.wishlist.type, items: loaded.lines.map((l) => toWishlistItemView(l.item, l.quantity)) },
      rules: loaded.rules,
    },
  };
}

/** Body of POST and PATCH /api/wishlist. */
export interface WishlistItemInput {
  exchangeId?: unknown;
  itemId?: unknown;
  title?: string;
  url?: string;
  price?: unknown;
  /** How many the agent wants (default 1). */
  quantity?: unknown;
  description?: string;
  thumbnail?: string;
  properties?: { isPersonalized?: boolean; details?: unknown[]; [key: string]: unknown };
}

/**
 * POST /api/wishlist: adds an item to the caller's list for one mission.
 */
export async function addWishlistItem(db: PrismaClient, userId: string, input: WishlistItemInput, limits: WishlistLimits = DEFAULT_PLATFORM_SETTINGS): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, input.exchangeId, limits);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;

  if (loaded.rules.isWhiteElephant && loaded.lines.length >= 1) {
    return { status: 400, body: { error: '🐘 A White Elephant list holds exactly 1 gift, the one you are bringing.' } };
  }
  if (loaded.lines.length >= loaded.rules.maxItems) {
    return { status: 400, body: { error: `A wishlist holds up to ${loaded.rules.maxItems} different items. Remove one, or raise the quantity of an item already on your list.` } };
  }
  const quantity = parseQuantity(input.quantity, loaded.rules.maxQuantity);
  if (quantity === null) return { status: 400, body: { error: quantityError(loaded.rules) } };

  const validation = validateAndSanitizeManifestItem({
    title: input.title,
    url: input.url,
    price: input.price as number | string | undefined,
    description: input.description,
    thumbnail: input.thumbnail,
    properties: input.properties,
  });
  if (!validation.valid) return { status: 400, body: { error: validation.error } };
  if (validation.data.isPersonalized && !validation.data.description) {
    return { status: 400, body: { error: PERSONALIZED_NEEDS_DESCRIPTION } };
  }

  const price = parsePrice(input.price);
  const priceError = checkWishlistPrice(price, loaded.lines.map(lineTotal), loaded.rules, quantity);
  if (priceError) return { status: 400, body: { error: priceError } };

  const data = validation.data;
  const item = await db.item.create({
    data: {
      userId,
      name: data.name,
      url: data.url,
      price: price as number,
      description: data.description,
      thumbnailUrl: data.thumbnailUrl,
      properties: data.properties ? (data.properties as unknown as Prisma.InputJsonValue) : undefined,
      wishlistItems: { create: { wishlistId: loaded.wishlist.id, quantity } },
    },
  });
  await learnCatalogDetails(db, data.url, data.properties?.details ?? []);

  return { status: 200, body: { success: true, item: toWishlistItemView(item, quantity) } };
}

/**
 * PATCH /api/wishlist: edits one item on the caller's list for one mission. Fields left out are
 * kept; the resulting price must still satisfy the mission's rules.
 */
export async function updateWishlistItem(db: PrismaClient, userId: string, input: WishlistItemInput, limits: WishlistLimits = DEFAULT_PLATFORM_SETTINGS): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, input.exchangeId, limits);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;
  const line = loaded.lines.find((l) => l.item.id === input.itemId);
  if (!line) return { status: 404, body: { error: 'That item is not on your list for this mission.' } };
  const existing = line.item;

  const quantity = parseQuantity(input.quantity !== undefined ? input.quantity : line.quantity, loaded.rules.maxQuantity);
  if (quantity === null) return { status: 400, body: { error: quantityError(loaded.rules) } };
  const price = input.price !== undefined ? parsePrice(input.price) : parsePrice(Number(existing.price));
  const others = loaded.lines.filter((l) => l !== line).map(lineTotal);
  const priceError = checkWishlistPrice(price, others, loaded.rules, quantity);
  if (priceError) return { status: 400, body: { error: priceError } };

  const existingProps = existing.properties && typeof existing.properties === 'object'
    ? (existing.properties as Record<string, unknown>)
    : {};
  const isPersonalized = input.properties?.isPersonalized !== undefined
    ? Boolean(input.properties.isPersonalized)
    : Boolean(existingProps.isPersonalized || !existing.url);
  const details = Array.isArray(input.properties?.details) ? sanitizeItemDetails(input.properties.details) : undefined;

  const data: Prisma.ItemUpdateInput = { price: price as number };
  if (quantity !== line.quantity) data.wishlistItems = { update: { where: { id: line.linkId }, data: { quantity } } };
  if (input.title !== undefined) {
    const title = sanitizeText(input.title).trim().substring(0, 100);
    if (!title) return { status: 400, body: { error: 'Item title is required.' } };
    data.name = title;
  }
  if (input.description !== undefined) {
    data.description = input.description ? sanitizeText(input.description).trim().substring(0, 500) || null : null;
  }
  const finalDescription = input.description !== undefined ? data.description : existing.description;
  if (isPersonalized && !finalDescription) return { status: 400, body: { error: PERSONALIZED_NEEDS_DESCRIPTION } };
  if (input.thumbnail !== undefined) data.thumbnailUrl = input.thumbnail ? input.thumbnail.trim() : null;
  if (input.properties !== undefined) {
    const merged: Record<string, unknown> = { ...existingProps };
    if (isPersonalized) merged.isPersonalized = true;
    else delete merged.isPersonalized;
    if (details !== undefined) {
      if (details.length > 0) merged.details = details;
      else delete merged.details;
    }
    data.properties = Object.keys(merged).length > 0 ? (merged as Prisma.InputJsonValue) : Prisma.JsonNull;
  }

  const updated = await db.item.update({ where: { id: existing.id }, data });
  await learnCatalogDetails(db, existing.url, details ?? []);

  return { status: 200, body: { success: true, item: toWishlistItemView(updated, quantity) } };
}

/**
 * DELETE /api/wishlist?exchangeId=…&itemId=…: removes one item from the caller's list.
 */
export async function removeWishlistItem(db: PrismaClient, userId: string, exchangeId: unknown, itemId: unknown): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, exchangeId, DEFAULT_PLATFORM_SETTINGS);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;
  if (!loaded.lines.some((l) => l.item.id === itemId)) {
    return { status: 404, body: { error: 'That item is not on your list for this mission.' } };
  }
  await db.item.delete({ where: { id: itemId as string } });
  return { status: 200, body: { success: true } };
}

/**
 * Deletes the items on a member's list. Call before deleting the membership: the list itself
 * cascades with the member, but `Item` rows hang off the join table and would be left behind.
 *
 * @param db - Prisma client.
 * @param memberId - The `ExchangeMember` about to be removed.
 */
export async function deleteMemberWishlistItems(db: PrismaClient, memberId: string): Promise<void> {
  await db.item.deleteMany({ where: { wishlistItems: { some: { wishlist: { memberId } } } } });
}

/**
 * Routes one `/api/wishlist` request to the handler for its method, so the worker and the Next
 * route stay identical.
 *
 * @param db - Prisma client.
 * @param userId - The signed-in caller.
 * @param method - HTTP method.
 * @param searchParams - The request's query string (GET and DELETE).
 * @param readBody - Reads the JSON body (POST and PATCH).
 * @param limits - The platform's item and quantity limits (`getPlatformSettings`).
 * @returns The handler's result, or 405 for any other method.
 */
export async function handleWishlistRequest(
  db: PrismaClient,
  userId: string,
  method: string,
  searchParams: URLSearchParams,
  readBody: () => Promise<unknown>,
  limits: WishlistLimits = DEFAULT_PLATFORM_SETTINGS
): Promise<WishlistResult> {
  switch (method) {
    case 'GET':
      return getMissionWishlist(db, userId, searchParams.get('exchangeId'), limits);
    case 'POST':
      return addWishlistItem(db, userId, ((await readBody()) ?? {}) as WishlistItemInput, limits);
    case 'PATCH':
      return updateWishlistItem(db, userId, ((await readBody()) ?? {}) as WishlistItemInput, limits);
    case 'DELETE':
      return removeWishlistItem(db, userId, searchParams.get('exchangeId'), searchParams.get('itemId'));
    default:
      return { status: 405, body: { error: 'Method not allowed' } };
  }
}
