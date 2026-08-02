import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOperationConfig, CreateOperationInput } from '@/lib/validations/operation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const operations = await db.mission.findMany({
      where: {
        OR: [
          { opsLeaderId: userId },
          { agents: { some: { userId } } },
        ],
      },
      include: {
        opsLeader: {
          select: { id: true, name: true, codename: true },
        },
        agents: {
          select: { id: true, userId: true, role: true, shippingStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: operations });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, config } = body as { userId: string; config: CreateOperationInput };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Validate Configuration
    const validation = validateOperationConfig(config);
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    // Check SaaS Quota & Monetization Rule (1 free per calendar year)
    const isSaasMode = process.env.NEXT_PUBLIC_SAAS_MODE === 'true';
    let paymentStatus: 'FREE_ANNUAL' | 'PAID' | 'EXEMPT_SELF_HOSTED' = 'EXEMPT_SELF_HOSTED';
    let isFreeAnnualOp = false;

    if (isSaasMode) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const existingAnnualOp = await db.mission.findFirst({
        where: {
          opsLeaderId: userId,
          createdAt: {
            gte: startOfYear,
            lte: endOfYear,
          },
          isFreeAnnualOp: true,
        },
      });

      if (!existingAnnualOp) {
        // First Operation of the year is FREE!
        paymentStatus = 'FREE_ANNUAL';
        isFreeAnnualOp = true;
      } else {
        // Subsequent Operations in the same year require $5 payment
        paymentStatus = 'PAID';
        isFreeAnnualOp = false;
      }
    }

    // Generate Unique Invite Code (e.g. KOVERT-9481)
    const inviteCode = `KOVERT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create Operation Transaction
    const newOperation = await db.mission.create({
      data: {
        title: config.title.trim(),
        description: config.description?.trim(),
        code: inviteCode,
        opsLeaderId: userId,
        maxParticipants: config.maxParticipants,
        giftingType: config.giftingType,
        isLocalOnly: config.isLocalOnly,
        eventLocation: config.eventLocation?.trim(),
        isWhiteElephant: config.isWhiteElephant,
        budgetMin: config.budgetMin,
        budgetMax: config.budgetMax,
        currency: config.currency || 'USD',
        inviteCutoffDate: new Date(config.inviteCutoffDate),
        assignmentDate: new Date(config.assignmentDate),
        shippingDate: config.shippingDate ? new Date(config.shippingDate) : null,
        executionDate: new Date(config.executionDate),
        isFreeAnnualOp,
        paymentStatus,
        agents: {
          create: {
            userId,
            role: 'OPS_LEADER',
          },
        },
      },
      include: {
        opsLeader: {
          select: { id: true, name: true, codename: true },
        },
        agents: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: newOperation,
      quotaInfo: {
        isSaasMode,
        isFreeAnnualOp,
        paymentStatus,
        requiresPayment: isSaasMode && paymentStatus === 'PAID',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 });
  }
}
