import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidEmail, sanitizeText } from '@/lib/security';
import { sendClearanceConfirmationEmail } from '@/lib/email';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-static';


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, source = 'landing_waitlist' } = body as {
      email?: string;
      name?: string;
      source?: string;
    };

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required for clearance access.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? sanitizeText(name) : undefined;
    const cleanSource = sanitizeText(source);

    // 1. Check if lead already exists in clearance queue
    let lead = await db.clearanceLead.findUnique({
      where: { email: cleanEmail },
    });

    let isNew = false;
    if (!lead) {
      lead = await db.clearanceLead.create({
        data: {
          email: cleanEmail,
          name: cleanName,
          source: cleanSource,
          status: 'PENDING',
        },
      });
      isNew = true;
    }

    // 2. Dispatch Confirmation Email via Cloudflare Email Engine
    const emailResult = await sendClearanceConfirmationEmail({
      to: cleanEmail,
      name: cleanName || lead.name || undefined,
    });

    if (!emailResult.success) {
      await logError('EMAIL', `Clearance briefing dispatch failed for ${cleanEmail}: ${emailResult.error}`, {
        dbClient: db,
        metadata: { email: cleanEmail, source: cleanSource, provider: emailResult.provider, error: emailResult.error },
        path: '/api/leads',
        statusCode: 500,
      }).catch(() => {});
    } else {
      await logInfo('EMAIL', `Clearance briefing dispatched to ${cleanEmail} via ${emailResult.provider}`, {
        dbClient: db,
        metadata: { email: cleanEmail, source: cleanSource, provider: emailResult.provider },
        path: '/api/leads',
        statusCode: 200,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      isNew,
      message: isNew
        ? 'Clearance access request acknowledged! Confirmation email dispatched.'
        : 'Clearance request is already active on file. Confirmation email re-dispatched.',
      emailDelivery: emailResult.provider || emailResult.mode,
      lead: {
        id: lead.id,
        email: lead.email,
        status: lead.status,
      },
    });

  } catch (error: any) {
    console.error('[Leads API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to process clearance request. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const count = await db.clearanceLead.count();
    return NextResponse.json({
      success: true,
      totalClearanceLeads: count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to query clearance leads count' },
      { status: 500 }
    );
  }
}
