import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/adminDb';
import { verifyAdminSession } from '@/lib/adminAuth';
import { sendClearanceConfirmationEmail, sendClearanceApprovalEmail } from '@/lib/email';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';
    const status = searchParams.get('status')?.trim().toUpperCase();

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { source: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      whereClause.status = status;
    }

    const [leads, totalCount, approvals] = await Promise.all([
      adminDb.clearanceLead.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      adminDb.clearanceLead.count({ where: whereClause }),
      adminDb.preLaunchApproval.findMany(),
    ]);

    const approvalMap = new Map<string, string>();
    for (const app of approvals) {
      approvalMap.set(app.email.toLowerCase(), app.inviteCode);
    }

    return NextResponse.json({
      success: true,
      leads: leads.map((lead) => ({
        id: lead.id,
        email: lead.email,
        name: lead.name,
        source: lead.source,
        status: lead.status,
        inviteCode: approvalMap.get(lead.email.toLowerCase()) || null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      })),
      totalCount,
    });
  } catch (error: any) {
    console.error('[NorthPole Leads GET Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to list clearance leads' },
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

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required for deletion' }, { status: 400 });
    }

    const existing = await adminDb.clearanceLead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Clearance reservation not found' }, { status: 404 });
    }

    await adminDb.clearanceLead.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Reservation for ${existing.email} successfully purged from clearance queue.`,
      deletedLeadId: id,
    });
  } catch (error: any) {
    console.error('[NorthPole Leads DELETE Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete clearance lead' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, id, email } = body as { action?: string; id?: string; email?: string };

    if (action === 'resend_confirmation') {
      const lead = id
        ? await adminDb.clearanceLead.findUnique({ where: { id } })
        : email
        ? await adminDb.clearanceLead.findUnique({ where: { email: email.trim().toLowerCase() } })
        : null;

      if (!lead) {
        return NextResponse.json({ error: 'Clearance lead not found' }, { status: 404 });
      }

      const totalLeads = await adminDb.clearanceLead.count();
      const emailResult = await sendClearanceConfirmationEmail({
        to: lead.email,
        name: lead.name || undefined,
        positionNumber: totalLeads,
      });

      if (!emailResult.success) {
        await logError('EMAIL', `Failed to resend clearance confirmation to ${lead.email}: ${emailResult.error}`, {
          dbClient: adminDb,
          metadata: { email: lead.email, leadId: lead.id, provider: emailResult.provider, error: emailResult.error },
          path: '/api/northpole/leads',
          statusCode: 500,
        }).catch(() => {});
      } else {
        await logInfo('EMAIL', `Clearance confirmation re-dispatched to ${lead.email} via ${emailResult.provider}`, {
          dbClient: adminDb,
          metadata: { email: lead.email, leadId: lead.id, provider: emailResult.provider, attempts: emailResult.attempts },
          path: '/api/northpole/leads',
          statusCode: 200,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: emailResult.success,
        emailResult,
        message: emailResult.success
          ? `Clearance confirmation briefing re-dispatched to ${lead.email} via ${emailResult.provider}.`
          : `Email dispatch failed: ${emailResult.error}`,
      });
    }

    if (action === 'approve' || action === 'resend_approval') {
      const lead = id
        ? await adminDb.clearanceLead.findUnique({ where: { id } })
        : email
        ? await adminDb.clearanceLead.findUnique({ where: { email: email.trim().toLowerCase() } })
        : null;

      if (!lead) {
        return NextResponse.json({ error: 'Clearance lead not found' }, { status: 404 });
      }

      // Generate single-use Alpha Invite Cipher: ALPHA- + 64 random bits (16 hex). Bound to one email; deleted on use.
      const inviteCode = `ALPHA-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      // Populate / update PreLaunchApproval table
      await adminDb.preLaunchApproval.upsert({
        where: { email: lead.email.toLowerCase() },
        update: { inviteCode },
        create: {
          email: lead.email.toLowerCase(),
          inviteCode,
        },
      });

      // Update ClearanceLead status to APPROVED
      await adminDb.clearanceLead.update({
        where: { id: lead.id },
        data: { status: 'APPROVED' },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kovertklaus.com';
      const registrationUrl = `${appUrl}/register?code=${inviteCode}&email=${encodeURIComponent(lead.email)}`;

      // Dispatch Alpha Clearance Approval email with single-use cipher
      const emailResult = await sendClearanceApprovalEmail({
        to: lead.email,
        name: lead.name || undefined,
        inviteCode,
        registrationUrl,
      });

      if (!emailResult.success) {
        await logError('EMAIL', `Failed to dispatch Alpha clearance approval to ${lead.email}: ${emailResult.error}`, {
          dbClient: adminDb,
          metadata: { email: lead.email, leadId: lead.id, inviteCode, provider: emailResult.provider, error: emailResult.error },
          path: '/api/northpole/leads',
          statusCode: 500,
        }).catch(() => {});
      } else {
        await logInfo('ADMIN', `Admin ${admin.username || admin.email} approved Alpha clearance for ${lead.email} (Cipher: ${inviteCode})`, {
          dbClient: adminDb,
          metadata: { adminId: admin.id, email: lead.email, inviteCode, provider: emailResult.provider },
          path: '/api/northpole/leads',
          statusCode: 200,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        inviteCode,
        status: 'APPROVED',
        emailResult,
        message: emailResult.success
          ? `Alpha clearance approved! Cipher ${inviteCode} dispatched to ${lead.email}.`
          : `Alpha clearance approved with cipher ${inviteCode}, but email dispatch failed: ${emailResult.error}`,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('[NorthPole Leads POST Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process leads action' },
      { status: 500 }
    );
  }
}
