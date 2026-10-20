import { NextResponse } from 'next/server';
import { comparePassword, hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { getSessionUserId, clearSessionCookie, renewSessionCookieIfStale, setSessionCookie } from '@/lib/auth';
import { sanitizeText, validatePassword } from '@/lib/security';

export const dynamic = 'force-dynamic';

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
                organizerId: true,
                organizer: {
                  select: { name: true },
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
      },
    });

    if (!user) {
      await clearSessionCookie();
      return NextResponse.json({ authenticated: false, error: 'User not found' }, { status: 404 });
    }

    // Sliding expiry: an agent who keeps visiting is never signed out mid-season.
    await renewSessionCookieIfStale();

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        ...user,
        demerits: user.penaltyPoints,
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

      const match = await comparePassword(oldPassword, user.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
      }

      // Validate 10-char complexity
      const passCheck = validatePassword(newPassword);
      if (!passCheck.isValid) {
        return NextResponse.json({ error: passCheck.error }, { status: 400 });
      }

      updateData.passwordHash = await hashPassword(newPassword);
      // Sign out every other device; this one gets a fresh cookie after the update.
      updateData.sessionsRevokedAt = new Date();
    }

    // Execute Database Update
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
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
    if (updateData.sessionsRevokedAt) await setSessionCookie(userId);

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
