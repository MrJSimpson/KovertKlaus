import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { sendMissionCancelledEmail } from '@/lib/email';
import { logInfo } from '@/lib/logger';
import { cancelMission, deleteMission } from '@/lib/mission-cancel';

export const dynamic = 'force-dynamic';

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
            select: { id: true, name: true, email: true },
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
                cancelledAt: operation.cancelledAt,
                cancelledBy: operation.cancelledBy,
                cancelledFromStatus: operation.cancelledFromStatus,
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
          select: { id: true, name: true, email: true },
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
        cancelledAt: op.cancelledAt,
        cancelledBy: op.cancelledBy,
        cancelledFromStatus: op.cancelledFromStatus,
      })),
    });
  } catch (error: any) {
    console.error('Failed to list operations:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list operations' }, { status: 500 });
  }
}

/**
 * Cancels (`{ action: 'cancel', operationId, reason? }`) or permanently deletes
 * (`{ action: 'delete', operationId, confirm: true }`) a mission as a North Pole admin.
 * The same rules apply as for the Head Elf (`@/lib/mission-cancel`); agents are told an admin acted.
 */
export async function POST(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { action?: unknown; operationId?: unknown; reason?: unknown; confirm?: unknown };
    let result;
    if (body.action === 'cancel') {
      result = await cancelMission(
        adminDb,
        {
          baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://kovertklaus.com',
          sendEmail: (email) => sendMissionCancelledEmail(email),
        },
        { exchangeId: body.operationId, actor: 'ADMIN', reason: body.reason }
      );
    } else if (body.action === 'delete') {
      result = await deleteMission(adminDb, { exchangeId: body.operationId, actor: 'ADMIN', confirm: body.confirm });
    } else {
      return NextResponse.json({ error: "action must be 'cancel' or 'delete'" }, { status: 400 });
    }

    if (result.status === 200) {
      await logInfo('ADMIN', `Admin ${admin.username || admin.email} ${body.action === 'cancel' ? 'cancelled' : 'deleted'} mission ${String(body.operationId)}`, {
        dbClient: adminDb,
        metadata: { adminId: admin.id, operationId: body.operationId, action: body.action },
        path: '/api/northpole/operations',
        statusCode: 200,
      }).catch(() => {});
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[NorthPole Operations] cancel/delete failed:', error);
    return NextResponse.json({ error: 'Failed to update the mission' }, { status: 500 });
  }
}
