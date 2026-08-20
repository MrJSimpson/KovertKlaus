import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { AccountStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const filterWorkshop = searchParams.get('workshop'); // 'true' | 'false' | null

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { codename: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (filterWorkshop === 'true') {
      whereClause.isWorkshop = true;
    } else if (filterWorkshop === 'false') {
      whereClause.isWorkshop = false;
    }

    const users = await adminDb.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        penaltyPoints: true,
        accountStatus: true,
        isWorkshop: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdExchanges: true,
            participations: true,
            wishlists: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        codename: u.codename,
        demerits: u.penaltyPoints,
        accountStatus: u.accountStatus,
        isWorkshop: u.isWorkshop,
        createdAt: u.createdAt,
        organizedCount: u._count.createdExchanges,
        joinedCount: u._count.participations,
        wishlistsCount: u._count.wishlists,
      })),
    });
  } catch (error: any) {
    console.error('Failed to list users:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list users' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, isWorkshop, penaltyPoints, accountStatus, codename } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};

    if (isWorkshop !== undefined) {
      updateData.isWorkshop = Boolean(isWorkshop);
    }

    if (penaltyPoints !== undefined) {
      const points = Math.max(0, parseInt(penaltyPoints, 10));
      updateData.penaltyPoints = points;
      // Auto-update status if not explicitly passed
      if (!accountStatus) {
        if (points >= 4) updateData.accountStatus = AccountStatus.DISABLED;
        else if (points === 3) updateData.accountStatus = AccountStatus.REMOTE_RESTRICTED;
        else updateData.accountStatus = AccountStatus.ACTIVE;
      }
    }

    if (accountStatus !== undefined) {
      updateData.accountStatus = accountStatus as AccountStatus;
    }

    if (codename !== undefined) {
      updateData.codename = codename.trim();
    }

    const updatedUser = await adminDb.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        penaltyPoints: true,
        accountStatus: true,
        isWorkshop: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User security parameters updated successfully',
      user: {
        ...updatedUser,
        demerits: updatedUser.penaltyPoints,
      },
    });
  } catch (error: any) {
    console.error('Failed to update user security parameters:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }
}
