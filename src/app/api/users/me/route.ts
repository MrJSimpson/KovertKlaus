import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId, clearSessionCookie } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        demerits: true,
        accountStatus: true,
        createdAt: true,
        participations: {
          include: {
            mission: {
              select: {
                id: true,
                title: true,
                code: true,
                budgetMin: true,
                budgetMax: true,
                currency: true,
                executionDate: true,
                status: true,
                opsLeader: {
                  select: { name: true, codename: true },
                },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
        wishlists: {
          include: {
            wishlistItems: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      await clearSessionCookie();
      return NextResponse.json({ authenticated: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
