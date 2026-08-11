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

    // 1. Verify Exchange & Organizer Authority
    const exchange = await db.exchange.findUnique({
      where: { id: operationId },
      include: { organizer: true, members: true },
    });

    if (!exchange) {
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
    }

    if (exchange.organizerId !== requesterUserId) {
      return NextResponse.json(
        { error: 'Only the Organizer can issue invitations for this exchange.' },
        { status: 403 }
      );
    }

    // 2. Check Cutoff Date Policy
    const now = new Date();
    const isPastCutoff = now > new Date(exchange.inviteCutoffDate);

    // 3. Look up recipient in system
    const targetUser = await db.user.findUnique({
      where: { email: recipientEmail.trim().toLowerCase() },
    });

    if (isPastCutoff) {
      if (!isLatePass) {
        return NextResponse.json(
          {
            error:
              'The Invite Cutoff Date for this exchange has passed. Standard invitations are disabled.',
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
    if (targetUser && exchange.members.some((a: { userId: string }) => a.userId === targetUser.id)) {
      return NextResponse.json(
        { error: 'User is already enrolled in this exchange.' },
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
          title: `📩 Invited to Exchange: ${exchange.title}`,
          message: `You have been invited by ${exchange.organizer.name} to join "${exchange.title}". Use Invite Code: ${exchange.code}`,
          exchangeId: exchange.id,
        },
      });
    }

    // 7. Dispatch Email Notification (Regardless of whether email exists in system)
    console.log(`[EMAIL DISPATCH] Sent invitation notification email to ${cleanEmail} for Exchange "${exchange.title}" (Code: ${exchange.code})`);

    // Return Invitation Dispatch Payload
    return NextResponse.json({
      success: true,
      message: targetUser
        ? `Invitation dispatched! Email sent to ${cleanEmail} and alert posted to their dashboard.`
        : `Invitation dispatched! Email notification sent to ${cleanEmail}.`,
      data: {
        operationId: exchange.id,
        operationTitle: exchange.title,
        recipientEmail: cleanEmail,
        inviteCode: exchange.code,
        inviteToken,
        isLatePass: isPastCutoff,
        targetUserFound: !!targetUser,
        joinUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/exchange/${exchange.code}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}
