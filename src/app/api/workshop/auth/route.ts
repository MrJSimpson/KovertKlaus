import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { verifyAdminSession } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Check if user is an authenticated Admin
    const admin = await verifyAdminSession();
    if (admin) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        isAdmin: true,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'ADMIN',
          isWorkshop: true,
        },
      });
    }

    // 2. Check if user is an authenticated regular site user
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        authorized: false,
        isAdmin: false,
        user: null,
      });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        codename: true,
        isWorkshop: true,
        accountStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        authorized: false,
        isAdmin: false,
        user: null,
      });
    }

    const isAuthorized = Boolean(user.isWorkshop);

    return NextResponse.json({
      authenticated: true,
      authorized: isAuthorized,
      isAdmin: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        codename: user.codename,
        isWorkshop: user.isWorkshop,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error: any) {
    console.error('Workshop authorization check failed:', error);
    return NextResponse.json({ error: 'Failed to verify workshop authorization' }, { status: 500 });
  }
}
