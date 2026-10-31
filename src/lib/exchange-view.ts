/**
 * @file exchange-view.ts
 * @description The single source for what a Holiday Mission's member list reveals to a viewer.
 *
 * Tier 1 (what): `EXCHANGE_MEMBERS_INCLUDE` is the Prisma include for a mission's members (with
 * each member's Wishlist Manifest and each giver's target dossier), and `sanitizeExchangeMember`
 * reduces one loaded member to what the current viewer may see. A giver sees their target's list
 * for this mission only (`memberWishlistMap`); lists belong to the membership, not the account.
 * Tier 2 (why): The Next.js route (self-hosted) and the edge worker (SaaS) used to build this
 * response separately. The worker's copy dropped the target's Wishlist Manifest, dossier and
 * Covert Delivery fields, so SaaS givers saw an empty target card. One builder keeps both
 * editions identical and keeps the privacy rules in one reviewed place.
 * Tier 3 (how): `role` comes from `Exchange.organizerId` (one Head Elf per mission). Addresses, tracking and target details are visible only to the Head Elf and to
 * the member themselves (the giver viewing their own assignment). Real names follow `canSeeRealName`:
 * the Head Elf sees every agent's name (to confirm who joined), an agent sees their own and the
 * Head Elf's, and everyone else is known by codename. A giver still gets their target's name in
 * the target dossier, because the package needs a recipient name. Dossier fields are further
 * gated by the target's `allowOrganizerView*` toggles unless the viewer is that target's giver.
 */

import { toWishlistItemView, type WishlistItemView } from '@/lib/mission-wishlist';

/** Prisma `include` for `exchange.members` used by the mission detail view. */
export const EXCHANGE_MEMBERS_INCLUDE = {
  user: {
    select: { id: true, name: true, streetAddress: true, city: true, state: true, zipCode: true },
  },
  targetUser: {
    select: {
      id: true,
      name: true,
      streetAddress: true,
      city: true,
      state: true,
      zipCode: true,
      shirtSize: true,
      topHalfSize: true,
      bottomHalfSize: true,
      shoeSize: true,
      chestBustMeasurement: true,
      waistMeasurement: true,
      inseamMeasurement: true,
      favoriteColors: true,
      allergiesDiet: true,
      dislikes: true,
      favoriteHobbies: true,
      allowOrganizerViewSizes: true,
      allowOrganizerViewMeasurements: true,
      allowOrganizerViewAllergies: true,
      allowOrganizerViewFavorites: true,
    },
  },
  wishlist: {
    include: { wishlistItems: { include: { item: true }, orderBy: { item: { createdAt: 'asc' as const } } } },
  },
} as const;

/** Who is looking at the mission. */
export interface ExchangeViewer {
  /** Signed-in user ID, or null for an anonymous visitor holding the invite code. */
  activeUserId: string | null;
  /** True when the viewer is the mission's Head Elf. */
  isOrganizer: boolean;
  /** The mission's Head Elf (`Exchange.organizerId`). */
  organizerId: string;
  /** Mission codename by user ID, used to label a giver's target. Codenames belong to the mission, not the user. */
  memberCodenames?: Record<string, string | null>;
  /** Each member's list for this mission by user ID, used to show a giver their target's items. */
  memberWishlists?: Record<string, WishlistItemView[]>;
}

/** Builds `ExchangeViewer.memberCodenames` from a mission's loaded members. */
export function memberCodenameMap(members: { userId: string; codename: string | null }[]): Record<string, string | null> {
  return Object.fromEntries(members.map((m) => [m.userId, m.codename]));
}

/**
 * Builds `ExchangeViewer.memberWishlists` from a mission's loaded members (see `EXCHANGE_MEMBERS_INCLUDE`).
 *
 * @param members - Members with `wishlist.wishlistItems.item` loaded.
 * @returns Item views by user ID; members without a list map to an empty array.
 */
export function memberWishlistMap(
  members: { userId: string; wishlist?: { wishlistItems: { item: Parameters<typeof toWishlistItemView>[0]; quantity?: number }[] } | null }[]
): Record<string, WishlistItemView[]> {
  return Object.fromEntries(members.map((m) => [m.userId, (m.wishlist?.wishlistItems ?? []).map((wi) => toWishlistItemView(wi.item, wi.quantity))]));
}

/**
 * Whether `viewer` may see the real name of the agent with `userId`. Only the Head Elf sees every
 * agent's name; an agent sees their own and the Head Elf's (owner decision 2026-10-30).
 */
export function canSeeRealName(viewer: ExchangeViewer, userId: string): boolean {
  return viewer.isOrganizer || userId === viewer.activeUserId || userId === viewer.organizerId;
}

/** After-Action Report as loaded with `include: { user: { select: { id, name } } }`. */
interface LoadedReport {
  userId: string;
  user: { id: string; name: string };
}

