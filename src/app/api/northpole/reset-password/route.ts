import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  setAdminSessionCookie,
  validateNistPassword,
} from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, currentPassword, newPassword, confirmPassword } = body as {
      adminId?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!adminId || !currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirmation do not match' }, { status: 400 });
    }

    const admin = await db.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ error: 'Administrator account not found or disabled' }, { status: 404 });
    }

    // Verify current password
    const currentMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!currentMatch) {
      return NextResponse.json({ error: 'Current initial password verification failed' }, { status: 401 });
    }

    // Validate new password against NIST SP 800-63B guidelines
    const nistCheck = validateNistPassword(newPassword, admin.username || admin.email);
    if (!nistCheck.isValid) {
      return NextResponse.json({ error: nistCheck.error }, { status: 400 });
    }

    // Hash new password using bcrypt work factor 12
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update admin user record: clear password reset flag
    await db.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash: newHash,
        requiresPasswordReset: false,
        lastLoginAt: new Date(),
      },
    });

    // Issue authenticated Admin Session Cookie
    await setAdminSessionCookie(admin.id);

    return NextResponse.json({
      success: true,
      message: 'NIST password update verified. North Pole administrative clearance activated.',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset administrator password' }, { status: 500 });
  }
}
