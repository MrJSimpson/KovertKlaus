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
    const id = searchParams.get('id')?.trim();
    const code = searchParams.get('code')?.trim().toUpperCase();
    const query = searchParams.get('q')?.trim() || '';

    const totalCount = await adminDb.exchange.count();

    // 1. Exact ID or Code Lookup
    if (id || code) {
      const operation = await adminDb.exchange.findFirst({
        where: id ? { id } : { code },
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
      });

      return NextResponse.json({
        success: true,
        operations: operation
          ? [
              {
                id: operation.id,
                title: operation.title,
                code: operation.code,
                status: operation.status,
                giftingType: operation.giftingType,
                isWhiteElephant: operation.isWhiteElephant,
                isLocalOnly: operation.isLocalOnly,
                budgetMin: operation.budgetMin ? Number(operation.budgetMin) : 0,
                budgetMax: Number(operation.budgetMax),
                currency: operation.currency,
                inviteCutoffDate: operation.inviteCutoffDate,
                assignmentDate: operation.assignmentDate,
                shippingDate: operation.shippingDate,
                executionDate: operation.executionDate,
                organizer: operation.organizer,
                membersCount: operation._count.members,
                rulesCount: operation._count.exclusionRules,
                messagesCount: operation._count.messages,
                reportsCount: operation._count.reports,
                createdAt: operation.createdAt,
              },
            ]
          : [],
        totalCount,
      });
    }

    // 2. Unconstrained initial load -> Zero DB I/O payload
    if (!query) {
      return NextResponse.json({
        success: true,
        operations: [],
        totalCount,
        message: 'Enter an operation code (e.g. KOVERT-87WZ), title, or ID to inspect on demand.',
      });
    }

    const whereClause: any = {};
    if (query) {
      whereClause.OR = [
        { id: { equals: query } },
        { code: { contains: query.toUpperCase() } },
        { title: { contains: query, mode: 'insensitive' } },
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
      take: 25,
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
