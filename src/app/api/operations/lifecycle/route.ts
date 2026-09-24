import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { executeLifecycleSweep } from '@/lib/lifecycle-scheduler';

export async function POST(request: Request) {
  try {
    // 1. Dual Authorization: Active North Pole Admin Session OR Cron Secret Header
    const admin = await verifyAdminSession();
    const headerList = await headers();
    const authHeader = headerList.get('authorization')?.replace(/^Bearer\s+/i, '');
    const cronHeader = headerList.get('x-cron-secret');
    const expectedCronSecret = process.env.CRON_SECRET;

    const isCronAuthorized = Boolean(
      expectedCronSecret &&
      (authHeader === expectedCronSecret || cronHeader === expectedCronSecret)
    );

    if (!admin && !isCronAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid North Pole administrator session or authorized CRON_SECRET required.' },
        { status: 401 }
      );
    }

    const triggerSource = admin ? 'manual' : 'scheduler';
    const summary = await executeLifecycleSweep(triggerSource, db, adminDb);
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
