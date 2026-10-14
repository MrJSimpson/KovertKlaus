/**
 * @file exchange-view.ts
 * @description The single source for what a Holiday Mission's member list reveals to a viewer.
 *
 * Tier 1 (what): `EXCHANGE_MEMBERS_INCLUDE` is the Prisma include for a mission's members (with
 * each giver's target dossier and Wishlist Manifest), and `sanitizeExchangeMember` reduces one
 * loaded member to what the current viewer may see.
 * Tier 2 (why): The Next.js route (self-hosted) and the edge worker (SaaS) used to build this
 * response separately. The worker's copy dropped the target's Wishlist Manifest, dossier and
 * Covert Delivery fields, so SaaS givers saw an empty target card. One builder keeps both
 * editions identical and keeps the privacy rules in one reviewed place.
 * Tier 3 (how): Addresses, tracking and target details are visible only to the Head Elf and to
 * the member themselves (the giver viewing their own assignment). Dossier fields are further
 * gated by the target's `allowOrganizerView*` toggles unless the viewer is that target's giver.
 */

/** Prisma `include` for `exchange.members` used by the mission detail view. */
export const EXCHANGE_MEMBERS_INCLUDE = {
  user: {
    select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true },
  },
  targetUser: {
    select: {
      id: true,
      name: true,
      codename: true,
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
      wishlists: {
        include: { wishlistItems: { include: { item: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;

/** Who is looking at the mission. */
export interface ExchangeViewer {
  /** Signed-in user ID, or null for an anonymous visitor holding the invite code. */
  activeUserId: string | null;
  /** True when the viewer is the mission's primary Head Elf. */
  isOrganizer: boolean;
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
    codename: m.codename || m.user.codename,
    role: m.role,
    // Only whether a manifest is attached matters to other viewers; the ID grants nothing (writes check ownership).
    wishlistId: m.wishlistId ?? null,
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
      name: m.user.name,
      codename: m.codename || m.user.codename,
      streetAddress: canViewDetails ? m.user.streetAddress : null,
      city: canViewDetails ? m.user.city : null,
      state: canViewDetails ? m.user.state : null,
      zipCode: canViewDetails ? m.user.zipCode : null,
    },
    targetUserId: canViewDetails ? m.targetUserId : null,
    targetUser: canViewDetails ? sanitizeTarget(m.targetUser, isSelf) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTarget(t: any, viewerIsGiver: boolean) {
  if (!t) return null;
  const wishlist = t.wishlists?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wishlistItems = (wishlist?.wishlistItems ?? []).map((wi: any) => ({
    id: wi.item.id,
    title: wi.item.name,
    price: wi.item.price ? Number(wi.item.price) : undefined,
    url: wi.item.url,
    thumbnail: wi.item.thumbnailUrl || undefined,
    description: wi.item.description || undefined,
    properties: wi.item.properties || undefined,
  }));
  const sizes = t.allowOrganizerViewSizes || viewerIsGiver;
  const measurements = t.allowOrganizerViewMeasurements || viewerIsGiver;
  const favorites = t.allowOrganizerViewFavorites || viewerIsGiver;
  const allergies = t.allowOrganizerViewAllergies || viewerIsGiver;

  return {
    id: t.id,
    name: t.name,
    codename: t.codename,
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
