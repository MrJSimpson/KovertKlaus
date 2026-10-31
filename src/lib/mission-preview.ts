/**
 * @file mission-preview.ts
 * @description What someone outside a mission may see when they hold its code.
 *
 * Tier 1 (what): `isMissionInsider` says whether a viewer is the Head Elf or an enrolled agent;
 * `missionPreview` reduces a loaded mission to the fields a would-be agent needs to decide to join.
 * Used by `GET /api/operations?code=` in both the edge worker (SaaS) and the Next route.
 * Tier 2 (why): Anyone holding a mission code, signed in or not, used to receive the roster
 * (codenames), After-Action Reports and the event location. Codes travel in invite links and could
 * be guessed, so outsiders now get a preview only (owner decision 2026-10-31).
 * Tier 3 (how): The preview keeps the timeline, budget, status and type (the join form needs them),
 * the Head Elf by codename only, and a member count. Rosters, reports, Comms, exclusion rules,
 * invite tokens, repair details, the description and the event location are left out. The Head
 * Elf's own member row is kept with its codename alone, so the page can label them.
 */

/** A mission as loaded for `GET /api/operations?code=` (members with `userId` and `codename`). */
export interface PreviewSource {
  id: string;
  code: string;
  title: string;
  status: string;
  organizerId: string;
  giftingType?: string;
  isWhiteElephant: boolean;
  isCovertDelivery: boolean;
  propertyWaiverText?: string | null;
  isLocalOnly: boolean;
  budgetMin: unknown;
  budgetMax: unknown;
  currency: string;
  allowWishlistOverBudget: boolean;
  maxParticipants: number | null;
  inviteCutoffDate: Date | string;
  assignmentDate: Date | string;
  shippingDate: Date | string | null;
  executionDate: Date | string;
  members: { id: string; userId: string; codename: string | null }[];
}

/**
 * Whether the viewer belongs to the mission: its Head Elf or an enrolled agent.
 *
 * @param mission - The mission with its members' `userId`s loaded.
 * @param userId - The signed-in viewer, or `null` when signed out.
 */
export function isMissionInsider(mission: Pick<PreviewSource, 'organizerId' | 'members'>, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return mission.organizerId === userId || mission.members.some((m) => m.userId === userId);
}

/**
 * The preview an outsider holding the mission code receives.
 *
 * @param mission - The loaded mission.
 * @returns Response `data` with empty rosters and `preview: true`.
 */
export function missionPreview(mission: PreviewSource) {
  const headElf = mission.members.find((m) => m.userId === mission.organizerId);
  return {
    preview: true as const,
    id: mission.id,
    code: mission.code,
    title: mission.title,
    status: mission.status,
    organizerId: mission.organizerId,
    organizer: { id: mission.organizerId, name: null },
    giftingType: mission.giftingType,
    isWhiteElephant: mission.isWhiteElephant,
    isCovertDelivery: mission.isCovertDelivery,
    propertyWaiverText: mission.propertyWaiverText ?? null,
    isLocalOnly: mission.isLocalOnly,
    budgetMin: mission.budgetMin,
    budgetMax: mission.budgetMax,
    currency: mission.currency,
    allowWishlistOverBudget: mission.allowWishlistOverBudget,
    maxParticipants: mission.maxParticipants,
    memberCount: mission.members.length,
    inviteCutoffDate: mission.inviteCutoffDate,
    assignmentDate: mission.assignmentDate,
    shippingDate: mission.shippingDate,
    executionDate: mission.executionDate,
    members: headElf ? [{ id: headElf.id, userId: headElf.userId, codename: headElf.codename, role: 'ORGANIZER' as const }] : [],
    reports: [],
    exclusionRules: [],
    covertInviteTokens: [],
    repairIssues: null,
  };
}
