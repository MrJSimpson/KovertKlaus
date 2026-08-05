import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { validatePassword, sanitizeText } from '@/lib/security';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        codename: true,
        streetAddress: true,
        addressLine2: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        deliveryNotes: true,
        shirtSize: true,
        topHalfSize: true,
        bottomHalfSize: true,
        shoeSize: true,
        chestBustMeasurement: true,
        waistMeasurement: true,
        inseamMeasurement: true,
        favoriteColors: true,
        allergiesDiet: true,
        dislikes: true,
        favoriteHobbies: true,
        allowOperatorViewSizes: true,
        allowOperatorViewMeasurements: true,
        allowOperatorViewAllergies: true,
        allowOperatorViewFavorites: true,
        demerits: true,
        accountStatus: true,
        emailNotifications: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    const body = await request.json();
    const userId = sessionUserId || body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const {
      name,
      codename,
      streetAddress,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      deliveryNotes,
      shirtSize,
      topHalfSize,
      bottomHalfSize,
      shoeSize,
      chestBustMeasurement,
      waistMeasurement,
      inseamMeasurement,
      favoriteColors,
      allergiesDiet,
      dislikes,
      favoriteHobbies,
      allowOperatorViewSizes,
      allowOperatorViewMeasurements,
      allowOperatorViewAllergies,
      allowOperatorViewFavorites,
      emailNotifications,
      currentPassword,
      newPassword,
    } = body;

    // Build update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = sanitizeText(name);
    if (codename !== undefined) {
      // Strip legacy Agent- prefix if provided
      let cleanCodename = sanitizeText(codename).replace(/^(agent[-:\s]+)/i, '').trim();
      updateData.codename = cleanCodename || null;
    }

    if (streetAddress !== undefined) updateData.streetAddress = sanitizeText(streetAddress) || null;
    if (addressLine2 !== undefined) updateData.addressLine2 = sanitizeText(addressLine2) || null;
    if (city !== undefined) updateData.city = sanitizeText(city) || null;
    if (state !== undefined) updateData.state = sanitizeText(state) || null;
    if (zipCode !== undefined) updateData.zipCode = sanitizeText(zipCode) || null;
    if (country !== undefined) updateData.country = sanitizeText(country) || 'US';
    if (deliveryNotes !== undefined) updateData.deliveryNotes = sanitizeText(deliveryNotes) || null;

    if (topHalfSize !== undefined) updateData.topHalfSize = sanitizeText(topHalfSize) || null;
    if (bottomHalfSize !== undefined) updateData.bottomHalfSize = sanitizeText(bottomHalfSize) || null;
    if (shoeSize !== undefined) updateData.shoeSize = sanitizeText(shoeSize) || null;
    if (shirtSize !== undefined) updateData.shirtSize = sanitizeText(shirtSize) || null;

    if (chestBustMeasurement !== undefined) updateData.chestBustMeasurement = sanitizeText(chestBustMeasurement) || null;
    if (waistMeasurement !== undefined) updateData.waistMeasurement = sanitizeText(waistMeasurement) || null;
    if (inseamMeasurement !== undefined) updateData.inseamMeasurement = sanitizeText(inseamMeasurement) || null;

    if (favoriteColors !== undefined) updateData.favoriteColors = sanitizeText(favoriteColors) || null;
    if (allergiesDiet !== undefined) updateData.allergiesDiet = sanitizeText(allergiesDiet) || null;
    if (dislikes !== undefined) updateData.dislikes = sanitizeText(dislikes) || null;
    if (favoriteHobbies !== undefined) updateData.favoriteHobbies = sanitizeText(favoriteHobbies) || null;

    if (allowOperatorViewSizes !== undefined) updateData.allowOperatorViewSizes = Boolean(allowOperatorViewSizes);
    if (allowOperatorViewMeasurements !== undefined) updateData.allowOperatorViewMeasurements = Boolean(allowOperatorViewMeasurements);
    if (allowOperatorViewAllergies !== undefined) updateData.allowOperatorViewAllergies = Boolean(allowOperatorViewAllergies);
    if (allowOperatorViewFavorites !== undefined) updateData.allowOperatorViewFavorites = Boolean(allowOperatorViewFavorites);

    if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);

    // Password Update Logic
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
      }

      const dbUser = await db.user.findUnique({ where: { id: userId } });
      if (!dbUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const match = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const passVal = validatePassword(newPassword);
      if (!passVal.isValid) {
        return NextResponse.json({ error: passVal.error }, { status: 400 });
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        codename: true,
        streetAddress: true,
        addressLine2: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        deliveryNotes: true,
        shirtSize: true,
        topHalfSize: true,
        bottomHalfSize: true,
        shoeSize: true,
        chestBustMeasurement: true,
        waistMeasurement: true,
        inseamMeasurement: true,
        favoriteColors: true,
        allergiesDiet: true,
        dislikes: true,
        favoriteHobbies: true,
        allowOperatorViewSizes: true,
        allowOperatorViewMeasurements: true,
        allowOperatorViewAllergies: true,
        allowOperatorViewFavorites: true,
        demerits: true,
        accountStatus: true,
        emailNotifications: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}
