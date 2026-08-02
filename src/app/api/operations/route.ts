import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOperationConfig, CreateOperationInput } from '@/lib/validations/operation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const code = searchParams.get('code');

    // Case 1: Fetch single operation by unique invite code (e.g. KOVERT-87WZ)
    if (code) {
      const operation = await db.mission.findUnique({
        where: { code: code.trim().toUpperCase() },
        include: {
          opsLeader: {
            select: { id: true, name: true, codename: true },
          },
          agents: {
            include: {
              user: {
                select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true },
              },
              targetUser: {
                select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true },
              },
            },
          },
        },
      });

      if (!operation) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: operation });
    }

    // Case 2: Fetch all operations enrolled/owned by a user
    if (!userId) {
      return NextResponse.json({ error: 'User ID or Operation Code is required' }, { status: 400 });
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
    const { userId, config, action, operationId } = body as {
      userId: string;
      config?: CreateOperationInput;
      action?: string;
      operationId?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Action: Trigger Sattolo Target Draw for Secret Santa
    if (action === 'draw' && operationId) {
      const op = await db.mission.findUnique({
        where: { id: operationId },
        include: { agents: true },
      });

      if (!op) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      }

      if (op.opsLeaderId !== userId) {
        return NextResponse.json({ error: 'Only the OpsLeader can trigger target draws' }, { status: 403 });
      }

      if (op.agents.length < 2) {
        return NextResponse.json({ error: 'At least 2 agents are required to execute a target draw' }, { status: 400 });
      }

      // Execute Sattolo's Derangement Algorithm
      const agentIds = op.agents.map((a: { id: string; userId: string }) => a.userId);
      const shuffled = [...agentIds];
      
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Update Target Assignments in DB
      for (let i = 0; i < op.agents.length; i++) {
        const agent = op.agents[i];
        const targetUserId = shuffled[i];
        await db.missionAgent.update({
          where: { id: agent.id },
          data: { targetUserId },
        });
      }

      // Update Operation Status to ASSIGNED
      await db.mission.update({
        where: { id: operationId },
        data: { status: 'ASSIGNED' },
      });

      return NextResponse.json({ success: true, message: 'Target assignments completed via Sattolo algorithm' });
    }

    if (!config) {
      return NextResponse.json({ error: 'Configuration input is required' }, { status: 400 });
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
        paymentStatus = 'FREE_ANNUAL';
        isFreeAnnualOp = true;
      } else {
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
        shippingDate: new Date(config.shippingDate),
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, operationId, dates } = body as {
      userId: string;
      operationId: string;
      dates: {
        inviteCutoffDate: string;
        assignmentDate: string;
        shippingDate: string;
        executionDate: string;
      };
    };

    if (!userId || !operationId || !dates) {
      return NextResponse.json({ error: 'userId, operationId, and dates are required' }, { status: 400 });
    }

    const op = await db.mission.findUnique({
      where: { id: operationId },
    });

    if (!op) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    if (op.opsLeaderId !== userId) {
      return NextResponse.json({ error: 'Only the OpsLeader can update operational dates' }, { status: 403 });
    }

    // Validate Date Sequence and Range Limits
    const validation = validateOperationConfig({
      title: op.title,
      giftingType: op.giftingType as any,
      isLocalOnly: op.isLocalOnly,
      isWhiteElephant: op.isWhiteElephant,
      budgetMax: Number(op.budgetMax),
      ...dates,
    });

    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    const updatedOperation = await db.mission.update({
      where: { id: operationId },
      data: {
        inviteCutoffDate: new Date(dates.inviteCutoffDate),
        assignmentDate: new Date(dates.assignmentDate),
        shippingDate: new Date(dates.shippingDate),
        executionDate: new Date(dates.executionDate),
      },
    });

    return NextResponse.json({ success: true, data: updatedOperation });
  } catch {
    return NextResponse.json({ error: 'Failed to update operation dates' }, { status: 500 });
  }
}
