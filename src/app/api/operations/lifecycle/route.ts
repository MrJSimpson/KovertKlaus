import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { executeLifecycleSweep } from '@/lib/lifecycle-scheduler';

export async function POST() {
  try {
    const summary = await executeLifecycleSweep('manual', db, adminDb);
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