/**
 * Reduces a mission's After-Action Reports to what `viewer` may see: each author is labelled by
 * codename, and the real name is kept only where `canSeeRealName` allows.
 */
export function sanitizeMissionReports<R extends LoadedReport>(reports: R[], viewer: ExchangeViewer) {
  return reports.map((r) => ({
    ...r,
    user: {
      id: r.user.id,
      name: canSeeRealName(viewer, r.userId) ? r.user.name : null,
      codename: viewer.memberCodenames?.[r.userId] ?? null,
    },
  }));
}

/**
 * Reduces one loaded member (see `EXCHANGE_MEMBERS_INCLUDE`) to what `viewer` may see.
 *
 * @param m - Member row with `user` and `targetUser` included.
 * @param viewer - The current viewer.
 * @returns The client-facing member object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeExchangeMember(m: any, viewer: ExchangeViewer) {
  const isSelf = Boolean(viewer.activeUserId && m.userId === viewer.activeUserId);
  const canViewDetails = viewer.isOrganizer || isSelf;

  return {
    id: m.id,
    userId: m.userId,
    codename: m.codename,
    // Only the agent sees whether their own codename is accepted; until then they may reroll it.
    codenameAccepted: isSelf ? Boolean(m.codenameAcceptedAt) : undefined,
    // A mission has exactly one Head Elf. Older rows may carry ORGANIZER from the retired
    // promote action, so the role is derived from the mission rather than read from the row.
    role: m.userId === viewer.organizerId ? 'ORGANIZER' : 'MEMBER',
    // Only whether a manifest is attached matters to other viewers; the ID grants nothing (writes check ownership).
    wishlistId: m.wishlist?.id ?? null,
    shippingStatus: m.shippingStatus,
    trackingNumber: canViewDetails ? m.trackingNumber : undefined,
    shippedAt: m.shippedAt,
    deliveredConfirmed: m.deliveredConfirmed,
    joinedAt: m.joinedAt,
    propertyWaiverAgreedAt: m.propertyWaiverAgreedAt,
    dropProofPhotoUrl: m.dropProofPhotoUrl,
    dropProofNote: canViewDetails ? m.dropProofNote : undefined,
    droppedAt: m.droppedAt,
    targetGuessName: canViewDetails ? m.targetGuessName : undefined,
    targetGuessAttempted: m.targetGuessAttempted,
    targetGuessCorrect: m.targetGuessCorrect,
    detectionStatus: m.detectionStatus,
    bustedPhotoUrl: m.bustedPhotoUrl,
    bustedReason: m.bustedReason,
    badgeAwarded: m.badgeAwarded,
    user: {
      id: m.user.id,
      name: canSeeRealName(viewer, m.userId) ? m.user.name : null,
      codename: m.codename,
      streetAddress: canViewDetails ? m.user.streetAddress : null,
      city: canViewDetails ? m.user.city : null,
      state: canViewDetails ? m.user.state : null,
      zipCode: canViewDetails ? m.user.zipCode : null,
    },
    targetUserId: canViewDetails ? m.targetUserId : null,
    targetUser: canViewDetails ? sanitizeTarget(m.targetUser, isSelf, viewer.memberCodenames, viewer.memberWishlists) : null,
  };
}

function sanitizeTarget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any,
  viewerIsGiver: boolean,
  memberCodenames: Record<string, string | null> = {},
  memberWishlists: Record<string, WishlistItemView[]> = {}
) {
  if (!t) return null;
  const wishlistItems = memberWishlists[t.id] ?? [];
  const sizes = t.allowOrganizerViewSizes || viewerIsGiver;
  const measurements = t.allowOrganizerViewMeasurements || viewerIsGiver;
  const favorites = t.allowOrganizerViewFavorites || viewerIsGiver;
  const allergies = t.allowOrganizerViewAllergies || viewerIsGiver;

  return {
    id: t.id,
    name: t.name,
    codename: memberCodenames[t.id] ?? null,
    streetAddress: t.streetAddress,
    city: t.city,
    state: t.state,
    zipCode: t.zipCode,
    topHalfSize: sizes ? t.topHalfSize || t.shirtSize : undefined,
    bottomHalfSize: sizes ? t.bottomHalfSize : undefined,
    shoeSize: sizes ? t.shoeSize : undefined,
    chestBustMeasurement: measurements ? t.chestBustMeasurement : undefined,
    waistMeasurement: measurements ? t.waistMeasurement : undefined,
    inseamMeasurement: measurements ? t.inseamMeasurement : undefined,
    favoriteColors: favorites ? t.favoriteColors : undefined,
    allergiesDiet: allergies ? t.allergiesDiet : undefined,
    favoriteHobbies: favorites ? t.favoriteHobbies : undefined,
    wishlistItems,
  };
}
