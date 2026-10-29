import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { buildSystemConfigUpdate } from '@/lib/config/systemConfigUpdate';
import { validatePlatformSettings } from '@/lib/platform-limits';
import { IS_SAAS } from '@/lib/config/mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let config = await adminDb.systemConfig.findUnique({
      where: { id: 'singleton' },
      include: { activeTheme: true },
    });

    if (!config) {
      // Auto-initialize default singleton config if missing
      const defaultTheme = await adminDb.themePreset.findFirst({
        where: { id: 'winter_holiday' },
      });

      config = await adminDb.systemConfig.create({
        data: {
          id: 'singleton',
          activeThemeId: defaultTheme ? defaultTheme.id : 'winter_holiday',
          activeSeason: 'auto',
          announcementBannerActive: true,
          maintenanceMode: false,
          freeAnnualHostAllowance: 1,
          freeAnnualJoinAllowance: 3,
          paidEventPriceUsd: 5.0,
          maxFreeParticipants: 25,
          maxWishlistItems: 20,
          defaultBudgetMin: 0.0,
          defaultBudgetMax: 50.0,
          defaultCurrency: 'USD',
          appMode: IS_SAAS ? 'saas' : 'selfhosted',
          altHome: '',
          emailProvider: 'auto',
          emailFrom: 'admin@kovertklaus.com',
          emailFromName: 'KovertKlaus HQ',
          lifecycleCronEnabled: true,
          lifecycleCronIntervalMinutes: 60,
        },
        include: { activeTheme: true },
      });
    }

    const themes = await adminDb.themePreset.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const [totalUsers, totalOperations, totalLeads, workshopUsersCount, approvedLeadsCount] = await Promise.all([
      adminDb.user.count(),
      adminDb.exchange.count(),
      adminDb.clearanceLead.count(),
      adminDb.user.count({ where: { isWorkshop: true } }),
      adminDb.clearanceLead.count({ where: { status: 'APPROVED' } }),
    ]);

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        appMode: IS_SAAS ? 'saas' : 'selfhosted',
      },
      themes,
      stats: {
        totalUsers,
        totalOperations,
        totalLeads,
        workshopUsersCount,
        approvedLeadsCount,
      },
    });
  } catch (error: any) {
    console.error('Failed to get admin config:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch configuration' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const invalid = validatePlatformSettings(body);
    if (invalid.length > 0) {
      return NextResponse.json({ error: invalid.join(' '), details: invalid }, { status: 400 });
    }
    const updateData = buildSystemConfigUpdate(body, admin.id);

    const updatedConfig = await adminDb.systemConfig.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: {
        id: 'singleton',
        activeThemeId: (updateData.activeThemeId as string | undefined) || 'winter_holiday',
        ...updateData,
      },
      include: { activeTheme: true },
    });

    return NextResponse.json({
      success: true,
      message: 'System configuration updated successfully',
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error('Failed to update admin config:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update configuration' }, { status: 500 });
  }
}
