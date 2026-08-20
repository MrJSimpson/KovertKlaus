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
    const query = searchParams.get('q')?.trim() || '';

    const whereClause: any = {};
    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ];
    }

    const operations = await adminDb.exchange.findMany({
      where: whereClause,
      include: {
        organizer: {
          select: { id: true, name: true, email: true, codename: true },
        },
        _count: {
          select: {
            members: true,
            exclusionRules: true,
            messages: true,
            reports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      operations: operations.map((op) => ({
        id: op.id,
        title: op.title,
        code: op.code,
        status: op.status,
        giftingType: op.giftingType,
        isWhiteElephant: op.isWhiteElephant,
        isLocalOnly: op.isLocalOnly,
        budgetMin: op.budgetMin ? Number(op.budgetMin) : 0,
        budgetMax: Number(op.budgetMax),
        currency: op.currency,
        inviteCutoffDate: op.inviteCutoffDate,
        assignmentDate: op.assignmentDate,
        shippingDate: op.shippingDate,
        executionDate: op.executionDate,
        organizer: op.organizer,
        membersCount: op._count.members,
        rulesCount: op._count.exclusionRules,
        messagesCount: op._count.messages,
        reportsCount: op._count.reports,
        createdAt: op.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Failed to list operations:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list operations' }, { status: 500 });
  }
}
