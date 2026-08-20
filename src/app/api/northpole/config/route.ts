import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';

export const dynamic = 'force-static';

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
          maxWishlistItems: 50,
          defaultBudgetMin: 0.0,
          defaultBudgetMax: 50.0,
          defaultCurrency: 'USD',
          appMode: 'selfhosted',
          altHome: '',
          emailProvider: 'auto',
          emailFrom: 'admin@kovertklaus.com',
          emailFromName: 'KovertKlaus HQ',
        },
        include: { activeTheme: true },
      });
    }

    const themes = await adminDb.themePreset.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const [totalUsers, totalOperations, totalLeads, workshopUsersCount] = await Promise.all([
      adminDb.user.count(),
      adminDb.exchange.count(),
      adminDb.clearanceLead.count(),
      adminDb.user.count({ where: { isWorkshop: true } }),
    ]);

    return NextResponse.json({
      success: true,
      config,
      themes,
      stats: {
        totalUsers,
        totalOperations,
        totalLeads,
        workshopUsersCount,
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
    const {
      activeThemeId,
      activeSeason,
      announcementBannerActive,
      maintenanceMode,
      maintenanceMessage,
      altHome,
      appMode,
      emailProvider,
      emailFrom,
      emailFromName,
      brevoApiKey,
      brevoSenderEmail,
      brevoSenderName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpSecure,
      smtpFrom,
      resendApiKey,
      freeAnnualHostAllowance,
      freeAnnualJoinAllowance,
      paidEventPriceUsd,
      maxFreeParticipants,
      maxWishlistItems,
      defaultBudgetMin,
      defaultBudgetMax,
      defaultCurrency,
    } = body;

    const updateData: Record<string, any> = {
      updatedByAdminId: admin.id,
    };

    if (activeThemeId !== undefined) updateData.activeThemeId = activeThemeId;
    if (activeSeason !== undefined) updateData.activeSeason = activeSeason;
    if (announcementBannerActive !== undefined) updateData.announcementBannerActive = Boolean(announcementBannerActive);
    if (maintenanceMode !== undefined) updateData.maintenanceMode = Boolean(maintenanceMode);
    if (maintenanceMessage !== undefined) updateData.maintenanceMessage = maintenanceMessage;
    if (altHome !== undefined) updateData.altHome = altHome;
    if (appMode !== undefined) updateData.appMode = appMode;

    if (emailProvider !== undefined) updateData.emailProvider = emailProvider;
    if (emailFrom !== undefined) updateData.emailFrom = emailFrom;
    if (emailFromName !== undefined) updateData.emailFromName = emailFromName;
    if (brevoApiKey !== undefined) updateData.brevoApiKey = brevoApiKey;
    if (brevoSenderEmail !== undefined) updateData.brevoSenderEmail = brevoSenderEmail;
    if (brevoSenderName !== undefined) updateData.brevoSenderName = brevoSenderName;
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort ? Number(smtpPort) : 587;
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser;
    if (smtpPass !== undefined) updateData.smtpPass = smtpPass;
    if (smtpSecure !== undefined) updateData.smtpSecure = Boolean(smtpSecure);
    if (smtpFrom !== undefined) updateData.smtpFrom = smtpFrom;
    if (resendApiKey !== undefined) updateData.resendApiKey = resendApiKey;

    if (freeAnnualHostAllowance !== undefined) updateData.freeAnnualHostAllowance = Number(freeAnnualHostAllowance);
    if (freeAnnualJoinAllowance !== undefined) updateData.freeAnnualJoinAllowance = Number(freeAnnualJoinAllowance);
    if (paidEventPriceUsd !== undefined) updateData.paidEventPriceUsd = Number(paidEventPriceUsd);
    if (maxFreeParticipants !== undefined) updateData.maxFreeParticipants = Number(maxFreeParticipants);
    if (maxWishlistItems !== undefined) updateData.maxWishlistItems = Number(maxWishlistItems);
    if (defaultBudgetMin !== undefined) updateData.defaultBudgetMin = Number(defaultBudgetMin);
    if (defaultBudgetMax !== undefined) updateData.defaultBudgetMax = Number(defaultBudgetMax);
    if (defaultCurrency !== undefined) updateData.defaultCurrency = defaultCurrency;

    const updatedConfig = await adminDb.systemConfig.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: {
        id: 'singleton',
        activeThemeId: activeThemeId || 'winter_holiday',
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
