import { NextResponse } from 'next/server';
import { verifyAdminSession, clearAdminSessionCookie } from '@/lib/adminAuth';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ authenticated: false, error: 'Unauthorized administrative session' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      admin,
    });
  } catch (error) {
    console.error('North Pole session error:', error);
    return NextResponse.json({ error: 'Failed to retrieve admin session' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearAdminSessionCookie();
    return NextResponse.json({ success: true, message: 'North Pole session terminated' });
  } catch {
    return NextResponse.json({ error: 'Failed to logout admin' }, { status: 500 });
  }
}
