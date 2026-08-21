import bcrypt from 'bcryptjs';
import { getAdminDb, invalidateCachedAdminDb } from './lib/adminDb';
import { getDb, invalidateCachedDb } from './lib/db';
import { validateNistPassword } from './lib/adminAuth';
import { sanitizeText, isValidEmail, validatePassword, generateInviteCode } from './lib/security';
import { executeLinkedListDraw } from './lib/draw';
import { sendEmail } from './lib/email/dispatcher';
import { sendWelcomeEmail, sendInvitationEmail } from './lib/email';

const ADMIN_COOKIE_NAME = 'kovertklaus_admin_session';
const USER_COOKIE_NAME = 'kovertklaus_session';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DATABASE_URL?: string;
  DATABASE_ADMIN_URL?: string;
  DIRECT_URL?: string;
  MODE?: string;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function getAdminIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, ADMIN_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const customHeader = request.headers.get('x-admin-token');
  if (customHeader) return customHeader.trim();

  return null;
}

function getUserIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, USER_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const customHeader = request.headers.get('x-user-id');
  if (customHeader) return customHeader.trim();

  const url = new URL(request.url);
  const paramUserId = url.searchParams.get('userId');
  if (paramUserId) return paramUserId.trim();

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Populate runtime process.env with Cloudflare Worker bindings
    if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
    if (env.DATABASE_ADMIN_URL) process.env.DATABASE_ADMIN_URL = env.DATABASE_ADMIN_URL;
    if (env.DIRECT_URL) process.env.DIRECT_URL = env.DIRECT_URL;
    if (env.MODE) process.env.MODE = env.MODE;

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

        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=${admin.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: admin.id,
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

        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=${admin.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: admin.id,
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
        if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

        const lead = await db.clearanceLead.upsert({
          where: { email },
          update: { updatedAt: new Date() },
          create: { email, source: 'landing_countdown' },
        });
        return Response.json({ success: true, lead });
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

        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `${USER_COOKIE_NAME}=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);

        return new Response(JSON.stringify({
          success: true,
          token: user.id,
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

          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', `${USER_COOKIE_NAME}=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);

          return new Response(JSON.stringify({ success: true, token: user.id, data: user }), { status: 200, headers });
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
            return Response.json({ success: true, data: exchange });
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
          const userId = activeUserId || body.userId;

          if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

          // Draw action
          if (action === 'draw' && operationId) {
            const ex = await db.exchange.findUnique({ where: { id: operationId }, include: { members: true, exclusionRules: true } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can trigger draws' }, { status: 403 });
            if (ex.members.length < 2) return Response.json({ error: 'At least 2 members required' }, { status: 400 });

            const agents = ex.members.map((m) => ({ id: m.userId, name: m.userId, hasWishlistAttached: !!m.wishlistId }));
            const assignments = executeLinkedListDraw(agents, { isWhiteElephant: ex.isWhiteElephant });

            for (const assignment of assignments) {
              const mem = ex.members.find((m) => m.userId === assignment.agentId);
              if (mem) await db.exchangeMember.update({ where: { id: mem.id }, data: { targetUserId: assignment.targetId } });
            }
            await db.exchange.update({ where: { id: operationId }, data: { status: 'MATCHED' } });
            return Response.json({ success: true, message: 'Draw completed successfully' });
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
      }

      // 14. /api/invitations (POST)
      if (pathname === '/api/invitations' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { operationId, requesterUserId, recipientEmail } = body;
        const activeUserId = getUserIdFromRequest(request) || requesterUserId;

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
        const activeUserId = getUserIdFromRequest(request) || body.userId;
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
      invalidateCachedDb();
      invalidateCachedAdminDb();
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback: Serve static assets from Cloudflare edge CDN
    return env.ASSETS.fetch(request);
  },
};
