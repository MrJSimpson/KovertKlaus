/**
 * @file invitation-client.ts
 * @description Browser side of email invitations: the shape `GET /api/invitations` returns and the
 * call that accepts or declines one.
 *
 * Tier 1 (what): `PendingInvitation` and `answerInvitation`.
 * Tier 2 (why): The dashboard's invitation cards and the Alerts page both answer invitations; one
 * helper keeps the two in step.
 * Tier 3 (how): Accept joins through `POST /api/invitations/accept` (the normal join path, by
 * mission code); decline marks the invitation with `PATCH /api/invitations`. Throws with the
 * server's message when it refuses.
 */

/** One open invitation from `GET /api/invitations`. */
export interface PendingInvitation {
  id: string;
  isLatePass: boolean;
  exchange: {
    id: string;
    title: string;
    code: string;
    executionDate: string;
    budgetMin: number | null;
    budgetMax: number;
    currency: string;
    organizer: { name: string };
  };
}

/** Accepts or declines `inv`; throws an `Error` with a readable message if it fails. */
export async function answerInvitation(inv: PendingInvitation, accept: boolean): Promise<void> {
  const res = accept
    ? await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationCode: inv.exchange.code }),
      })
    : await fetch('/api/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: inv.id, action: 'decline' }),
      });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || (accept ? 'Could not join the mission' : 'Could not decline the invitation'));
}
