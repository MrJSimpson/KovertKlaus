import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getSessionUserId, clearSessionCookie } from '@/lib/auth';
import { sanitizeText, validatePassword } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const paramUserId = searchParams.get('userId');
    const sessionUserId = await getSessionUserId();
    const userId = sessionUserId || paramUserId;

    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        streetAddress: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        emailNotifications: true,
        penaltyPoints: true,
        accountStatus: true,
        createdAt: true,
        participations: {
          include: {
            exchange: {
              select: {
                id: true,
                title: true,
                code: true,
                isLocalOnly: true,
                isWhiteElephant: true,
                budgetMin: true,
                budgetMax: true,
                currency: true,
                inviteCutoffDate: true,
                assignmentDate: true,
                shippingDate: true,
                executionDate: true,
                status: true,
                organizer: {
                  select: { name: true, codename: true },
                },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
        notifications: {
          where: { isAcknowledged: false },
          orderBy: { createdAt: 'desc' },
        },
        wishlists: {
          include: {
            wishlistItems: {
              include: {
                item: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      await clearSessionCookie();
      return NextResponse.json({ authenticated: false, error: 'User not found' }, { status: 404 });
    }

    // Auto-create default Master OpKit if user has none
    if (user.wishlists.length === 0) {
      await db.wishlist.create({
        data: {
          userId: user.id,
          name: 'Master OpKit - Secret Santa',
          type: 'STANDARD',
        },
      });

      // Refetch wishlists
      const refetchedWishlists = await db.wishlist.findMany({
        where: { userId: user.id },
        include: {
          wishlistItems: {
            include: { item: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      user = { ...user, wishlists: refetchedWishlists };
    }

    const formattedWishlists = user.wishlists.map((w, idx) => ({
      id: w.id,
      name: w.name,
      isMaster: idx === 0,
      type: w.type,
      createdAt: w.createdAt,
      opTools: w.wishlistItems.map((wi) => ({
        id: wi.item.id,
        title: wi.item.name,
        price: wi.item.price ? Number(wi.item.price) : undefined,
        url: wi.item.url,
        thumbnail: wi.item.thumbnailUrl || undefined,
        description: wi.item.description || undefined,
      })),
    }));

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        ...user,
        demerits: user.penaltyPoints,
        wishlists: formattedWishlists,
      },
    });
  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to retrieve session' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      codename,
      streetAddress,
      city,
      state,
      zipCode,
      country,
      emailNotifications,
      oldPassword,
      newPassword,
    } = body as {
      name?: string;
      codename?: string;
      streetAddress?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      emailNotifications?: boolean;
      oldPassword?: string;
      newPassword?: string;
    };

    const updateData: Record<string, any> = {};

    if (name) updateData.name = sanitizeText(name);
    if (codename) updateData.codename = sanitizeText(codename);
    if (streetAddress !== undefined) updateData.streetAddress = sanitizeText(streetAddress);
    if (city !== undefined) updateData.city = sanitizeText(city);
    if (state !== undefined) updateData.state = sanitizeText(state);
    if (zipCode !== undefined) updateData.zipCode = sanitizeText(zipCode);
    if (country !== undefined) updateData.country = sanitizeText(country);
    if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);

    // Password Update Flow
    if (newPassword) {
      if (!oldPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
      }

      // Verify current password
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const match = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
      }

      // Validate 10-char complexity
      const passCheck = validatePassword(newPassword);
      if (!passCheck.isValid) {
        return NextResponse.json({ error: passCheck.error }, { status: 400 });
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    // Execute Database Update
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        streetAddress: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        emailNotifications: true,
        penaltyPoints: true,
        accountStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account preferences updated successfully',
      user: {
        ...updatedUser,
        demerits: updatedUser.penaltyPoints,
      },
    });
  } catch (error) {
    console.error('Account preferences update error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
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
