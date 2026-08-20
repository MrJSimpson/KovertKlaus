import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/email/dispatcher';
import { EmailConfig } from '@/lib/email/types';

export async function POST(request: Request) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientEmail, overrideConfig } = body as {
      recipientEmail?: string;
      overrideConfig?: Partial<EmailConfig>;
    };

    const targetEmail = recipientEmail?.trim() || admin.email;

    const result = await sendEmail(
      {
        to: { email: targetEmail, name: 'North Pole Test Operator' },
        subject: `[North Pole Test Dispatch] Transactional Email System Verification`,
        text: `North Pole Command Email Test Successful.\n\nDispatched by: ${admin.name} (${admin.email})\nTimestamp: ${new Date().toISOString()}\nActive Provider: ${overrideConfig?.provider || 'Resolved System Default'}`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
            <h2 style="color: #38bdf8; margin-top: 0;">🎅 North Pole Command — Email Test Verification</h2>
            <p>This is a live transactional email test dispatched from the <strong>/northpole</strong> administration console.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #334155; color: #94a3b8;">Dispatched By:</td>
                <td style="padding: 8px; border: 1px solid #334155; color: #f8fafc;">${admin.name} (${admin.email})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #334155; color: #94a3b8;">Target Recipient:</td>
                <td style="padding: 8px; border: 1px solid #334155; color: #f8fafc;">${targetEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #334155; color: #94a3b8;">Timestamp:</td>
                <td style="padding: 8px; border: 1px solid #334155; color: #f8fafc;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #64748b;">KovertKlaus Universal Transactional Email Engine — Verified</p>
          </div>
        `,
        tags: ['admin-test', 'northpole'],
      },
      overrideConfig
    );

    return NextResponse.json({
      success: result.success,
      result,
      message: result.success
        ? `Test email successfully dispatched via ${result.provider}`
        : `Email dispatch failed: ${result.error}`,
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to dispatch test email' }, { status: 500 });
  }
}
