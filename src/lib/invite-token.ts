/**
 * @file invite-token.ts
 * @description The signed token in an emailed mission invitation's link.
 *
 * Tier 1 (what): `issueInviteToken` signs an invitation ID; `readInviteToken` returns it if the
 * signature holds. Whether the invitation is still usable is checked by `join-requests.ts`.
 * Tier 2 (why): Joining by code needs Head Elf approval (owner decision 2026-10-31), but agents the
 * Head Elf invited by email should join directly. The link proves an invitation, not an email
 * address (grandfathered accounts never proved theirs).
 * Tier 3 (how): `invite:<invitationId>` HMAC-signed with a key purpose distinct from sessions and the
 * other emailed links. Its own module so `invitations.ts` and `join-requests.ts` can both use it
 * without importing each other.
 */

import { getSessionSecret, signToken, verifyToken } from '@/lib/security';

function inviteSecret(): string {
  return `${getSessionSecret()}:mission-invite`;
}

/** Signed token for an emailed invitation's link. */
export function issueInviteToken(invitationId: string): string {
  return signToken(`invite:${invitationId}`, inviteSecret());
}

/** The invitation ID if the token's signature holds. */
export function readInviteToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const data = verifyToken(token, inviteSecret());
  if (!data) return null;
  const [kind, id] = data.split(':');
  return kind === 'invite' && id ? id : null;
}
