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
 * Tier 3 (how): Prices are compared in whole cents. Rules are checked on every add and edit, so
 * items saved before a Head Elf lowered the budget stay until the agent edits or removes them;
 * the mission page flags them. A White Elephant list holds exactly one item.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { sanitizeText, normalizeProductUrl } from '@/lib/security';
import { sanitizeItemDetails, updateCatalogIntelligence, type ItemDetail } from '@/lib/product-intelligence';
import { validateAndSanitizeManifestItem } from '@/lib/validations/manifest';
import { isMissionClosed, MISSION_CLOSED_RESULT } from '@/lib/mission-cancel';

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
}

/** One Manifest Item as the client sees it. */
export interface WishlistItemView {
  id: string;
  title: string;
  price: number;
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
 * @returns The rules shown to agents and enforced on every write.
 */
export function wishlistRules(exchange: MissionBudget): WishlistRules {
  const itemMax = Number(exchange.budgetMax);
  return {
    itemMax,
    totalMax: exchange.isWhiteElephant || exchange.allowWishlistOverBudget ? null : itemMax,
    isWhiteElephant: exchange.isWhiteElephant,
    currency: exchange.currency,
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
 * Checks one item's price against the mission's rules.
 *
 * @param price - The item's price in dollars, already parsed (null when missing).
 * @param otherPrices - Prices of the list's other items (excluding the one being saved).
 * @param rules - The mission's rules.
 * @returns An error message for the agent, or null when the price is allowed.
 */
export function checkWishlistPrice(price: number | null, otherPrices: number[], rules: WishlistRules): string | null {
  if (price === null) return 'Every item needs a price. Enter what it costs (an estimate is fine for handmade gifts).';
  if (cents(price) > cents(rules.itemMax)) {
    return `Each item must cost ${money(rules.itemMax)} or less, the mission's spending limit.`;
  }
  if (rules.totalMax !== null) {
    const otherTotal = otherPrices.reduce((sum, p) => sum + cents(p), 0);
    if (otherTotal + cents(price) > cents(rules.totalMax)) {
      return `The Head Elf limits each wishlist to ${money(rules.totalMax)} in total. Your other items come to ${money(otherTotal / 100)}.`;
    }
  }
  return null;
}

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

/** Maps a stored `Item` to the client shape. */
export function toWishlistItemView(item: {
  id: string;
  name: string;
  price: Prisma.Decimal | number;
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  properties: unknown;
}): WishlistItemView {
  return {
    id: item.id,
    title: item.name,
    price: Number(item.price),
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
async function loadMemberWishlist(db: PrismaClient, userId: string, exchangeId: unknown) {
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
  return { rules: wishlistRules(member.exchange), wishlist, items: wishlist.wishlistItems.map((wi) => wi.item), closed: isMissionClosed(member.exchange.status) };
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
export async function getMissionWishlist(db: PrismaClient, userId: string, exchangeId: unknown): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, exchangeId);
  if (!loaded) return NOT_A_MEMBER;
  return {
    status: 200,
    body: {
      success: true,
      wishlist: { id: loaded.wishlist.id, type: loaded.wishlist.type, items: loaded.items.map(toWishlistItemView) },
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
  description?: string;
  thumbnail?: string;
  properties?: { isPersonalized?: boolean; details?: unknown[]; [key: string]: unknown };
}

/**
 * POST /api/wishlist: adds an item to the caller's list for one mission.
 */
export async function addWishlistItem(db: PrismaClient, userId: string, input: WishlistItemInput): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, input.exchangeId);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;

  if (loaded.rules.isWhiteElephant && loaded.items.length >= 1) {
    return { status: 400, body: { error: '🐘 A White Elephant list holds exactly 1 gift, the one you are bringing.' } };
  }

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
  const priceError = checkWishlistPrice(price, loaded.items.map((i) => Number(i.price)), loaded.rules);
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
      wishlistItems: { create: { wishlistId: loaded.wishlist.id } },
    },
  });
  await learnCatalogDetails(db, data.url, data.properties?.details ?? []);

  return { status: 200, body: { success: true, item: toWishlistItemView(item) } };
}

/**
 * PATCH /api/wishlist: edits one item on the caller's list for one mission. Fields left out are
 * kept; the resulting price must still satisfy the mission's rules.
 */
export async function updateWishlistItem(db: PrismaClient, userId: string, input: WishlistItemInput): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, input.exchangeId);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;
  const existing = loaded.items.find((i) => i.id === input.itemId);
  if (!existing) return { status: 404, body: { error: 'That item is not on your list for this mission.' } };

  const price = input.price !== undefined ? parsePrice(input.price) : parsePrice(Number(existing.price));
  const others = loaded.items.filter((i) => i.id !== existing.id).map((i) => Number(i.price));
  const priceError = checkWishlistPrice(price, others, loaded.rules);
  if (priceError) return { status: 400, body: { error: priceError } };

  const existingProps = existing.properties && typeof existing.properties === 'object'
    ? (existing.properties as Record<string, unknown>)
    : {};
  const isPersonalized = input.properties?.isPersonalized !== undefined
    ? Boolean(input.properties.isPersonalized)
    : Boolean(existingProps.isPersonalized || !existing.url);
  const details = Array.isArray(input.properties?.details) ? sanitizeItemDetails(input.properties.details) : undefined;

  const data: Prisma.ItemUpdateInput = { price: price as number };
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

  return { status: 200, body: { success: true, item: toWishlistItemView(updated) } };
}

/**
 * DELETE /api/wishlist?exchangeId=…&itemId=…: removes one item from the caller's list.
 */
export async function removeWishlistItem(db: PrismaClient, userId: string, exchangeId: unknown, itemId: unknown): Promise<WishlistResult> {
  const loaded = await loadMemberWishlist(db, userId, exchangeId);
  if (!loaded) return NOT_A_MEMBER;
  if (loaded.closed) return MISSION_CLOSED_RESULT;
  if (!loaded.items.some((i) => i.id === itemId)) {
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
 * @returns The handler's result, or 405 for any other method.
 */
export async function handleWishlistRequest(
  db: PrismaClient,
  userId: string,
  method: string,
  searchParams: URLSearchParams,
  readBody: () => Promise<unknown>
): Promise<WishlistResult> {
  switch (method) {
    case 'GET':
      return getMissionWishlist(db, userId, searchParams.get('exchangeId'));
    case 'POST':
      return addWishlistItem(db, userId, ((await readBody()) ?? {}) as WishlistItemInput);
    case 'PATCH':
      return updateWishlistItem(db, userId, ((await readBody()) ?? {}) as WishlistItemInput);
    case 'DELETE':
      return removeWishlistItem(db, userId, searchParams.get('exchangeId'), searchParams.get('itemId'));
    default:
      return { status: 405, body: { error: 'Method not allowed' } };
  }
}
