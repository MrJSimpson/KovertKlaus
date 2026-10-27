/**
 * @file route.ts
 * @description `/api/feedback`: in-app feedback from signed-in agents (self-hosted edition).
 *
 * Tier 1 (what): POST stores `{ type, message, pageUrl }` for the signed-in agent.
 * Tier 2 (why): The edge worker serves the same path in SaaS; both delegate to `@/lib/feedback`
 * so the rules live in one place.
 * Tier 3 (how): The browser string comes from the request header, the app version from the
 * server build; the client sends neither.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { submitFeedback } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

/** Stores one piece of feedback: `{ type, message, pageUrl? }`. */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { type?: unknown; message?: unknown; pageUrl?: unknown };
    const result = await submitFeedback(db, {
      userId,
      type: body.type,
      message: body.message,
      pageUrl: body.pageUrl,
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Feedback] submit failed:', error);
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
  }
}
