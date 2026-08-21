import bcrypt from 'bcryptjs';
import * as cheerio from 'cheerio';
import { getAdminDb, invalidateCachedAdminDb } from './lib/adminDb';
import { getDb, invalidateCachedDb } from './lib/db';
import { validateNistPassword } from './lib/adminAuth';
import {
  sanitizeText,
  isValidEmail,
  validatePassword,
  generateInviteCode,
  signToken,
  verifyToken,
  isSafePublicUrl,
  normalizeProductUrl,
} from './lib/security';
import { executeLinkedListDraw, executeTargetSwap } from './lib/draw';
import { sendEmail } from './lib/email/dispatcher';
import {
  sendWelcomeEmail,
  sendInvitationEmail,
  sendClearanceConfirmationEmail,
  sendAssignmentEmail,
  sendNudgeEmail,
} from './lib/email';
import { evaluateMemberAudit } from './lib/demerits';

const ADMIN_COOKIE_NAME = 'kovertklaus_admin_session';
const USER_COOKIE_NAME = 'kovertklaus_session';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DATABASE_URL?: string;
  DATABASE_ADMIN_URL?: string;
  DIRECT_URL?: string;
  MODE?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  RESEND_API_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_SECURE?: string;
  SMTP_FROM?: string;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function getAdminIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, ADMIN_COOKIE_NAME);
  const verifiedCookie = verifyToken(fromCookie);
  if (verifiedCookie) return verifiedCookie;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyToken(authHeader.substring(7).trim());
  }

  return null;
}

function getUserIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, USER_COOKIE_NAME);
  const verifiedCookie = verifyToken(fromCookie);
  if (verifiedCookie) return verifiedCookie;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyToken(authHeader.substring(7).trim());
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const rawPath = url.pathname;
    const pathname = rawPath.replace(/\/+$/, '') || '/';

    // Populate runtime process.env with Cloudflare Worker bindings
    if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
    if (env.DATABASE_ADMIN_URL) process.env.DATABASE_ADMIN_URL = env.DATABASE_ADMIN_URL;
    if (env.DIRECT_URL) process.env.DIRECT_URL = env.DIRECT_URL;
    if (env.MODE) process.env.MODE = env.MODE;
    if (env.BREVO_API_KEY) process.env.BREVO_API_KEY = env.BREVO_API_KEY;
    if (env.BREVO_SENDER_EMAIL) process.env.BREVO_SENDER_EMAIL = env.BREVO_SENDER_EMAIL;
    if (env.BREVO_SENDER_NAME) process.env.BREVO_SENDER_NAME = env.BREVO_SENDER_NAME;
    if (env.EMAIL_PROVIDER) process.env.EMAIL_PROVIDER = env.EMAIL_PROVIDER;
    if (env.EMAIL_FROM) process.env.EMAIL_FROM = env.EMAIL_FROM;
    if (env.EMAIL_FROM_NAME) process.env.EMAIL_FROM_NAME = env.EMAIL_FROM_NAME;
    if (env.RESEND_API_KEY) process.env.RESEND_API_KEY = env.RESEND_API_KEY;
    if (env.SMTP_HOST) process.env.SMTP_HOST = env.SMTP_HOST;
    if (env.SMTP_PORT) process.env.SMTP_PORT = env.SMTP_PORT;
    if (env.SMTP_USER) process.env.SMTP_USER = env.SMTP_USER;
    if (env.SMTP_PASS) process.env.SMTP_PASS = env.SMTP_PASS;
    if (env.SMTP_SECURE) process.env.SMTP_SECURE = env.SMTP_SECURE;
    if (env.SMTP_FROM) process.env.SMTP_FROM = env.SMTP_FROM;

    try {
      const adminConnStr = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL || process.env.DATABASE_ADMIN_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
      const appConnStr = env.DATABASE_URL || env.DATABASE_ADMIN_URL || env.DIRECT_URL || process.env.DATABASE_URL || process.env.DATABASE_ADMIN_URL;

      const adminDb = getAdminDb(adminConnStr);
      const db = getDb(appConnStr);

      // =======================================================================
      // SECTION 1: NORTH POLE SUPER ADMIN ENDPOINTS (/api/northpole/*)
      // =======================================================================

      // 1. /api/northpole/login (POST)
      if (pathname === '/api/northpole/login' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const loginId = (body.identifier || body.username || body.email || '').trim().toLowerCase();
        const password = body.password || '';

        if (!loginId || !password) {
          return Response.json({ error: 'Username/email and password are required' }, { status: 400 });
        }

        const admin = await adminDb.adminUser.findFirst({
          where: {
            OR: [
              { username: { equals: loginId, mode: 'insensitive' } },
              { email: { equals: loginId, mode: 'insensitive' } },
            ],
          },
        });

        if (!admin || !admin.isActive) {
          await bcrypt.compare(password, '$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x');
          return Response.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
        }

        const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!passwordMatch) {
          return Response.json({ error: 'Invalid administrative credentials' }, { status: 401 });
        }

        if (admin.requiresPasswordReset) {
          return Response.json({
            success: true,
            requiresPasswordReset: true,
            adminId: admin.id,
            identifier: admin.username || admin.email,
            name: admin.name,
            message: 'Initial installation login detected. NIST SP 800-63B mandatory password reset required.',
          });
        }

        await adminDb.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        const signedAdminId = signToken(admin.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=${signedAdminId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: signedAdminId,
          requiresPasswordReset: false,
          admin: { id: admin.id, name: admin.name, email: admin.email, username: admin.username, role: admin.role },
        }), { status: 200, headers });
      }

      // 2. /api/northpole/me (GET / DELETE)
      if (pathname === '/api/northpole/me') {
        const adminId = getAdminIdFromRequest(request);

        if (request.method === 'DELETE') {
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
          return new Response(JSON.stringify({ success: true, message: 'Logged out' }), { status: 200, headers });
        }

        if (!adminId) {
          return Response.json({ authenticated: false, reason: 'no_credentials_found' }, { status: 200 });
        }

        const admin = await adminDb.adminUser.findUnique({
          where: { id: adminId },
          select: { id: true, email: true, username: true, name: true, role: true, isActive: true, requiresPasswordReset: true },
        });

        if (!admin || !admin.isActive || admin.requiresPasswordReset) {
          return Response.json({ authenticated: false, reason: 'unauthorized_or_reset_required' }, { status: 200 });
        }

        return Response.json({ authenticated: true, admin });
      }

      // 3. /api/northpole/reset-password (POST)
      if (pathname === '/api/northpole/reset-password' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { adminId, currentPassword, newPassword, confirmPassword } = body;

        if (!adminId || !currentPassword || !newPassword) {
          return Response.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (newPassword !== confirmPassword) {
          return Response.json({ error: 'New password and confirmation do not match' }, { status: 400 });
        }

        const admin = await adminDb.adminUser.findUnique({ where: { id: adminId } });
        if (!admin) {
          return Response.json({ error: 'Admin account not found' }, { status: 404 });
        }

        const currentMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
        if (!currentMatch) {
          return Response.json({ error: 'Current password verification failed' }, { status: 401 });
        }

        const nistCheck = validateNistPassword(newPassword, admin.username || admin.email);
        if (!nistCheck.isValid) {
          return Response.json({ error: nistCheck.error }, { status: 400 });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await adminDb.adminUser.update({
          where: { id: adminId },
          data: { passwordHash: newHash, requiresPasswordReset: false, lastLoginAt: new Date() },
        });

        const signedAdminId = signToken(admin.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=${signedAdminId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: signedAdminId,
          message: 'Password updated successfully. North Pole clearance unlocked.',
          admin: { id: admin.id, name: admin.name, email: admin.email, username: admin.username, role: admin.role },
        }), { status: 200, headers });
      }

      // 4. /api/northpole/config (GET / PATCH)
      if (pathname === '/api/northpole/config') {
        if (request.method === 'GET') {
          const [config, themes, totalUsers, totalOperations, totalLeads, workshopUsersCount] = await Promise.all([
            adminDb.systemConfig.findUnique({ where: { id: 'singleton' } }),
            adminDb.themePreset.findMany({ orderBy: { id: 'asc' } }),
            adminDb.user.count(),
            adminDb.exchange.count(),
            adminDb.clearanceLead.count(),
            adminDb.user.count({ where: { isWorkshop: true } }),
          ]);
          return Response.json({
            success: true,
            config,
            themes,
            stats: {
              totalUsers,
              totalOperations,
              totalLeads,
              workshopUsersCount,
            },
          });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const updated = await adminDb.systemConfig.upsert({
            where: { id: 'singleton' },
            update: body,
            create: { id: 'singleton', ...body },
          });
          return Response.json({ success: true, config: updated });
        }
      }

      // 5. /api/northpole/users (GET / PATCH)
      if (pathname === '/api/northpole/users') {
        if (request.method === 'GET') {
          const q = url.searchParams.get('q')?.trim().toLowerCase();
          const workshop = url.searchParams.get('workshop') === 'true';

          const whereClause: any = {};
          if (workshop) whereClause.isWorkshop = true;
          if (q) {
            whereClause.OR = [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { codename: { contains: q, mode: 'insensitive' } },
            ];
          }

          const rawUsers = await adminDb.user.findMany({
            where: whereClause,
            take: 100,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              email: true,
              codename: true,
              penaltyPoints: true,
              accountStatus: true,
              isWorkshop: true,
              createdAt: true,
              _count: {
                select: {
                  createdExchanges: true,
                  participations: true,
                  wishlists: true,
                },
              },
            },
          });

          const formatted = rawUsers.map((u) => ({
            ...u,
            demerits: u.penaltyPoints ?? 0,
            accountStatus: u.accountStatus || 'ACTIVE',
            organizedCount: u._count?.createdExchanges ?? 0,
            joinedCount: u._count?.participations ?? 0,
            wishlistsCount: u._count?.wishlists ?? 0,
          }));

          return Response.json({ success: true, users: formatted, total: formatted.length });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { userId, penaltyPoints, isWorkshop, accountStatus } = body;
          const user = await adminDb.user.update({
            where: { id: userId },
            data: {
              ...(penaltyPoints !== undefined ? { penaltyPoints } : {}),
              ...(isWorkshop !== undefined ? { isWorkshop } : {}),
              ...(accountStatus !== undefined ? { accountStatus } : {}),
            },
          });
          return Response.json({ success: true, user: { ...user, demerits: user.penaltyPoints } });
        }
      }

      // 6. /api/northpole/operations (GET)
      if (pathname === '/api/northpole/operations' && request.method === 'GET') {
        const q = url.searchParams.get('q')?.trim().toLowerCase();
        const whereClause: any = {};
        if (q) {
          whereClause.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ];
        }

        const rawOps = await adminDb.exchange.findMany({
          where: whereClause,
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: {
            organizer: { select: { id: true, name: true, email: true, codename: true } },
            _count: { select: { members: true, exclusionRules: true, reports: true } },
          },
        });

        const formatted = rawOps.map((op) => ({
          ...op,
          organizer: op.organizer || { id: '', name: 'System Organizer', email: 'admin@kovertklaus.com' },
          membersCount: op._count?.members ?? 0,
          rulesCount: op._count?.exclusionRules ?? 0,
          reportsCount: op._count?.reports ?? 0,
          budgetMin: op.budgetMin ? Number(op.budgetMin) : 0,
          budgetMax: op.budgetMax ? Number(op.budgetMax) : 0,
        }));

        return Response.json({ success: true, operations: formatted, total: formatted.length });
      }

      // 7. /api/northpole/email/test (POST)
      if (pathname === '/api/northpole/email/test' && request.method === 'POST') {
        const adminId = getAdminIdFromRequest(request);
        if (!adminId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await adminDb.adminUser.findUnique({ where: { id: adminId } });
        if (!admin) return Response.json({ error: 'Admin not found' }, { status: 404 });

        const body = (await request.json().catch(() => ({}))) as any;
        const targetEmail = (body.recipientEmail || admin.email).trim();

        const result = await sendEmail(
          {
            to: { email: targetEmail, name: 'North Pole Operator' },
            subject: '[North Pole Test Dispatch] Transactional Email System Verification',
            text: `North Pole Command Email Test Successful.\nDispatched by: ${admin.name} (${admin.email})\nTimestamp: ${new Date().toISOString()}`,
            html: `
              <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
                <h2 style="color: #38bdf8; margin-top: 0;">🎅 North Pole Command — Email Verification</h2>
                <p>Live transactional test from <strong>kovertklaus.com/northpole</strong>.</p>
                <p>Dispatched By: ${admin.name} (${admin.email})</p>
                <p>Recipient: ${targetEmail}</p>
                <p>Timestamp: ${new Date().toLocaleString()}</p>
              </div>
            `,
            tags: ['admin-test', 'northpole'],
          },
          body.overrideConfig
        );

        return Response.json({
          success: result.success,
          result,
          message: result.success ? `Test email dispatched via ${result.provider}` : `Email failed: ${result.error}`,
        });
      }

      // =======================================================================
      // SECTION 2: USER APPLICATION & PUBLIC ENDPOINTS
      // =======================================================================

      // 8. /api/config (GET)
      if (pathname === '/api/config' && request.method === 'GET') {
        const config = await db.systemConfig.findUnique({ where: { id: 'singleton' } });
        const theme = config ? await db.themePreset.findUnique({ where: { id: config.activeThemeId } }) : null;
        return Response.json({ config, theme });
      }

      // 9. /api/clearance / /api/leads (POST)
      if ((pathname === '/api/clearance' || pathname === '/api/leads') && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || '').trim();
        const source = (body.source || 'landing_countdown').trim();

        if (!email || !isValidEmail(email)) {
          return Response.json({ error: 'A valid email address is required for clearance access.' }, { status: 400 });
        }

        const totalLeads = await db.clearanceLead.count();
        const lead = await db.clearanceLead.upsert({
          where: { email },
          update: { updatedAt: new Date(), ...(name ? { name: sanitizeText(name) } : {}) },
          create: { email, name: name ? sanitizeText(name) : undefined, source: sanitizeText(source) },
        });

        // Dispatch Confirmation Email via configured Email Dispatcher
        let emailResult: any = null;
        try {
          emailResult = await sendClearanceConfirmationEmail({
            to: email,
            name: name || undefined,
            positionNumber: totalLeads + 1,
          });
        } catch (emailErr: any) {
          console.error('[Clearance Email Dispatch Error]', emailErr);
        }

        return Response.json({
          success: true,
          lead,
          emailDispatched: Boolean(emailResult?.success),
          provider: emailResult?.provider || emailResult?.mode,
          message: emailResult?.success
            ? 'Clearance access confirmed! Encrypted briefing dispatched to your inbox.'
            : 'Clearance request logged.',
        });
      }

      // 10. /api/users/login (POST)
      if (pathname === '/api/users/login' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { email, password } = body;

        if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 400 });
        if (!isValidEmail(email)) return Response.json({ error: 'Invalid email address format' }, { status: 400 });

        const cleanEmail = email.trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email: cleanEmail } });

        if (!user) {
          await bcrypt.compare(password, '$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x');
          return Response.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return Response.json({ error: 'Invalid email or password' }, { status: 401 });

        const signedUserId = signToken(user.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${USER_COOKIE_NAME}=${signedUserId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: signedUserId,
          message: 'Authentication successful',
          user: { id: user.id, name: user.name, email: user.email, codename: user.codename, isWorkshop: user.isWorkshop },
        }), { status: 200, headers });
      }

      // 11. /api/users/me / /api/users/profile (GET / PATCH / DELETE)
      if (pathname === '/api/users/me' || pathname === '/api/users/profile') {
        const userId = getUserIdFromRequest(request);

        if (request.method === 'DELETE') {
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', `${USER_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
          return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), { status: 200, headers });
        }

        if (!userId) return Response.json({ authenticated: false }, { status: 401 });

        if (request.method === 'GET') {
          let user = await db.user.findUnique({
            where: { id: userId },
            select: {
              id: true, email: true, name: true, codename: true, streetAddress: true, city: true, state: true,
              zipCode: true, country: true, emailNotifications: true, penaltyPoints: true, isWorkshop: true, accountStatus: true, createdAt: true,
              participations: {
                include: {
                  exchange: {
                    select: {
                      id: true, title: true, code: true, isLocalOnly: true, isWhiteElephant: true, budgetMin: true,
                      budgetMax: true, currency: true, inviteCutoffDate: true, assignmentDate: true, shippingDate: true,
                      executionDate: true, status: true, organizer: { select: { name: true, codename: true } },
                    },
                  },
                },
                orderBy: { joinedAt: 'desc' },
              },
              notifications: { where: { isAcknowledged: false }, orderBy: { createdAt: 'desc' } },
              wishlists: { include: { wishlistItems: { include: { item: true } } }, orderBy: { createdAt: 'asc' } },
            },
          });

          if (!user) return Response.json({ authenticated: false, error: 'User not found' }, { status: 404 });

          // Ensure default wishlist
          if (user.wishlists.length === 0) {
            await db.wishlist.create({ data: { userId: user.id, name: 'Master OpKit - Secret Santa', type: 'STANDARD' } });
            const refetched = await db.wishlist.findMany({ where: { userId: user.id }, include: { wishlistItems: { include: { item: true } } } });
            user = { ...user, wishlists: refetched };
          }

          const formattedWishlists = user.wishlists.map((w, idx) => ({
            id: w.id,
            name: w.name,
            isMaster: idx === 0,
            type: w.type,
            createdAt: w.createdAt,
            opTools: w.wishlistItems.map((wi) => ({
              id: wi.item.id,
              title: wi.item.name,
              price: wi.item.price ? Number(wi.item.price) : undefined,
              url: wi.item.url,
              thumbnail: wi.item.thumbnailUrl || undefined,
              description: wi.item.description || undefined,
            })),
          }));

          return Response.json({
            success: true,
            authenticated: true,
            user: { ...user, demerits: user.penaltyPoints, wishlists: formattedWishlists },
          });
        }

        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { name, codename, streetAddress, city, state, zipCode, country, emailNotifications, oldPassword, newPassword } = body;
          const updateData: Record<string, any> = {};

          if (name) updateData.name = sanitizeText(name);
          if (codename) updateData.codename = sanitizeText(codename);
          if (streetAddress !== undefined) updateData.streetAddress = sanitizeText(streetAddress);
          if (city !== undefined) updateData.city = sanitizeText(city);
          if (state !== undefined) updateData.state = sanitizeText(state);
          if (zipCode !== undefined) updateData.zipCode = sanitizeText(zipCode);
          if (country !== undefined) updateData.country = sanitizeText(country);
          if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);

          if (newPassword) {
            if (!oldPassword) return Response.json({ error: 'Current password required' }, { status: 400 });
            const user = await db.user.findUnique({ where: { id: userId } });
            if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
            const match = await bcrypt.compare(oldPassword, user.passwordHash);
            if (!match) return Response.json({ error: 'Incorrect current password' }, { status: 400 });
            const passCheck = validatePassword(newPassword);
            if (!passCheck.isValid) return Response.json({ error: passCheck.error }, { status: 400 });
            updateData.passwordHash = await bcrypt.hash(newPassword, 12);
          }

          const updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData,
          });

          return Response.json({ success: true, message: 'Preferences updated', user: updatedUser });
        }
      }

      // 12. /api/users (POST - Registration)
      if (pathname === '/api/users' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { name, email, codename, password } = body;

        if (!email || !isValidEmail(email)) return Response.json({ error: 'Valid email required' }, { status: 400 });
        if (!name || !password) return Response.json({ error: 'Name, email, and password required' }, { status: 400 });

        const passCheck = validatePassword(password);
        if (!passCheck.isValid) return Response.json({ error: passCheck.error }, { status: 400 });

        const cleanEmail = email.trim().toLowerCase();
        const passwordHash = await bcrypt.hash(password, 12);

        try {
          const user = await db.user.create({
            data: {
              email: cleanEmail,
              name: sanitizeText(name),
              codename: codename ? sanitizeText(codename) : undefined,
              passwordHash,
            },
            select: { id: true, email: true, name: true, codename: true, accountStatus: true, penaltyPoints: true },
          });

          sendWelcomeEmail({ to: user.email, name: user.name, codename: user.codename || undefined }).catch(() => {});

          const signedUserId = signToken(user.id);
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', `${USER_COOKIE_NAME}=${signedUserId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);

          return new Response(JSON.stringify({ success: true, token: signedUserId, data: user }), { status: 200, headers });
        } catch (err: any) {
          if (err?.code === 'P2002') {
            return Response.json({ error: 'An account with this email already exists.' }, { status: 400 });
          }
          throw err;
        }
      }

      // 13. /api/operations (GET / POST)
      if (pathname === '/api/operations') {
        const activeUserId = getUserIdFromRequest(request);

        if (request.method === 'GET') {
          const code = url.searchParams.get('code');
          if (code) {
            const exchange = await db.exchange.findUnique({
              where: { code: code.trim().toUpperCase() },
              include: {
                organizer: { select: { id: true, name: true, codename: true } },
                members: {
                  include: {
                    user: { select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true } },
                    targetUser: { select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true } },
                  },
                },
                exclusionRules: {
                  include: {
                    member: { select: { id: true, name: true, codename: true } },
                    restrictedMember: { select: { id: true, name: true, codename: true } },
                  },
                },
                reports: { include: { user: { select: { id: true, name: true, codename: true } } }, orderBy: { createdAt: 'desc' } },
              },
            });
            if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });

            // Sanitize targetUser and physical addresses server-side
            const isOrganizer = Boolean(activeUserId && exchange.organizerId === activeUserId);
            const sanitizedMembers = exchange.members.map((m) => {
              const isSelf = Boolean(activeUserId && m.userId === activeUserId);
              const canViewDetails = isOrganizer || isSelf;

              return {
                id: m.id,
                userId: m.userId,
                role: m.role,
                shippingStatus: m.shippingStatus,
                trackingNumber: canViewDetails ? m.trackingNumber : undefined,
                shippedAt: m.shippedAt,
                deliveredConfirmed: m.deliveredConfirmed,
                joinedAt: m.joinedAt,
                user: {
                  id: m.user.id,
                  name: m.user.name,
                  codename: m.user.codename,
                  streetAddress: canViewDetails ? m.user.streetAddress : null,
                  city: canViewDetails ? m.user.city : null,
                  state: canViewDetails ? m.user.state : null,
                  zipCode: canViewDetails ? m.user.zipCode : null,
                },
                targetUserId: canViewDetails ? m.targetUserId : null,
                targetUser: canViewDetails ? m.targetUser : null,
              };
            });

            return Response.json({
              success: true,
              data: {
                ...exchange,
                members: sanitizedMembers,
                exclusionRules: isOrganizer ? exchange.exclusionRules : [],
              },
            });
          }

          if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

          const exchanges = await db.exchange.findMany({
            where: {
              OR: [{ organizerId: activeUserId }, { members: { some: { userId: activeUserId } } }],
            },
            include: {
              organizer: { select: { id: true, name: true, codename: true } },
              members: { select: { id: true, userId: true, role: true, shippingStatus: true } },
            },
            orderBy: { createdAt: 'desc' },
          });
          return Response.json({ success: true, data: exchanges });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { config, action, operationId } = body;
          const userId = activeUserId;

          if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

          // Action 1: Draw
          if (action === 'draw' && operationId) {
            const ex = await db.exchange.findUnique({ where: { id: operationId }, include: { members: true, exclusionRules: true, organizer: true } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can trigger draws' }, { status: 403 });
            if (ex.members.length < 2) return Response.json({ error: 'At least 2 members required' }, { status: 400 });

            const agents = ex.members.map((m) => ({ id: m.userId, name: m.userId, hasWishlistAttached: !!m.wishlistId }));
            const exclusionRules = ex.exclusionRules.map((r) => ({ agentId: r.memberId, restrictedAgentId: r.restrictedMemberId }));
            const assignments = executeLinkedListDraw(agents, { isWhiteElephant: ex.isWhiteElephant, exclusionRules });

            const updateOps = assignments
              .map((assignment) => {
                const mem = ex.members.find((m) => m.userId === assignment.agentId);
                if (!mem) return null;
                return db.exchangeMember.update({ where: { id: mem.id }, data: { targetUserId: assignment.targetId } });
              })
              .filter(Boolean);

            await db.$transaction([
              ...(updateOps as any[]),
              db.exchange.update({ where: { id: operationId }, data: { status: 'MATCHED' } }),
            ]);

            // Dispatch assignment emails
            try {
              const enrolledUsers = await db.user.findMany({
                where: { id: { in: ex.members.map((m) => m.userId) } },
              });
              for (const assignment of assignments) {
                const giver = enrolledUsers.find((u) => u.id === assignment.agentId);
                const target = enrolledUsers.find((u) => u.id === assignment.targetId);
                if (giver?.email && giver.emailNotifications !== false && target) {
                  sendAssignmentEmail({
                    recipientEmail: giver.email,
                    recipientName: giver.name || giver.codename || 'Operative',
                    targetCodename: target.codename || target.name || 'Target Operative',
                    targetName: target.name || undefined,
                    exchangeTitle: ex.title,
                    shippingDeadline: ex.shippingDate ? new Date(ex.shippingDate).toLocaleDateString() : undefined,
                    exchangeDate: ex.executionDate ? new Date(ex.executionDate).toLocaleDateString() : undefined,
                    exchangeUrl: `https://kovertklaus.com/exchange/${ex.code}`,
                  }).catch(() => {});
                }
              }
            } catch {}

            return Response.json({ success: true, message: 'Draw completed successfully' });
          }

          // Action 2: 2-Way Cascade Target Swap
          if (action === 'swap' && operationId) {
            const { originatorUserId, newTargetUserId } = body;
            if (!originatorUserId || !newTargetUserId) {
              return Response.json({ error: 'originatorUserId and newTargetUserId required' }, { status: 400 });
            }

            const ex = await db.exchange.findUnique({
              where: { id: operationId },
              include: { members: true, exclusionRules: true },
            });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can execute swaps' }, { status: 403 });

            const currentAssignments = ex.members
              .filter((a) => a.targetUserId)
              .map((a) => ({ agentId: a.userId, targetId: a.targetUserId! }));

            const exclusionRules = ex.exclusionRules.map((r) => ({
              agentId: r.memberId,
              restrictedAgentId: r.restrictedMemberId,
            }));

            try {
              const updatedAssignments = executeTargetSwap(
                currentAssignments,
                originatorUserId,
                newTargetUserId,
                exclusionRules
              );

              const updateOps = updatedAssignments
                .map((assignment) => {
                  const memberRecord = ex.members.find((a) => a.userId === assignment.agentId);
                  if (!memberRecord) return null;
                  return db.exchangeMember.update({
                    where: { id: memberRecord.id },
                    data: { targetUserId: assignment.targetId },
                  });
                })
                .filter(Boolean);

              await db.$transaction(updateOps as any[]);
              return Response.json({ success: true, message: 'Target swap executed successfully', assignments: updatedAssignments });
            } catch (err: any) {
              return Response.json({ error: err.message || 'Target swap failed' }, { status: 400 });
            }
          }

          // Action 3: Add Exclusion Rule
          if (action === 'addExclusion' && operationId) {
            const { agentId: memberId, restrictedAgentId: restrictedMemberId } = body;
            if (!memberId || !restrictedMemberId) {
              return Response.json({ error: 'agentId and restrictedAgentId required' }, { status: 400 });
            }

            const ex = await db.exchange.findUnique({ where: { id: operationId } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can configure exclusions' }, { status: 403 });

            await db.exclusionRule.create({
              data: { exchangeId: operationId, memberId, restrictedMemberId },
            });
            return Response.json({ success: true, message: 'Exclusion rule created' });
          }

          // Action 4: Remove Exclusion Rule
          if (action === 'removeExclusion' && operationId) {
            const { exclusionId } = body;
            if (!exclusionId) return Response.json({ error: 'exclusionId required' }, { status: 400 });

            const ex = await db.exchange.findUnique({ where: { id: operationId } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can remove exclusions' }, { status: 403 });

            await db.exclusionRule.delete({ where: { id: exclusionId } });
            return Response.json({ success: true, message: 'Exclusion rule removed' });
          }

          // Action 5: Close Recruitment
          if (action === 'closeRecruitment' && operationId) {
            const ex = await db.exchange.findUnique({ where: { id: operationId } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can close recruitment' }, { status: 403 });

            await db.exchange.update({
              where: { id: operationId },
              data: { inviteCutoffDate: new Date() },
            });
            return Response.json({ success: true, message: 'Recruitment closed.' });
          }

          // Action 6: End Operation
          if (action === 'endOperation' && operationId) {
            const ex = await db.exchange.findUnique({ where: { id: operationId } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can end exchange' }, { status: 403 });

            await db.exchange.update({
              where: { id: operationId },
              data: { executionDate: new Date(), status: 'COMPLETED' },
            });
            return Response.json({ success: true, message: 'Exchange ended' });
          }

          // Action 7: Send Broadcast
          if (action === 'sendOpTeamBroadcast' && operationId) {
            const { messageText } = body;
            if (!messageText?.trim()) return Response.json({ error: 'messageText required' }, { status: 400 });

            const ex = await db.exchange.findUnique({
              where: { id: operationId },
              include: { members: { include: { user: true } }, organizer: true },
            });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can broadcast' }, { status: 403 });

            const notificationInserts = ex.members.map((m) =>
              db.notification.create({
                data: {
                  userId: m.userId,
                  title: `📢 Exchange Broadcast: ${ex.title}`,
                  message: messageText.trim(),
                  exchangeId: ex.id,
                },
              })
            );

            await db.$transaction(notificationInserts);

            for (const member of ex.members) {
              if (member.user.email && member.user.emailNotifications !== false) {
                sendNudgeEmail({
                  recipientEmail: member.user.email,
                  recipientName: member.user.name || member.user.codename || 'Operative',
                  organizerName: ex.organizer.name,
                  exchangeTitle: ex.title,
                  message: messageText.trim(),
                  actionUrl: `https://kovertklaus.com/exchange/${ex.code}`,
                }).catch(() => {});
              }
            }

            return Response.json({ success: true, message: 'Broadcast dispatched' });
          }

          // Action 8: Create Report
          if (action === 'createReport' && operationId) {
            const { thankYouText, photoUrl } = body;
            const report = await db.exchangeReport.create({
              data: {
                exchangeId: operationId,
                userId,
                thankYouText: thankYouText ? sanitizeText(thankYouText) : null,
                photoUrl: photoUrl?.trim() || null,
              },
            });
            return Response.json({ success: true, data: report });
          }

          // Create Exchange
          if (config) {
            let inviteCode = generateInviteCode();
            const newExchange = await db.exchange.create({
              data: {
                title: config.title.trim(),
                description: config.description?.trim(),
                code: inviteCode,
                organizerId: userId,
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
                paymentStatus: 'EXEMPT_SELF_HOSTED',
                members: { create: { userId, role: 'ORGANIZER' } },
              },
            });
            return Response.json({ success: true, data: newExchange });
          }
        }

        if (request.method === 'PATCH') {
          const activeUserId = getUserIdFromRequest(request);
          if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

          const body = (await request.json().catch(() => ({}))) as any;
          const { operationId, action, dates, settings, agentId: memberId, newRole, targetUserId, demeritPoints } = body;

          if (!operationId) return Response.json({ error: 'operationId required' }, { status: 400 });

          const ex = await db.exchange.findUnique({ where: { id: operationId } });
          if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
          if (ex.organizerId !== activeUserId) return Response.json({ error: 'Only organizer can perform admin actions' }, { status: 403 });

          if (action === 'update_agent_role' && memberId && newRole) {
            const updatedMember = await db.exchangeMember.update({
              where: { id: memberId },
              data: { role: newRole === 'ORGANIZER' || newRole === 'OPS_LEADER' ? 'ORGANIZER' : 'MEMBER' },
            });
            return Response.json({ success: true, data: updatedMember });
          }

          if (action === 'remove_agent' && memberId) {
            const memberToDelete = await db.exchangeMember.findUnique({ where: { id: memberId } });
            if (!memberToDelete) return Response.json({ error: 'Member not found' }, { status: 404 });
            if (memberToDelete.userId === ex.organizerId) return Response.json({ error: 'Cannot remove primary organizer' }, { status: 400 });
            await db.exchangeMember.delete({ where: { id: memberId } });
            return Response.json({ success: true, message: 'Member removed' });
          }

          if (action === 'issue_demerit' && targetUserId) {
            const pts = demeritPoints || 1;
            const updatedUser = await db.user.update({
              where: { id: targetUserId },
              data: { penaltyPoints: { increment: pts } },
            });
            return Response.json({ success: true, message: `Issued ${pts} point(s)`, totalDemerits: updatedUser.penaltyPoints });
          }

          if (action === 'nudge_agent' && memberId) {
            const memberToNudge = await db.exchangeMember.findUnique({
              where: { id: memberId },
              include: { user: true, exchange: { include: { organizer: true } } },
            });
            if (!memberToNudge) return Response.json({ error: 'Member not found' }, { status: 404 });

            const nudgeMsg = 'Reminder: Please update your OpKit wishlist and review mission directives.';
            await db.notification.create({
              data: {
                userId: memberToNudge.userId,
                title: `🔔 Mission Nudge: ${memberToNudge.exchange.title}`,
                message: nudgeMsg,
                exchangeId: memberToNudge.exchangeId,
              },
            });

            if (memberToNudge.user.email && memberToNudge.user.emailNotifications !== false) {
              sendNudgeEmail({
                recipientEmail: memberToNudge.user.email,
                recipientName: memberToNudge.user.name || memberToNudge.user.codename || 'Operative',
                organizerName: memberToNudge.exchange.organizer.name,
                exchangeTitle: memberToNudge.exchange.title,
                message: nudgeMsg,
                actionUrl: `https://kovertklaus.com/exchange/${memberToNudge.exchange.code}`,
              }).catch(() => {});
            }

            return Response.json({ success: true, message: 'Nudge alert dispatched' });
          }

          if (action === 'update_settings' || settings) {
            if (!settings) return Response.json({ error: 'Settings payload required' }, { status: 400 });
            const updatedExchange = await db.exchange.update({
              where: { id: operationId },
              data: {
                title: settings.title !== undefined ? settings.title.trim() : ex.title,
                description: settings.description !== undefined ? settings.description.trim() : ex.description,
                budgetMin: settings.budgetMin !== undefined ? Number(settings.budgetMin) : ex.budgetMin,
                budgetMax: settings.budgetMax !== undefined ? Number(settings.budgetMax) : ex.budgetMax,
                maxParticipants: settings.maxParticipants !== undefined ? (settings.maxParticipants ? Number(settings.maxParticipants) : null) : ex.maxParticipants,
                isLocalOnly: settings.isLocalOnly !== undefined ? settings.isLocalOnly : ex.isLocalOnly,
                eventLocation: settings.eventLocation !== undefined ? settings.eventLocation.trim() : ex.eventLocation,
                enforcePenalties: settings.enforcePenalties !== undefined ? settings.enforcePenalties : ex.enforcePenalties,
              },
            });
            return Response.json({ success: true, data: updatedExchange });
          }

          if (dates) {
            const updatedExchange = await db.exchange.update({
              where: { id: operationId },
              data: {
                inviteCutoffDate: new Date(dates.inviteCutoffDate),
                assignmentDate: new Date(dates.assignmentDate),
                shippingDate: new Date(dates.shippingDate),
                executionDate: new Date(dates.executionDate),
              },
            });
            return Response.json({ success: true, data: updatedExchange });
          }
        }
      }

      // 14. /api/invitations (POST)
      if (pathname === '/api/invitations' && request.method === 'POST') {
        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as any;
        const { operationId, recipientEmail } = body;

        if (!operationId || !recipientEmail) return Response.json({ error: 'operationId and recipientEmail required' }, { status: 400 });

        const exchange = await db.exchange.findUnique({ where: { id: operationId }, include: { organizer: true, members: true } });
        if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });

        const targetUser = await db.user.findUnique({ where: { email: recipientEmail.trim().toLowerCase() } });
        const cleanEmail = recipientEmail.trim().toLowerCase();

        if (targetUser) {
          await db.notification.create({
            data: {
              userId: targetUser.id,
              title: `📩 Invited to: ${exchange.title}`,
              message: `You have been invited to join "${exchange.title}". Code: ${exchange.code}`,
              exchangeId: exchange.id,
            },
          });
        }

        sendInvitationEmail({
          recipientEmail: cleanEmail,
          recipientName: targetUser?.name,
          organizerName: exchange.organizer.name,
          exchangeTitle: exchange.title,
          inviteCode: exchange.code,
          budgetMin: exchange.budgetMin ? Number(exchange.budgetMin) : null,
          budgetMax: Number(exchange.budgetMax),
          joinUrl: `https://kovertklaus.com/exchange/${exchange.code}`,
        }).catch(() => {});

        return Response.json({ success: true, message: `Invitation sent to ${cleanEmail}` });
      }

      // 15. /api/invitations/accept (POST)
      if (pathname === '/api/invitations/accept' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const activeUserId = getUserIdFromRequest(request);
        const { operationCode, wishlistId } = body;

        if (!activeUserId || !operationCode) return Response.json({ error: 'Auth and operationCode required' }, { status: 400 });

        const exchange = await db.exchange.findUnique({ where: { code: operationCode.trim().toUpperCase() }, include: { members: true } });
        if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });

        const existing = exchange.members.find((m) => m.userId === activeUserId);
        if (existing) return Response.json({ error: 'Already enrolled in exchange' }, { status: 400 });

        const member = await db.exchangeMember.create({
          data: { exchangeId: exchange.id, userId: activeUserId, wishlistId: wishlistId || null, role: 'MEMBER' },
        });

        return Response.json({ success: true, message: 'Enrolled in exchange', data: member });
      }

      // 16. /api/shipping (POST)
      if (pathname === '/api/shipping' && request.method === 'POST') {
        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as any;
        const { operationId, isLocalDelivery, trackingNumber } = body;

        if (!operationId) return Response.json({ error: 'operationId required' }, { status: 400 });

        const member = await db.exchangeMember.findUnique({
          where: {
            exchangeId_userId: {
              exchangeId: operationId,
              userId: activeUserId,
            },
          },
        });
        if (!member) return Response.json({ error: 'Member not enrolled in this exchange' }, { status: 404 });

        const shippingStatus = isLocalDelivery ? 'LOCAL_DELIVERY' : 'SHIPPED';
        const cleanTracking = trackingNumber?.trim() || null;

        const updatedMember = await db.exchangeMember.update({
          where: { id: member.id },
          data: { shippingStatus, trackingNumber: cleanTracking, shippedAt: new Date() },
        });

        return Response.json({
          success: true,
          message: isLocalDelivery ? 'Local delivery confirmed.' : 'Shipment confirmed!',
          data: updatedMember,
        });
      }

      // 17. /api/demerits/audit (POST)
      if (pathname === '/api/demerits/audit' && request.method === 'POST') {
        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as any;
        const { operationId } = body;

        if (!operationId) return Response.json({ error: 'operationId required' }, { status: 400 });

        const exchange = await db.exchange.findUnique({
          where: { id: operationId },
          include: { members: { include: { user: true } } },
        });
        if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });
        if (exchange.organizerId !== activeUserId) return Response.json({ error: 'Only organizer can run audit' }, { status: 403 });

        const now = new Date();
        if (now < new Date(exchange.executionDate)) {
          return Response.json({ error: 'Audit engine can only be run on or after Execution Day.' }, { status: 400 });
        }

        const auditResults = [];
        for (const member of exchange.members) {
          const outcome = evaluateMemberAudit({
            userId: member.user.id,
            userName: member.user.name,
            shippingStatus: member.shippingStatus as any,
            deliveredConfirmed: member.deliveredConfirmed,
            trackingNumber: member.trackingNumber,
            currentPenaltyPoints: member.user.penaltyPoints,
            currentAccountStatus: member.user.accountStatus as any,
            isWhiteElephant: exchange.isWhiteElephant,
          });

          if (outcome.newDemeritCount !== member.user.penaltyPoints || outcome.newAccountStatus !== member.user.accountStatus) {
            await db.user.update({
              where: { id: member.user.id },
              data: { penaltyPoints: outcome.newDemeritCount, accountStatus: outcome.newAccountStatus },
            });

            if (outcome.penalized) {
              await db.notification.create({
                data: {
                  userId: member.user.id,
                  exchangeId: exchange.id,
                  title: '⚠️ Penalty Issued: Unfulfilled Gift Exchange',
                  message: `You were issued 1 Coal Citation for mission "${exchange.title}". Current Points: ${outcome.newDemeritCount}. Status: ${outcome.newAccountStatus}.`,
                  isAcknowledged: false,
                },
              });
            } else if (outcome.demeritCleared) {
              await db.notification.create({
                data: {
                  userId: member.user.id,
                  exchangeId: exchange.id,
                  title: '🌟 Demerit Cleared: Mission Completed',
                  message: `You fulfilled your obligation in "${exchange.title}". 1 Coal Citation removed. Current Points: ${outcome.newDemeritCount}. Status: ${outcome.newAccountStatus}.`,
                  isAcknowledged: false,
                },
              });
            }
          }
          auditResults.push(outcome);
        }

        await db.exchange.update({ where: { id: exchange.id }, data: { status: 'COMPLETED' } });
        return Response.json({ success: true, message: 'Execution Day audit completed.', data: { operationId: exchange.id, auditResults } });
      }

      // 18. /api/scraper (POST)
      if (pathname === '/api/scraper' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { url } = body;

        if (!url || typeof url !== 'string') return Response.json({ error: 'Valid product URL required' }, { status: 400 });

        const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
        const ssrfCheck = isSafePublicUrl(formattedUrl);
        if (!ssrfCheck.safe) return Response.json({ error: ssrfCheck.error || 'URL forbidden' }, { status: 403 });

        const normalizedUrl = normalizeProductUrl(formattedUrl);
        const parsedUrl = new URL(normalizedUrl);

        const existingCatalog = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const isFresh = existingCatalog && (Date.now() - new Date(existingCatalog.scrapedAt).getTime() < TWENTY_FOUR_HOURS_MS);

        if (existingCatalog && isFresh) {
          return Response.json({
            success: true,
            foundInCatalog: true,
            metadata: {
              id: existingCatalog.id,
              title: existingCatalog.title,
              url: existingCatalog.url,
              price: existingCatalog.price ? Number(existingCatalog.price) : undefined,
              description: existingCatalog.description || undefined,
              thumbnail: existingCatalog.thumbnailUrl || undefined,
              domain: existingCatalog.domain || parsedUrl.hostname,
            },
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        try {
          const response = await fetch(parsedUrl.toString(), {
            signal: controller.signal,
            redirect: 'error',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

          const html = await response.text();
          const $ = cheerio.load(html);

          const title = sanitizeText(
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="title"]').attr('content') ||
            $('title').text() ||
            parsedUrl.hostname
          );

          const image =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="image"]').attr('content') ||
            $('link[rel="image_src"]').attr('href') ||
            null;

          const price =
            $('meta[property="og:price:amount"]').attr('content') ||
            $('meta[property="product:price:amount"]').attr('content') ||
            $('meta[name="price"]').attr('content') ||
            null;

          const description = sanitizeText(
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            ''
          );

          const parsedPrice = price ? parseFloat(price) : 0;
          const cleanDesc = description.substring(0, 300);

          const catalogRecord = await db.productCatalog.upsert({
            where: { url: normalizedUrl },
            create: { url: normalizedUrl, title, price: parsedPrice, description: cleanDesc, thumbnailUrl: image, domain: parsedUrl.hostname },
            update: { title, price: parsedPrice, description: cleanDesc, thumbnailUrl: image, domain: parsedUrl.hostname, scrapedAt: new Date() },
          });

          return Response.json({
            success: true,
            foundInCatalog: false,
            metadata: {
              id: catalogRecord.id,
              title: catalogRecord.title,
              url: catalogRecord.url,
              price: parsedPrice > 0 ? parsedPrice : undefined,
              description: cleanDesc || undefined,
              thumbnail: image || undefined,
              domain: parsedUrl.hostname,
            },
          });
        } catch {
          clearTimeout(timeoutId);
          if (existingCatalog) {
            return Response.json({
              success: true,
              foundInCatalog: true,
              metadata: {
                id: existingCatalog.id,
                title: existingCatalog.title,
                url: existingCatalog.url,
                price: existingCatalog.price ? Number(existingCatalog.price) : undefined,
                description: existingCatalog.description || undefined,
                thumbnail: existingCatalog.thumbnailUrl || undefined,
                domain: existingCatalog.domain || parsedUrl.hostname,
              },
            });
          }
          return Response.json({
            success: false,
            fallback: true,
            metadata: { title: parsedUrl.hostname, url: parsedUrl.toString(), domain: parsedUrl.hostname },
          });
        }
      }

      // 16. /api/opkits (GET / POST / DELETE)
      if (pathname === '/api/opkits') {
        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        if (request.method === 'GET') {
          const wishlists = await db.wishlist.findMany({
            where: { userId: activeUserId },
            include: { wishlistItems: { include: { item: true } } },
            orderBy: { createdAt: 'asc' },
          });
          const formatted = wishlists.map((w, idx) => ({
            id: w.id,
            name: w.name,
            isMaster: idx === 0,
            type: w.type,
            createdAt: w.createdAt,
            opTools: w.wishlistItems.map((wi) => ({
              id: wi.item.id,
              title: wi.item.name,
              price: wi.item.price ? Number(wi.item.price) : undefined,
              url: wi.item.url,
              thumbnail: wi.item.thumbnailUrl || undefined,
              description: wi.item.description || undefined,
            })),
          }));
          return Response.json({ success: true, opKits: formatted });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { action, name, type, wishlistId, title, url: itemUrl, price, description, thumbnail } = body;

          if (action === 'add_optool' || (wishlistId && itemUrl)) {
            const item = await db.item.create({
              data: {
                userId: activeUserId,
                name: sanitizeText(title || 'Item'),
                url: itemUrl.trim(),
                price: price ? Number(price) : 0,
                description: description ? sanitizeText(description) : null,
                thumbnailUrl: thumbnail ? thumbnail.trim() : null,
              },
            });
            await db.wishlistItem.create({ data: { wishlistId, itemId: item.id } });
            return Response.json({ success: true, opTool: { id: item.id, title: item.name, price: Number(item.price), url: item.url } });
          }

          if (name) {
            const newW = await db.wishlist.create({
              data: { userId: activeUserId, name: sanitizeText(name), type: type === 'WHITE_ELEPHANT' ? 'WHITE_ELEPHANT' : 'STANDARD' },
            });
            return Response.json({ success: true, opKit: { id: newW.id, name: newW.name, opTools: [] } });
          }
        }

        if (request.method === 'DELETE') {
          const itemId = url.searchParams.get('itemId');
          const wishlistId = url.searchParams.get('wishlistId');
          if (itemId) {
            await db.item.deleteMany({ where: { id: itemId, userId: activeUserId } });
            return Response.json({ success: true, message: 'Item deleted' });
          }
          if (wishlistId) {
            await db.wishlist.deleteMany({ where: { id: wishlistId, userId: activeUserId } });
            return Response.json({ success: true, message: 'Wishlist deleted' });
          }
        }
      }

      // 17. /api/workshop/auth (GET / POST)
      if (pathname === '/api/workshop/auth') {
        const adminId = getAdminIdFromRequest(request);
        if (adminId) {
          const admin = await adminDb.adminUser.findUnique({ where: { id: adminId } });
          if (admin && admin.isActive) {
            return Response.json({ authenticated: true, authorized: true, isAdmin: true, user: { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN', isWorkshop: true } });
          }
        }

        const userId = getUserIdFromRequest(request);
        if (userId) {
          const user = await db.user.findUnique({ where: { id: userId } });
          if (user) {
            return Response.json({ authenticated: true, authorized: Boolean(user.isWorkshop), isAdmin: false, user });
          }
        }

        return Response.json({ authenticated: false, authorized: false, isAdmin: false, user: null });
      }

    } catch (err: any) {
      console.error('[Worker API Error]', err);
      await invalidateCachedDb().catch(() => {});
      await invalidateCachedAdminDb().catch(() => {});
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Never serve static HTML for unmatched API routes
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: `API route not found: ${pathname}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback: Serve static assets from Cloudflare edge CDN
    return env.ASSETS.fetch(request);
  },
};
