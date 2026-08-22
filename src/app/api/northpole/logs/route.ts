import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';
    const level = searchParams.get('level')?.trim().toUpperCase();
    const category = searchParams.get('category')?.trim().toUpperCase();
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') || '50', 10)));
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        { message: { contains: query, mode: 'insensitive' } },
        { path: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (level && ['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(level)) {
      whereClause.level = level;
    }

    if (category) {
      whereClause.category = category;
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [logs, totalCount, error24hCount, warn24hCount, emailFailures24hCount, totalTableCount] = await Promise.all([
      adminDb.systemLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      adminDb.systemLog.count({ where: whereClause }),
      adminDb.systemLog.count({
        where: { level: 'ERROR', createdAt: { gte: twentyFourHoursAgo } },
      }),
      adminDb.systemLog.count({
        where: { level: 'WARN', createdAt: { gte: twentyFourHoursAgo } },
      }),
      adminDb.systemLog.count({
        where: { category: 'EMAIL', level: 'ERROR', createdAt: { gte: twentyFourHoursAgo } },
      }),
      adminDb.systemLog.count(),
    ]);

    // Estimated table footprint (avg ~450 bytes per row)
    const estimatedSizeBytes = totalTableCount * 450;

    return NextResponse.json({
      success: true,
      logs,
      totalCount,
      metrics: {
        error24hCount,
        warn24hCount,
        emailFailures24hCount,
        totalTableCount,
        estimatedSizeBytes,
        storageCapBytes: 2.5 * 1024 * 1024, // 2.5 MB cap
      },
    });
  } catch (error: any) {
    console.error('[NorthPole Logs GET Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve system logs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: 'purge_by_days' | 'clear_all';
      days?: number;
    };

    const action = body.action || 'purge_by_days';
    const days = body.days || 14;

    let deleteResult;

    if (action === 'clear_all') {
      deleteResult = await adminDb.systemLog.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Successfully purged all ${deleteResult.count} log records.`,
        deletedCount: deleteResult.count,
      });
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    deleteResult = await adminDb.systemLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully purged ${deleteResult.count} log records older than ${days} days.`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('[NorthPole Logs DELETE Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to purge system logs' },
      { status: 500 }
    );
  }
}
