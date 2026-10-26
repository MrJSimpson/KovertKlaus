/**
 * @file member-status.ts
 * @description The status shown on each agent's card in a mission's Command Center roster.
 *
 * Tier 1 (what): `memberCardStatus` picks the card's status from the mission's stage and the agent's
 * shipping state: joined, awaiting shipment, shipped or hand delivery.
 * Tier 2 (why): The card showed shipping status at every stage. Before the draw every agent's
 * `shippingStatus` is still the default `PENDING`, so agents who had accepted read "Pending" (owner
 * report 2026-10-26). Shipping only means something once targets are drawn in a Secret Santa
 * mission; White Elephant gifts are brought, not shipped.
 * Tier 3 (how): Pure function over the fields the roster already has, so it is shared and tested.
 */

/** What the card shows for one agent. */
export type MemberCardStatus = 'JOINED' | 'AWAITING_SHIPMENT' | 'SHIPPED' | 'HAND_DELIVERY';

/** Mission stages after the draw, when Secret Santa gifts are being sent. */
const DRAWN_STATUSES = ['MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED'];

/** The card status for an agent enrolled in a mission. */
export function memberCardStatus(mission: { status: string; isWhiteElephant: boolean }, member: { shippingStatus?: string | null }): MemberCardStatus {
  if (mission.isWhiteElephant || !DRAWN_STATUSES.includes(mission.status)) return 'JOINED';
  if (member.shippingStatus === 'SHIPPED') return 'SHIPPED';
  if (member.shippingStatus === 'LOCAL_DELIVERY') return 'HAND_DELIVERY';
  return 'AWAITING_SHIPMENT';
}
