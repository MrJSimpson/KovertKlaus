import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/security';
import crypto from 'crypto';

// In-memory rate limiting map for basic abuse prevention (5 requests per min per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }

  if (entry.count >= 5) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '127.0.0.1';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = body.email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    // Cryptographic one-way hash of IP address for privacy-preserving rate/abuse logging
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'kovert-clearance-salt')).digest('hex').substring(0, 16);

    // Idempotent lead registration
    try {
      await db.clearanceLead.upsert({
        where: { email: cleanEmail },
        update: {},
        create: {
          email: cleanEmail,
          ipHash,
          source: 'landing_page',
        },
      });
    } catch (dbError) {
      console.error('[Clearance API] Database error:', dbError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Clearance request logged. You will receive your activation cipher on launch day.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Clearance API] Unexpected handler error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to process clearance request. Please try again later.' },
      { status: 500 }
    );
  }
}
