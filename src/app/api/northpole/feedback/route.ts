/**
 * @file route.ts
 * @description `/api/northpole/feedback`: the admin feedback triage list (self-hosted edition).
 *
 * Tier 1 (what): GET lists feedback (`?status=`, `?type=`), PATCH sets a triage status
 * (`{ id, status }`), DELETE removes one (`?id=`).
 * Tier 2 (why): The edge worker serves the same path in SaaS; both delegate to `@/lib/feedback`.
 * Tier 3 (how): Admin session required; queries run through the owner-role `adminDb`.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { deleteFeedback, listFeedback, updateFeedbackStatus } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

/** Lists feedback, newest first. */
export async function GET(request: Request) {
  try {
    if (!(await verifyAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const result = await listFeedback(adminDb, { status: params.get('status'), type: params.get('type') });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[NorthPole Feedback] list failed:', error);
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
  }
}

/** Sets a submission's triage status: `{ id, status }`. */
export async function PATCH(request: Request) {
  try {
    if (!(await verifyAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
    const result = await updateFeedbackStatus(adminDb, { id: body.id, status: body.status });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[NorthPole Feedback] update failed:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

/** Deletes one submission: `?id=`. */
export async function DELETE(request: Request) {
  try {
    if (!(await verifyAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await deleteFeedback(adminDb, new URL(request.url).searchParams.get('id'));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[NorthPole Feedback] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
