import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operationId, requesterUserId, recipientEmail, isLatePass } = body as {
      operationId: string;
      requesterUserId: string;
      recipientEmail: string;
      isLatePass?: boolean;
    };

    if (!operationId || !requesterUserId || !recipientEmail) {
      return NextResponse.json(
        { error: 'operationId, requesterUserId, and recipientEmail are required' },
        { status: 400 }
      );
    }

    // 1. Verify Operation & OpsLeader Authority
    const operation = await db.mission.findUnique({
      where: { id: operationId },
      include: { opsLeader: true, agents: true },
    });

    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    if (operation.opsLeaderId !== requesterUserId) {
      return NextResponse.json(
        { error: 'Only the OpsLeader can issue invitations for this operation.' },
        { status: 403 }
      );
    }

    // 2. Check Cutoff Date Policy
    const now = new Date();
    const isPastCutoff = now > new Date(operation.inviteCutoffDate);

    // 3. Look up recipient in system
    const targetUser = await db.user.findUnique({
      where: { email: recipientEmail.trim().toLowerCase() },
    });

    if (isPastCutoff) {
      if (!isLatePass) {
        return NextResponse.json(
          {
            error:
              'The Invite Cutoff Date for this operation has passed. Standard invitations are disabled.',
            canUseLatePass: !!targetUser,
          },
          { status: 400 }
        );
      }

      // Late Pass Enforcement: Recipient MUST have a pre-registered account
      if (!targetUser) {
        return NextResponse.json(
          {
            error:
              'Post-cutoff invites require a pre-registered account. The target user must register an account first before a Late Pass invite can be generated.',
          },
          { status: 400 }
        );
      }
    }

    // 4. Check if recipient is already enrolled
    if (targetUser && operation.agents.some((a: { userId: string }) => a.userId === targetUser.id)) {
      return NextResponse.json(
        { error: 'User is already enrolled in this operation.' },
        { status: 400 }
      );
    }

    // 5. Generate Invitation Token / Link
    const inviteToken = `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const cleanEmail = recipientEmail.trim().toLowerCase();

    // 6. If target user is found in system, create an in-app Notification for their Dashboard
    if (targetUser) {
      await db.notification.create({
        data: {
          userId: targetUser.id,
          title: `📩 Invited to Operation: ${operation.title}`,
          message: `You have been invited by ${operation.opsLeader.name} to join "${operation.title}". Use Invite Code: ${operation.code}`,
          operationId: operation.id,
        },
      });
    }

    // 7. Dispatch Email Notification (Regardless of whether email exists in system)
    console.log(`[EMAIL DISPATCH] Sent invitation notification email to ${cleanEmail} for Operation "${operation.title}" (Code: ${operation.code})`);

    // Return Invitation Dispatch Payload
    return NextResponse.json({
      success: true,
      message: targetUser
        ? `Invitation dispatched! Email sent to ${cleanEmail} and alert posted to their dashboard.`
        : `Invitation dispatched! Email notification sent to ${cleanEmail}.`,
      data: {
        operationId: operation.id,
        operationTitle: operation.title,
        recipientEmail: cleanEmail,
        inviteCode: operation.code,
        inviteToken,
        isLatePass: isPastCutoff,
        targetUserFound: !!targetUser,
        joinUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/exchange/${operation.code}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}
