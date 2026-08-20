import bcrypt from 'bcryptjs';
import { adminDb } from './lib/adminDb';
import { db } from './lib/db';
import { validateNistPassword } from './lib/adminAuth';

const ADMIN_COOKIE_NAME = 'kovertklaus_admin_session';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DATABASE_URL?: string;
  DATABASE_ADMIN_URL?: string;
  DIRECT_URL?: string;
  MODE?: string;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
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
      // -----------------------------------------------------------------------
      // 1. /api/northpole/login (POST)
      // -----------------------------------------------------------------------
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
          requiresPasswordReset: false,
          admin: { id: admin.id, name: admin.name, email: admin.email, username: admin.username, role: admin.role },
        }), { status: 200, headers });
      }

      // -----------------------------------------------------------------------
      // 2. /api/northpole/me (GET / DELETE)
      // -----------------------------------------------------------------------
      if (pathname === '/api/northpole/me') {
        const cookieHeader = request.headers.get('cookie');
        const adminId = parseCookie(cookieHeader, ADMIN_COOKIE_NAME);

        if (request.method === 'DELETE') {
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
          return new Response(JSON.stringify({ success: true, message: 'Logged out' }), { status: 200, headers });
        }

        if (!adminId) {
          return Response.json({ authenticated: false }, { status: 200 });
        }

        const admin = await adminDb.adminUser.findUnique({
          where: { id: adminId },
          select: { id: true, email: true, username: true, name: true, role: true, isActive: true, requiresPasswordReset: true },
        });

        if (!admin || !admin.isActive || admin.requiresPasswordReset) {
          return Response.json({ authenticated: false }, { status: 200 });
        }

        return Response.json({ authenticated: true, admin });
      }

      // -----------------------------------------------------------------------
      // 3. /api/northpole/reset-password (POST)
      // -----------------------------------------------------------------------
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
          message: 'Password updated successfully. North Pole clearance unlocked.',
          admin: { id: admin.id, name: admin.name, email: admin.email, username: admin.username, role: admin.role },
        }), { status: 200, headers });
      }

      // -----------------------------------------------------------------------
      // 4. /api/northpole/config (GET / PATCH)
      // -----------------------------------------------------------------------
      if (pathname === '/api/northpole/config') {
        if (request.method === 'GET') {
          const config = await adminDb.systemConfig.findUnique({ where: { id: 'singleton' } });
          const themes = await adminDb.themePreset.findMany({ orderBy: { id: 'asc' } });
          return Response.json({ config, themes });
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

      // -----------------------------------------------------------------------
      // 5. /api/northpole/users (GET / PATCH)
      // -----------------------------------------------------------------------
      if (pathname === '/api/northpole/users') {
        if (request.method === 'GET') {
          const users = await adminDb.user.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, codename: true, penaltyPoints: true, createdAt: true },
          });
          return Response.json({ users, total: users.length });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { userId, penaltyPoints } = body;
          const user = await adminDb.user.update({
            where: { id: userId },
            data: { penaltyPoints },
          });
          return Response.json({ success: true, user });
        }
      }

      // -----------------------------------------------------------------------
      // 6. /api/northpole/operations (GET)
      // -----------------------------------------------------------------------
      if (pathname === '/api/northpole/operations' && request.method === 'GET') {
        const operations = await adminDb.exchange.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { members: true } } },
        });
        return Response.json({ operations, total: operations.length });
      }

      // -----------------------------------------------------------------------
      // 7. /api/config (GET)
      // -----------------------------------------------------------------------
      if (pathname === '/api/config' && request.method === 'GET') {
        const config = await db.systemConfig.findUnique({ where: { id: 'singleton' } });
        const theme = config ? await db.themePreset.findUnique({ where: { id: config.activeThemeId } }) : null;
        return Response.json({ config, theme });
      }

      // -----------------------------------------------------------------------
      // 8. /api/clearance (POST)
      // -----------------------------------------------------------------------
      if (pathname === '/api/clearance' && request.method === 'POST') {
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

    } catch (err: any) {
      console.error('[Worker API Error]', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Serve static assets from Cloudflare edge CDN
    return env.ASSETS.fetch(request);
  },
};
