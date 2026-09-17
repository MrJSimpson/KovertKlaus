import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { advanceMissionLifecycle } from '@/lib/mission-lifecycle';

export async function POST() {
  try {
    const summary = await advanceMissionLifecycle(db);
    return NextResponse.json({
      success: true,
      message: `Lifecycle evaluated: ${summary.transitionsCount} transition(s) executed across ${summary.missionsCheckedCount} active mission(s).`,
      data: summary,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to advance mission lifecycle';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
