import { comparePassword, hashPassword, verifyDummyPassword, isLegacyBcryptHash } from './lib/password';
import * as cheerio from 'cheerio';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getAdminDb, invalidateCachedAdminDb } from './lib/adminDb';
import { toPublicConfig } from './lib/config/publicConfig';
import { buildSystemConfigUpdate } from './lib/config/systemConfigUpdate';
import { EXCHANGE_MEMBERS_INCLUDE, sanitizeExchangeMember } from './lib/exchange-view';
import { runWithDbScope } from './lib/dbRequestScope';
import { getDb, invalidateCachedDb } from './lib/db';
import { validateNistPassword } from './lib/adminAuth';
import {
  sanitizeText,
  isValidEmail,
  validatePassword,
  generateInviteCode,
  isSafePublicUrl,
  normalizeProductUrl,
} from './lib/security';
import { executeLinkedListDraw, executeTargetSwap } from './lib/draw';
import { isSessionRevoked, issueSessionToken, readSessionToken, verifySessionToken, shouldRenewSession, SESSION_TTL_SECONDS, type SessionClaims, type SessionKind } from './lib/session-token';
import { sendEmail } from './lib/email/dispatcher';
import {
  sendWelcomeEmail,
  sendInvitationEmail,
  sendClearanceConfirmationEmail,
  sendClearanceApprovalEmail,
  sendAssignmentEmail,
  sendNudgeEmail,
} from './lib/email';
import { getResolvedEmailConfig } from './lib/email/config';
import { EmailConfig } from './lib/email/types';
import { evaluateMemberAudit } from './lib/demerits';
import { processExchangeAudit } from './lib/audit-runner';
import { advanceMissionLifecycle } from './lib/mission-lifecycle';
import { detectCarrier } from './lib/carrier-tracking';
import { detectProductCategory, getCategorySuggestedKeys, updateCatalogIntelligence, sanitizeItemDetails } from './lib/product-intelligence';
import { validateAndSanitizeManifestItem } from './lib/validations/manifest';
import { validateOperationConfig, validateOperationSettings } from './lib/validations/operation';
import { validateReportInput } from './lib/validations/report';
import { resolveTimelineUpdate } from './lib/validations/timeline';
import { rewriteExchangeShellPath } from './lib/exchange-route';
import { dispatchNudge } from './lib/nudge';
import { listMissionInvitations, listMyInvitations, markInvitationAccepted, resendMissionInvitation, sendMissionInvitation, updateInvitation, type InvitationEmail } from './lib/invitations';
import { listIntelMessages, sendIntelMessage } from './lib/intel-messages';
import { resolveUniqueCodename } from './lib/codename';
import { logSystemEvent, logScraperEvent, logError, logInfo } from './lib/logger';
import { ADMIN_SESSION_COOKIE_NAME } from './lib/adminAuth';
import { SESSION_COOKIE_NAME } from './lib/auth';
import { RELEASE_STAGE } from './lib/version';
import {
  generateKdmToken,
  verifyGiverIdentityGuess,
  evaluateCovertOutcome,
  BADGE_KOVERT_KLAUS,
  BADGE_VIGILANT_ELF,
} from './lib/covertDelivery';
import { PROFILE_DOSSIER_SELECT, buildProfileUpdate, organizerVisibilityAliases } from './lib/profile-update';

const ADMIN_COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;
const USER_COOKIE_NAME = SESSION_COOKIE_NAME;

/**
 * Every API path this worker serves. Used to tell "wrong method" (405) from "no such route" (404),
 * and checked by `worker.test.ts` against `src/app/api/<path>/route.ts`, so a Next.js route can
 * never ship again without its edge counterpart.
 */
export const WORKER_API_PATHS = new Set([
  '/api/clearance',
  '/api/config',
  '/api/demerits/audit',
  '/api/invitations',
  '/api/invitations/accept',
  '/api/leads',
  '/api/messages',
  '/api/northpole/config',
  '/api/northpole/email/test',
  '/api/northpole/leads',
  '/api/northpole/login',
  '/api/northpole/logs',
  '/api/northpole/me',
  '/api/northpole/operations',
  '/api/northpole/reset-password',
  '/api/northpole/setup',
  '/api/northpole/users',
  '/api/operations',
  '/api/operations/lifecycle',
  '/api/opkits',
  '/api/scraper',
  '/api/shipping',
  '/api/users',
  '/api/users/login',
  '/api/users/me',
  '/api/users/profile',
  '/api/workshop/auth',
]);

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
  SESSION_SECRET?: string;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function getAdminIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, ADMIN_COOKIE_NAME);
  const verifiedCookie = verifySessionToken(fromCookie, 'admin');
  if (verifiedCookie) return verifiedCookie;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifySessionToken(authHeader.substring(7).trim(), 'admin');
  }

  return null;
}

/**
 * Resolves the request to an active, fully set-up North Pole administrator, or `null`.
 *
 * Admin and user session tokens share one signing format, so a valid signature alone does not
 * prove the caller is an admin: a user's token would pass `getAdminIdFromRequest`. Looking the ID
 * up in `AdminUser` closes that gap (matching `verifyAdminSession` in the Next.js routes). Every
 * `/api/northpole/*` handler that needs admin rights must gate on this, never on the raw ID.
 */
async function requireAdmin(request: Request, adminDb: ReturnType<typeof getAdminDb>) {
  const adminId = getAdminIdFromRequest(request);
  if (!adminId) return null;
  const admin = await adminDb.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive || admin.requiresPasswordReset) return null;
  return admin;
}

/**
 * Returns the Wishlist Manifest a member should attach when enrolling, creating one if needed.
 *
 * Secret Santa missions use the user's oldest STANDARD manifest; White Elephant missions use a
 * WHITE_ELEPHANT manifest (the single brought gift). Enrolling without one left `wishlistId`
 * null, so the draw saw the agent as having no manifest.
 */
async function resolveMemberWishlistId(db: ReturnType<typeof getDb>, userId: string, isWhiteElephant: boolean): Promise<string> {
  const type = isWhiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD';
  const existing = await db.wishlist.findFirst({ where: { userId, type }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.wishlist.create({
    data: { userId, type, name: isWhiteElephant ? 'White Elephant Gift' : 'Master Wishlist Manifest' },
    select: { id: true },
  });
  return created.id;
}

/** JSON 405 for a known API path called with a method it does not support. */
function methodNotAllowed(pathname: string, method: string): Response {
  return Response.json({ error: `Method ${method} not allowed on ${pathname}` }, { status: 405 });
}

/**
 * Builds the `Set-Cookie` value for a session cookie.
 *
 * The cookie's Max-Age matches the token's signed expiry (`SESSION_TTL_SECONDS`), so the
 * browser drops it at the same moment the server would start rejecting it.
 */
function sessionCookie(kind: SessionKind, token: string): string {
  const name = kind === 'admin' ? ADMIN_COOKIE_NAME : USER_COOKIE_NAME;
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS[kind]}; Secure`;
}

function getUserIdFromRequest(request: Request): string | null {
  if (revokedSessionRequests.has(request)) return null;
  return readUserClaimsFromRequest(request)?.subjectId ?? null;
}

/** Verified user-token claims from the session cookie, or else the Bearer header. */
function readUserClaimsFromRequest(request: Request): SessionClaims | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  const fromCookie = parseCookie(cookieHeader, USER_COOKIE_NAME);
  const cookieClaims = readSessionToken(fromCookie, 'user');
  if (cookieClaims) return cookieClaims;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return readSessionToken(authHeader.substring(7).trim(), 'user');
  }

  return null;
}

/**
 * Requests whose user token was issued before the user's last password change.
 *
 * `getUserIdFromRequest` is synchronous and called from many routes, so the one database lookup
 * (`User.sessionsRevokedAt`) happens once per request in `markRevokedUserSession` and is recorded
 * here. A WeakSet lets each request be collected normally.
 */
const revokedSessionRequests = new WeakSet<Request>();

/**
 * Looks up whether this request's user token was revoked by a password change, once, before routing.
 * Requests without a valid user token skip the lookup.
 */
async function markRevokedUserSession(request: Request, db: PrismaClient): Promise<void> {
  const claims = readUserClaimsFromRequest(request);
  if (!claims) return;
  const user = await db.user.findUnique({ where: { id: claims.subjectId }, select: { sessionsRevokedAt: true } });
  if (!user || isSessionRevoked(claims, user.sessionsRevokedAt)) revokedSessionRequests.add(request);
}

/**
 * Resolves transactional email configuration for the Cloudflare Worker runtime
 * by loading database overrides via Neon and falling back to Worker environment variables.
 *
 * SystemConfig (provider keys) and SystemLog (dispatch logs) live in the admin schema, which the
 * app role cannot read. Given the app client, the config read failed and fell back to env vars, so
 * user-facing mail (invites, welcome, nudges, assignments) went out with no provider configured.
 * The admin client is therefore always preferred; `dbClient` is only a fallback.
 */
async function resolveWorkerEmailConfig(
  env: Env,
  dbClient?: any,
  explicitOverride?: Partial<EmailConfig>
): Promise<EmailConfig> {
  const envMap: Record<string, string | undefined> = {
    BREVO_API_KEY: env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: env.BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME: env.BREVO_SENDER_NAME,
    EMAIL_PROVIDER: env.EMAIL_PROVIDER,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_FROM_NAME: env.EMAIL_FROM_NAME,
    RESEND_API_KEY: env.RESEND_API_KEY,
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_SECURE: env.SMTP_SECURE,
    SMTP_FROM: env.SMTP_FROM,
  };

  // Prioritize admin connection pool for resolving SystemConfig secrets
  const adminConnStr = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL;
  const configDbClient = adminConnStr ? getAdminDb(adminConnStr) : dbClient;

  const resolved = await getResolvedEmailConfig(configDbClient, envMap);
  return { ...resolved, dbClient: configDbClient || dbClient, env, ...explicitOverride };
}




/**
 * Handles one HTTP request. Runs inside a per-request database scope (see `fetch` below).
 */
async function handleFetch(request: Request, env: Env): Promise<Response> {
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
    if (env.SESSION_SECRET) process.env.SESSION_SECRET = env.SESSION_SECRET;

    try {
      const adminConnStr = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL || process.env.DATABASE_ADMIN_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
      const appConnStr = env.DATABASE_URL || env.DATABASE_ADMIN_URL || env.DIRECT_URL || process.env.DATABASE_URL || process.env.DATABASE_ADMIN_URL;

      const adminDb = getAdminDb(adminConnStr);
      const db = getDb(appConnStr);

      // Reject user tokens issued before a password change (one lookup, only when a token is present).
      await markRevokedUserSession(request, db);

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
          await verifyDummyPassword(password);
          return Response.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
        }

        const passwordMatch = await comparePassword(password, admin.passwordHash);
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

        const adminUpdateData: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
        if (isLegacyBcryptHash(admin.passwordHash)) {
          adminUpdateData.passwordHash = await hashPassword(password);
        }

        await adminDb.adminUser.update({
          where: { id: admin.id },
          data: adminUpdateData,
        });

        const signedAdminId = issueSessionToken('admin', admin.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', sessionCookie('admin', signedAdminId));

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

        const currentMatch = await comparePassword(currentPassword, admin.passwordHash);
        if (!currentMatch) {
          return Response.json({ error: 'Current password verification failed' }, { status: 401 });
        }

        const nistCheck = validateNistPassword(newPassword, admin.username || admin.email);
        if (!nistCheck.isValid) {
          return Response.json({ error: nistCheck.error }, { status: 400 });
        }

        const newHash = await hashPassword(newPassword);
        await adminDb.adminUser.update({
          where: { id: adminId },
          data: { passwordHash: newHash, requiresPasswordReset: false, lastLoginAt: new Date() },
        });

        const signedAdminId = issueSessionToken('admin', admin.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', sessionCookie('admin', signedAdminId));

        return new Response(JSON.stringify({
          success: true,
          token: signedAdminId,
          message: 'Password updated successfully. North Pole clearance unlocked.',
          admin: { id: admin.id, name: admin.name, email: admin.email, username: admin.username, role: admin.role },
        }), { status: 200, headers });
      }

      // 4. /api/northpole/config (GET / PATCH)
      if (pathname === '/api/northpole/config') {
        // SystemConfig holds provider API keys and SMTP credentials: admins only.
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        if (request.method === 'GET') {
          const [config, themes, totalUsers, totalOperations, totalLeads, approvedLeadsCount] = await Promise.all([
            adminDb.systemConfig.findUnique({ where: { id: 'singleton' } }),
            adminDb.themePreset.findMany({ orderBy: { id: 'asc' } }),
            adminDb.user.count(),
            adminDb.exchange.count(),
            adminDb.clearanceLead.count(),
            adminDb.clearanceLead.count({ where: { status: 'APPROVED' } }),
          ]);
          return Response.json({
            success: true,
            config: config ? { ...config, appMode: 'saas' } : config, // The edge worker only serves the SaaS edition
            themes,
            stats: {
              totalUsers,
              totalOperations,
              totalLeads,
              approvedLeadsCount,
              workshopUsersCount: 0,
            },
          });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const updateData = buildSystemConfigUpdate(body, admin.id);
          const updated = await adminDb.systemConfig.upsert({
            where: { id: 'singleton' },
            update: updateData,
            create: {
              id: 'singleton',
              activeThemeId: (updateData.activeThemeId as string | undefined) || 'winter_holiday',
              ...updateData,
            },
          });
          return Response.json({ success: true, config: { ...updated, appMode: 'saas' } });
        }
        return methodNotAllowed(pathname, request.method);
      }

      // 5. /api/northpole/users (GET / PATCH)
      if (pathname === '/api/northpole/users') {
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        if (request.method === 'GET') {
          const id = url.searchParams.get('id')?.trim();
          const q = (url.searchParams.get('q') || '').trim().toLowerCase();
          const workshop = url.searchParams.get('workshop') === 'true';
          const filterWorkshop = url.searchParams.get('workshop');

          const totalCount = await adminDb.user.count();

          // 1. Exact ID Lookup
          if (id) {
            const user = await adminDb.user.findUnique({
              where: { id },
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

            return Response.json({
              success: true,
              users: user
                ? [
                    {
                      ...user,
                      demerits: user.penaltyPoints ?? 0,
                      accountStatus: user.accountStatus || 'ACTIVE',
                      organizedCount: user._count?.createdExchanges ?? 0,
                      joinedCount: user._count?.participations ?? 0,
                      wishlistsCount: user._count?.wishlists ?? 0,
                    },
                  ]
                : [],
              totalCount,
            });
          }

          // 2. Unconstrained initial load -> Zero DB I/O payload
          if (!q && filterWorkshop === null) {
            return Response.json({
              success: true,
              users: [],
              totalCount,
              message: 'Enter an operative ID, email, or codename to inspect on demand.',
            });
          }

          const whereClause: any = {};
          if (workshop) whereClause.isWorkshop = true;
          if (q) {
            whereClause.OR = [
              { id: { equals: q } },
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { codename: { contains: q, mode: 'insensitive' } },
            ];
          }

          const rawUsers = await adminDb.user.findMany({
            where: whereClause,
            take: 25,
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

          return Response.json({ success: true, users: formatted, totalCount });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { userId, penaltyPoints, isWorkshop, accountStatus, codename } = body;
          if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
          const points = penaltyPoints !== undefined ? Number(penaltyPoints) : undefined;
          if (points !== undefined && (!Number.isInteger(points) || points < 0)) {
            return Response.json({ error: 'penaltyPoints must be a non-negative integer' }, { status: 400 });
          }
          const user = await adminDb.user.update({
            where: { id: userId },
            data: {
              ...(points !== undefined ? { penaltyPoints: points } : {}),
              ...(isWorkshop !== undefined ? { isWorkshop: Boolean(isWorkshop) } : {}),
              ...(accountStatus !== undefined ? { accountStatus } : {}),
              ...(codename !== undefined ? { codename: codename ? sanitizeText(String(codename)) : null } : {}),
            },
            // Never return credential columns (passwordHash) to the browser.
            select: {
              id: true, name: true, email: true, codename: true, penaltyPoints: true,
              accountStatus: true, isWorkshop: true, createdAt: true,
            },
          });
          return Response.json({ success: true, user: { ...user, demerits: user.penaltyPoints } });
        }
        return methodNotAllowed(pathname, request.method);
      }

      // 6. /api/northpole/operations (GET)
      if (pathname === '/api/northpole/operations' && request.method === 'GET') {
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const id = url.searchParams.get('id')?.trim();
        const code = url.searchParams.get('code')?.trim().toUpperCase();
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();

        const totalCount = await adminDb.exchange.count();

        // 1. Exact ID or Code Lookup
        if (id || code) {
          const op = await adminDb.exchange.findFirst({
            where: id ? { id } : { code },
            include: {
              organizer: { select: { id: true, name: true, email: true, codename: true } },
              _count: { select: { members: true, exclusionRules: true, reports: true } },
            },
          });

          return Response.json({
            success: true,
            operations: op
              ? [
                  {
                    ...op,
                    organizer: op.organizer || { id: '', name: 'System Organizer', email: 'admin@kovertklaus.com' },
                    membersCount: op._count?.members ?? 0,
                    rulesCount: op._count?.exclusionRules ?? 0,
                    reportsCount: op._count?.reports ?? 0,
                    budgetMin: op.budgetMin ? Number(op.budgetMin) : 0,
                    budgetMax: op.budgetMax ? Number(op.budgetMax) : 0,
                  },
                ]
              : [],
            totalCount,
          });
        }

        // 2. Unconstrained initial load -> Zero DB I/O payload
        if (!q) {
          return Response.json({
            success: true,
            operations: [],
            totalCount,
            message: 'Enter an operation code, title, or ID to inspect on demand.',
          });
        }

        const whereClause: any = {};
        if (q) {
          whereClause.OR = [
            { id: { equals: q } },
            { code: { contains: q.toUpperCase() } },
            { title: { contains: q, mode: 'insensitive' } },
          ];
        }

        const rawOps = await adminDb.exchange.findMany({
          where: whereClause,
          take: 25,
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

        return Response.json({ success: true, operations: formatted, totalCount });
      }

      // 7. /api/northpole/email/test (POST)
      if (pathname === '/api/northpole/email/test' && request.method === 'POST') {
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as any;
        const targetEmail = (body.recipientEmail || admin.email).trim();

        const emailConfig = await resolveWorkerEmailConfig(env, adminDb, body.overrideConfig);

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
          emailConfig
        );

        return Response.json({
          success: result.success,
          result,
          message: result.success ? `Test email dispatched via ${result.provider}` : `Email failed: ${result.error}`,
        });
      }

      // 7b. /api/northpole/leads (GET / DELETE / POST)
      if (pathname === '/api/northpole/leads') {
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const adminId = admin.id;

        if (request.method === 'GET') {
          const query = (url.searchParams.get('q') || '').trim().toLowerCase();
          const status = (url.searchParams.get('status') || '').trim().toUpperCase();

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

          return Response.json({
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
        }

        if (request.method === 'DELETE') {
          let id = url.searchParams.get('id');
          if (!id) {
            const body = (await request.json().catch(() => ({}))) as any;
            id = body?.id;
          }

          if (!id) {
            return Response.json({ error: 'Lead ID is required for deletion' }, { status: 400 });
          }

          const existing = await adminDb.clearanceLead.findUnique({ where: { id } });
          if (!existing) {
            return Response.json({ error: 'Clearance reservation not found' }, { status: 404 });
          }

          await adminDb.clearanceLead.delete({ where: { id } });
          return Response.json({
            success: true,
            message: `Reservation for ${existing.email} successfully purged from clearance queue.`,
            deletedLeadId: id,
          });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { action, id, email } = body;

          if (action === 'resend_confirmation') {
            const lead = id
              ? await adminDb.clearanceLead.findUnique({ where: { id } })
              : email
              ? await adminDb.clearanceLead.findUnique({ where: { email: email.trim().toLowerCase() } })
              : null;

            if (!lead) {
              return Response.json({ error: 'Clearance lead not found' }, { status: 404 });
            }

            const totalLeads = await adminDb.clearanceLead.count();
            const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
            const emailResult = await sendClearanceConfirmationEmail({
              to: lead.email,
              name: lead.name || undefined,
              positionNumber: totalLeads,
              overrideConfig: emailConfig,
            });

            if (!emailResult.success) {
              await logError('EMAIL', `Failed to resend clearance confirmation to ${lead.email}: ${emailResult.error}`, {
                dbClient: adminDb,
                metadata: { email: lead.email, leadId: lead.id, provider: emailResult.provider, error: emailResult.error },
                path: pathname,
                statusCode: 500,
                env,
              }).catch(() => {});
            } else {
              await logInfo('EMAIL', `Clearance confirmation re-dispatched to ${lead.email} via ${emailResult.provider}`, {
                dbClient: adminDb,
                metadata: { email: lead.email, leadId: lead.id, provider: emailResult.provider, attempts: emailResult.attempts },
                path: pathname,
                statusCode: 200,
                env,
              }).catch(() => {});
            }

            return Response.json({
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
              return Response.json({ error: 'Clearance lead not found' }, { status: 404 });
            }

            const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')
              .toUpperCase();
            const inviteCode = `ALPHA-${hex}`;

            await adminDb.preLaunchApproval.upsert({
              where: { email: lead.email.toLowerCase() },
              update: { inviteCode },
              create: {
                email: lead.email.toLowerCase(),
                inviteCode,
              },
            });

            await adminDb.clearanceLead.update({
              where: { id: lead.id },
              data: { status: 'APPROVED' },
            });

            const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
            const appUrl = (new URL(request.url)).origin || 'https://kovertklaus.com';
            const registrationUrl = `${appUrl}/register?code=${inviteCode}&email=${encodeURIComponent(lead.email)}`;

            const emailResult = await sendClearanceApprovalEmail({
              to: lead.email,
              name: lead.name || undefined,
              inviteCode,
              registrationUrl,
              overrideConfig: emailConfig,
            });

            if (!emailResult.success) {
              await logError('EMAIL', `Failed to dispatch Alpha clearance approval to ${lead.email}: ${emailResult.error}`, {
                dbClient: adminDb,
                metadata: { email: lead.email, leadId: lead.id, inviteCode, provider: emailResult.provider, error: emailResult.error },
                path: pathname,
                statusCode: 500,
                env,
              }).catch(() => {});
            } else {
              await logInfo('ADMIN', `Admin approved Alpha clearance for ${lead.email} (Cipher: ${inviteCode})`, {
                dbClient: adminDb,
                metadata: { adminId, email: lead.email, inviteCode, provider: emailResult.provider },
                path: pathname,
                statusCode: 200,
                env,
              }).catch(() => {});
            }

            return Response.json({
              success: true,
              inviteCode,
              status: 'APPROVED',
              emailResult,
              message: emailResult.success
                ? `Alpha clearance approved! Cipher ${inviteCode} dispatched to ${lead.email}.`
                : `Alpha clearance approved with cipher ${inviteCode}, but email dispatch failed: ${emailResult.error}`,
            });
          }

          return Response.json({ error: 'Unsupported action' }, { status: 400 });
        }
      }

      // 7c. /api/northpole/logs (GET / DELETE)
      if (pathname === '/api/northpole/logs') {
        const admin = await requireAdmin(request, adminDb);
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        if (request.method === 'GET') {
          const query = (url.searchParams.get('q') || '').trim().toLowerCase();
          const level = (url.searchParams.get('level') || '').trim().toUpperCase();
          const category = (url.searchParams.get('category') || '').trim().toUpperCase();
          const take = Math.min(100, Math.max(1, parseInt(url.searchParams.get('take') || '50', 10)));
          const skip = Math.max(0, parseInt(url.searchParams.get('skip') || '0', 10));

          const whereClause: any = {};

          if (query) {
            whereClause.OR = [
              { message: { contains: query, mode: 'insensitive' } },
              { path: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
            ];
          }

          if (level && ['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(level)) {
            whereClause.level = level;
          }

          if (category) {
            whereClause.category = category;
          }

          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          const [logs, totalCount, error24hCount, warn24hCount, emailFailures24hCount, totalTableCount] = await Promise.all([
            adminDb.systemLog.findMany({
              where: whereClause,
              orderBy: { createdAt: 'desc' },
              take,
              skip,
            }),
            adminDb.systemLog.count({ where: whereClause }),
            adminDb.systemLog.count({
              where: { level: 'ERROR', createdAt: { gte: twentyFourHoursAgo } },
            }),
            adminDb.systemLog.count({
              where: { level: 'WARN', createdAt: { gte: twentyFourHoursAgo } },
            }),
            adminDb.systemLog.count({
              where: { category: 'EMAIL', level: 'ERROR', createdAt: { gte: twentyFourHoursAgo } },
            }),
            adminDb.systemLog.count(),
          ]);

          const estimatedSizeBytes = totalTableCount * 450;

          return Response.json({
            success: true,
            logs,
            totalCount,
            metrics: {
              error24hCount,
              warn24hCount,
              emailFailures24hCount,
              totalTableCount,
              estimatedSizeBytes,
              storageCapBytes: 2.5 * 1024 * 1024,
            },
          });
        }

        if (request.method === 'DELETE') {
          const body = (await request.json().catch(() => ({}))) as {
            action?: 'purge_by_days' | 'clear_all';
            days?: number;
          };

          const action = body.action || 'purge_by_days';
          const days = body.days || 14;

          if (action === 'clear_all') {
            const deleteResult = await adminDb.systemLog.deleteMany({});
            return Response.json({
              success: true,
              message: `Successfully purged all ${deleteResult.count} log records.`,
              deletedCount: deleteResult.count,
            });
          }

          const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const deleteResult = await adminDb.systemLog.deleteMany({
            where: { createdAt: { lt: cutoffDate } },
          });

          return Response.json({
            success: true,
            message: `Successfully purged ${deleteResult.count} log records older than ${days} days.`,
            deletedCount: deleteResult.count,
          });
        }
      }


      // =======================================================================
      // SECTION 2: USER APPLICATION & PUBLIC ENDPOINTS
      // =======================================================================

      // 7d. Self-hosted-only endpoints. The SaaS edge answers them explicitly instead of 404ing:
      // first-run setup never applies here (admins are provisioned), and the developer Workshop
      // is retained for self-hosted installs only (AGENTS.md §9).
      if (pathname === '/api/northpole/setup') {
        if (request.method === 'GET') return Response.json({ setupRequired: false });
        return Response.json({ error: 'First-run setup is only available on self-hosted installs.' }, { status: 403 });
      }
      if (pathname === '/api/workshop/auth' && request.method === 'GET') {
        return Response.json({
          authenticated: false,
          authorized: false,
          isAdmin: false,
          user: null,
          reason: 'workshop_selfhosted_only',
        });
      }

      // 8. /api/config (GET)
      if (pathname === '/api/config' && request.method === 'GET') {
        // Public, allowlisted view only (toPublicConfig): SystemConfig also holds SMTP/API secrets.
        // Read via adminDb: SystemConfig lives in the admin schema the app role cannot reach.
        // The edge worker only serves the SaaS edition.
        const config = await adminDb.systemConfig.findUnique({ where: { id: 'singleton' } });
        const theme = config ? await adminDb.themePreset.findUnique({ where: { id: config.activeThemeId } }) : null;
        return Response.json(toPublicConfig(config, theme, 'saas'), {
          headers: { 'Cache-Control': 'public, max-age=60' },
        });
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

        let totalLeads = 0;
        let lead: any = null;
        try {
          totalLeads = await db.clearanceLead.count();
          lead = await db.clearanceLead.upsert({
            where: { email },
            update: { updatedAt: new Date(), ...(name ? { name: sanitizeText(name) } : {}) },
            create: { email, name: name ? sanitizeText(name) : undefined, source: sanitizeText(source) },
          });
        } catch (dbErr: any) {
          console.warn('[Clearance Lead DB Fallback to Admin]', dbErr?.message);
          totalLeads = await adminDb.clearanceLead.count();
          lead = await adminDb.clearanceLead.upsert({
            where: { email },
            update: { updatedAt: new Date(), ...(name ? { name: sanitizeText(name) } : {}) },
            create: { email, name: name ? sanitizeText(name) : undefined, source: sanitizeText(source) },
          });
        }

        // Dispatch Confirmation Email via configured Email Dispatcher
        let emailResult: any = null;
        try {
          const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
          emailResult = await sendClearanceConfirmationEmail({
            to: email,
            name: name || undefined,
            positionNumber: totalLeads + 1,
            overrideConfig: emailConfig,
          });

          if (!emailResult?.success) {
            await logError('EMAIL', `Clearance briefing dispatch failed for ${email}: ${emailResult?.error || 'Unknown error'}`, {
              dbClient: adminDb,
              metadata: { email, source, provider: emailResult?.provider, error: emailResult?.error },
              path: pathname,
              statusCode: 500,
              env,
            }).catch(() => {});
          } else {
            await logInfo('EMAIL', `Clearance briefing dispatched to ${email} via ${emailResult.provider}`, {
              dbClient: adminDb,
              metadata: { email, source, provider: emailResult.provider, position: totalLeads + 1 },
              path: pathname,
              statusCode: 200,
              env,
            }).catch(() => {});
          }
        } catch (emailErr: any) {
          console.error('[Clearance Email Dispatch Error]', emailErr);
          await logError('EMAIL', `Clearance email exception for ${email}: ${emailErr?.message || emailErr}`, {
            dbClient: adminDb,
            metadata: { email, source, stack: emailErr?.stack },
            path: pathname,
            statusCode: 500,
            env,
          }).catch(() => {});
        }

        return Response.json({
          success: true,
          lead,
          emailDispatched: Boolean(emailResult?.success),
          provider: emailResult?.provider || emailResult?.mode,
          message: emailResult?.success
            ? 'Clearance access confirmed! Encrypted briefing dispatched to your inbox.'
            : emailResult?.error
            ? `Clearance request logged, but dispatch failed: ${emailResult.error}`
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
          await verifyDummyPassword(password);
          return Response.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const match = await comparePassword(password, user.passwordHash);
        if (!match) return Response.json({ error: 'Invalid email or password' }, { status: 401 });

        if (isLegacyBcryptHash(user.passwordHash)) {
          try {
            const upgraded = await hashPassword(password);
            await db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
          } catch (e) {
            console.error('Password hash upgrade failed:', e);
          }
        }

        const signedUserId = issueSessionToken('user', user.id);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', sessionCookie('user', signedUserId));

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
              id: true, email: true, name: true, codename: true, emailNotifications: true,
              penaltyPoints: true, isWorkshop: true, accountStatus: true, createdAt: true,
              ...PROFILE_DOSSIER_SELECT,
              participations: {
                include: {
                  exchange: {
                    select: {
                      id: true, title: true, code: true, isLocalOnly: true, isWhiteElephant: true, budgetMin: true,
                      budgetMax: true, currency: true, inviteCutoffDate: true, assignmentDate: true, shippingDate: true,
                      executionDate: true, status: true, organizerId: true, organizer: { select: { name: true, codename: true } },
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
            await db.wishlist.create({ data: { userId: user.id, name: 'Master Wishlist Manifest - Secret Santa', type: 'STANDARD' } });
            const refetched = await db.wishlist.findMany({ where: { userId: user.id }, include: { wishlistItems: { include: { item: true } } } });
            user = { ...user, wishlists: refetched };
          }

          const formattedWishlists = user.wishlists.map((w, idx) => {
            const items = w.wishlistItems.map((wi) => ({
              id: wi.item.id,
              title: wi.item.name,
              price: wi.item.price ? Number(wi.item.price) : undefined,
              url: wi.item.url,
              thumbnail: wi.item.thumbnailUrl || undefined,
              description: wi.item.description || undefined,
            }));
            return {
              id: w.id,
              name: w.name,
              isMaster: idx === 0,
              type: w.type,
              createdAt: w.createdAt,
              manifestItems: items,
              opTools: items,
            };
          });

          // Sliding expiry: re-issue the cookie once half its lifetime is used.
          const meHeaders = new Headers();
          const claims = readSessionToken(parseCookie(request.headers.get('cookie'), USER_COOKIE_NAME), 'user');
          if (claims && shouldRenewSession(claims, 'user')) {
            meHeaders.append('Set-Cookie', sessionCookie('user', issueSessionToken('user', claims.subjectId)));
          }

          return Response.json({
            success: true,
            authenticated: true,
            user: { ...user, ...organizerVisibilityAliases(user), demerits: user.penaltyPoints, wishlists: formattedWishlists },
          }, { headers: meHeaders });
        }

        // The preferences modal sends PUT; PATCH stays for existing callers.
        if (request.method === 'PATCH' || request.method === 'PUT') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { name, codename, emailNotifications, newPassword } = body;
          const oldPassword = body.currentPassword ?? body.oldPassword;
          const updateData: Record<string, any> = buildProfileUpdate(body);

          if (name) updateData.name = sanitizeText(name);
          if (codename) updateData.codename = sanitizeText(codename);
          if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);

          if (newPassword) {
            if (!oldPassword) return Response.json({ error: 'Current password required' }, { status: 400 });
            const user = await db.user.findUnique({ where: { id: userId } });
            if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
            const match = await comparePassword(oldPassword, user.passwordHash);
            if (!match) return Response.json({ error: 'Incorrect current password' }, { status: 400 });
            const passCheck = validatePassword(newPassword);
            if (!passCheck.isValid) return Response.json({ error: passCheck.error }, { status: 400 });
            updateData.passwordHash = await hashPassword(newPassword);
            // Sign out every other device; this one gets a fresh token below.
            updateData.sessionsRevokedAt = new Date();
          }

          const updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData,
            select: {
              id: true, email: true, name: true, codename: true, emailNotifications: true, ...PROFILE_DOSSIER_SELECT,
            },
          });

          const prefHeaders = new Headers();
          if (updateData.sessionsRevokedAt) prefHeaders.append('Set-Cookie', sessionCookie('user', issueSessionToken('user', userId)));
          return Response.json({
            success: true,
            message: 'Preferences updated',
            user: { ...updatedUser, ...organizerVisibilityAliases(updatedUser) },
          }, { headers: prefHeaders });
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

        // Alpha Gate: Closed Friend-of-a-Friend Secret Santa Invitation Invariant
        const isAlpha = RELEASE_STAGE === 'ALPHA' || RELEASE_STAGE === 'PRE_ALPHA';
        const rawInviteCode = body.inviteCode || body.operationCode || body.exchangeCode || body.code || body.alphaCode;

        const cleanEmail = email.trim().toLowerCase();
        let targetExchange: any = null;
        let matchedPreLaunchApproval: any = null;

        if (isAlpha) {
          if (!rawInviteCode) {
            return Response.json(
              {
                error:
                  'Direct registration is closed during Alpha. You must be invited to a Secret Santa mission, or enter your approved Pre-Launch Alpha activation cipher.',
              },
              { status: 403 }
            );
          }

          const cleanCode = String(rawInviteCode).trim().toUpperCase();

          // 1. Check if the code matches an active PreLaunchApproval for this email address
          matchedPreLaunchApproval = await db.preLaunchApproval.findFirst({
            where: {
              email: { equals: cleanEmail, mode: 'insensitive' },
              inviteCode: cleanCode,
            },
          });

          // 2. If not a pre-launch clearance cipher, check if it is a valid Exchange invitation code
          if (!matchedPreLaunchApproval) {
            targetExchange = await db.exchange.findUnique({
              where: { code: cleanCode },
              include: { members: true },
            });

            if (!targetExchange) {
              return Response.json(
                { error: 'Invalid invitation code or pre-launch alpha cipher. Please verify your activation link.' },
                { status: 404 }
              );
            }

            if (targetExchange.status !== 'RECRUITING') {
              return Response.json(
                { error: 'Recruitment for this mission has closed. Operatives cannot join active or completed missions.' },
                { status: 400 }
              );
            }

            if (targetExchange.maxParticipants && targetExchange.members.length >= targetExchange.maxParticipants) {
              return Response.json(
                { error: 'This exchange has reached its maximum operative capacity.' },
                { status: 400 }
              );
            }
          }
        } else if (rawInviteCode) {
          const cleanCode = String(rawInviteCode).trim().toUpperCase();
          matchedPreLaunchApproval = await db.preLaunchApproval.findFirst({
            where: {
              email: { equals: cleanEmail, mode: 'insensitive' },
              inviteCode: cleanCode,
            },
          });

          if (!matchedPreLaunchApproval) {
            targetExchange = await db.exchange.findUnique({
              where: { code: cleanCode },
              include: { members: true },
            });
          }
        }

        const passwordHash = await hashPassword(password);

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

          // If registered via PreLaunchApproval, immediately consume & remove the code to prevent reuse
          if (matchedPreLaunchApproval) {
            try {
              await db.preLaunchApproval.delete({
                where: { id: matchedPreLaunchApproval.id },
              });
              await logInfo('AUTH', `Operative ${user.email} successfully completed Alpha registration using PreLaunchApproval cipher ${matchedPreLaunchApproval.inviteCode}`, {
                dbClient: db,
                metadata: { userId: user.id, email: user.email, inviteCode: matchedPreLaunchApproval.inviteCode },
                path: pathname,
                statusCode: 201,
                env,
              }).catch(() => {});
            } catch (cleanupErr) {
              console.warn('[Worker PreLaunchApproval Cleanup Warning]', cleanupErr);
            }
          }

          // Auto-enroll if registering via mission invite
          if (targetExchange) {
            try {
              const targetType = targetExchange.isWhiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD';
              const userManifest = await db.wishlist.create({
                data: {
                  userId: user.id,
                  name: targetExchange.isWhiteElephant ? 'White Elephant Gift' : 'Master Wishlist Manifest',
                  type: targetType,
                },
              });

              await db.exchangeMember.create({
                data: {
                  exchangeId: targetExchange.id,
                  userId: user.id,
                  codename: user.codename,
                  role: 'MEMBER',
                  wishlistId: userManifest.id,
                },
              });
              await markInvitationAccepted(db, targetExchange.id, user.email, user.id);
            } catch (enrollErr) {
              console.warn('[Worker Auto-Enroll Warning]', enrollErr);
            }
          }

          try {
            const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
            await sendWelcomeEmail({
              to: user.email,
              name: user.name,
              codename: user.codename || undefined,
              overrideConfig: emailConfig,
            });
          } catch (welcomeErr) {
            console.warn('[Welcome Email Error]', welcomeErr);
          }

          const signedUserId = issueSessionToken('user', user.id);
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie', sessionCookie('user', signedUserId));

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
                members: { include: EXCHANGE_MEMBERS_INCLUDE },
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
            const sanitizedMembers = exchange.members.map((m) => sanitizeExchangeMember(m, { activeUserId, isOrganizer, organizerId: exchange.organizerId }));

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
            if (ex.members.length < 4) return Response.json({ error: 'At least 4 members required. Perfect for families and groups of 4 or more!' }, { status: 400 });

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
              const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
              const enrolledUsers = await db.user.findMany({
                where: { id: { in: ex.members.map((m) => m.userId) } },
              });
              const emailPromises = assignments.map(async (assignment) => {
                const giver = enrolledUsers.find((u) => u.id === assignment.agentId);
                const target = enrolledUsers.find((u) => u.id === assignment.targetId);
                if (giver?.email && giver.emailNotifications !== false && target) {
                  return sendAssignmentEmail({
                    recipientEmail: giver.email,
                    recipientName: giver.name || giver.codename || 'Operative',
                    targetCodename: target.codename || target.name || 'Target Operative',
                    targetName: target.name || undefined,
                    exchangeTitle: ex.title,
                    shippingDeadline: ex.shippingDate ? new Date(ex.shippingDate).toLocaleDateString() : undefined,
                    exchangeDate: ex.executionDate ? new Date(ex.executionDate).toLocaleDateString() : undefined,
                    exchangeUrl: `https://kovertklaus.com/exchange/${ex.code}`,
                    overrideConfig: emailConfig,
                  });
                }
                return null;
              });
              await Promise.allSettled(emailPromises);
            } catch (emailErr) {
              console.error('[Draw Email Dispatch Error]', emailErr);
            }

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

          // Action 3: Add Exclusion Rule (bidirectional in the draw; both agents must be enrolled here)
          if (action === 'addExclusion' && operationId) {
            const { agentId: memberId, restrictedAgentId: restrictedMemberId } = body;
            if (!memberId || !restrictedMemberId) {
              return Response.json({ error: 'agentId and restrictedAgentId required' }, { status: 400 });
            }
            if (memberId === restrictedMemberId) {
              return Response.json({ error: 'An agent cannot be excluded from themselves' }, { status: 400 });
            }

            const ex = await db.exchange.findUnique({ where: { id: operationId }, include: { members: { select: { userId: true } } } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can configure exclusions' }, { status: 403 });
            const enrolled = new Set(ex.members.map((m) => m.userId));
            if (!enrolled.has(memberId) || !enrolled.has(restrictedMemberId)) {
              return Response.json({ error: 'Both agents must be enrolled in this operation' }, { status: 400 });
            }

            const existing = await db.exclusionRule.findFirst({
              where: {
                exchangeId: operationId,
                OR: [
                  { memberId, restrictedMemberId },
                  { memberId: restrictedMemberId, restrictedMemberId: memberId },
                ],
              },
            });
            if (existing) return Response.json({ error: 'This preventative match rule already exists' }, { status: 409 });

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

            // Scoped to this exchange: an organizer can only remove their own mission's rules.
            const removed = await db.exclusionRule.deleteMany({ where: { id: exclusionId, exchangeId: operationId } });
            if (removed.count === 0) return Response.json({ error: 'Exclusion rule not found' }, { status: 404 });
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
            const ex = await db.exchange.findUnique({
              where: { id: operationId },
              include: { members: { include: { user: true } } },
            });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Only organizer can end exchange' }, { status: 403 });

            const { applyDemerits } = body;
            let auditResults = null;
            if (applyDemerits && ex.enforcePenalties !== false) {
              auditResults = await processExchangeAudit(db, ex);
            } else {
              await db.exchange.update({
                where: { id: operationId },
                data: { executionDate: new Date(), status: 'COMPLETED', completedAt: ex.completedAt ?? new Date() },
              });
            }

            return Response.json({
              success: true,
              message: auditResults
                ? `Operation completed and demerit audit applied across ${ex.members.length} operatives!`
                : 'Exchange ended and marked as COMPLETED.',
              auditResults,
            });
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

            try {
              const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
              const broadcastPromises = ex.members.map(async (member) => {
                if (member.user.email && member.user.emailNotifications !== false) {
                  return sendNudgeEmail({
                    recipientEmail: member.user.email,
                    recipientName: member.user.name || member.user.codename || 'Operative',
                    organizerName: ex.organizer.name,
                    exchangeTitle: ex.title,
                    message: messageText.trim(),
                    actionUrl: `https://kovertklaus.com/exchange/${ex.code}`,
                    overrideConfig: emailConfig,
                  });
                }
                return null;
              });
              await Promise.allSettled(broadcastPromises);
            } catch (broadcastErr) {
              console.error('[Broadcast Email Error]', broadcastErr);
            }

            return Response.json({ success: true, message: 'Broadcast dispatched' });
          }

          // Action 8: Create Report (After-Action Report entries are for enrolled agents only)
          if (action === 'createReport' && operationId) {
            const { thankYouText, photoUrl } = body;
            const reportError = validateReportInput(thankYouText, photoUrl);
            if (reportError) return Response.json({ error: reportError }, { status: 400 });
            const member = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId } },
            });
            if (!member) return Response.json({ error: 'Only enrolled agents can post to this After-Action Report' }, { status: 403 });
            const report = await db.exchangeReport.create({
              data: {
                exchangeId: operationId,
                userId,
                thankYouText: thankYouText ? sanitizeText(thankYouText) : null,
                photoUrl: photoUrl?.trim() || null,
              },
              include: {
                user: { select: { id: true, name: true, codename: true } },
              },
            });
            return Response.json({ success: true, message: 'Exchange Report entry posted!', data: report });
          }

          // Action 9: Create KDM Tokens
          if (action === 'createKdmTokens' && operationId) {
            const { count = 5, invitedNames = [] } = body;
            const ex = await db.exchange.findUnique({ where: { id: operationId } });
            if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
            if (ex.organizerId !== userId) return Response.json({ error: 'Organizer only' }, { status: 403 });

            const numTokens = Math.min(Math.max(1, count), 50);
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);
            const tokensToInsert = Array.from({ length: numTokens }).map((_, i) => ({
              exchangeId: operationId,
              token: generateKdmToken(),
              invitedName: invitedNames[i]?.trim() || null,
              expiresAt,
            }));

            await db.covertInviteToken.createMany({ data: tokensToInsert });
            const allTokens = await db.covertInviteToken.findMany({
              where: { exchangeId: operationId },
              orderBy: { createdAt: 'desc' },
            });
            return Response.json({ success: true, data: allTokens });
          }

          // Action 10: Join With KDM Token
          if (action === 'joinWithKdmToken') {
            const { token, propertyWaiverAgreed, codename } = body;
            if (!token?.trim()) return Response.json({ error: 'Token required' }, { status: 400 });
            if (!propertyWaiverAgreed) return Response.json({ error: 'Property accord required' }, { status: 400 });

            const cleanToken = token.trim().toUpperCase();
            const inviteToken = await db.covertInviteToken.findUnique({
              where: { token: cleanToken },
              include: { exchange: true },
            });

            if (!inviteToken) return Response.json({ error: 'Invalid token' }, { status: 404 });
            if (inviteToken.isUsed) return Response.json({ error: 'Token already redeemed' }, { status: 410 });
            if (new Date() > inviteToken.expiresAt) return Response.json({ error: 'Token expired' }, { status: 410 });

            const existingMember = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: inviteToken.exchangeId, userId } },
            });
            if (existingMember) return Response.json({ error: 'Already enrolled', exchangeCode: inviteToken.exchange.code }, { status: 409 });

            const [newMember] = await db.$transaction([
              db.exchangeMember.create({
                data: {
                  exchangeId: inviteToken.exchangeId,
                  userId,
                  codename: codename?.trim() || null,
                  propertyWaiverAgreedAt: new Date(),
                },
              }),
              db.covertInviteToken.update({
                where: { id: inviteToken.id },
                data: { isUsed: true, usedByUserId: userId },
              }),
            ]);

            return Response.json({
              success: true,
              message: 'Enrolled in Kovert Delivery Operation',
              exchangeCode: inviteToken.exchange.code,
              member: newMember,
            });
          }

          // Action 11: Submit Drop Proof
          if (action === 'submitDropProof' && operationId) {
            const { dropProofPhotoUrl, dropProofNote } = body;
            if (!dropProofPhotoUrl?.trim()) return Response.json({ error: 'Photo required' }, { status: 400 });

            const member = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId } },
            });
            if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });

            const updated = await db.exchangeMember.update({
              where: { id: member.id },
              data: {
                dropProofPhotoUrl: dropProofPhotoUrl.trim(),
                dropProofNote: dropProofNote ? sanitizeText(dropProofNote) : null,
                droppedAt: new Date(),
                shippingStatus: 'LOCAL_DELIVERY',
                deliveredConfirmed: true,
              },
            });
            return Response.json({ success: true, data: updated });
          }

          // Action 12: Submit 1-Guess Identity Challenge
          if (action === 'submitIdentityChallenge' && operationId) {
            const { guessedName } = body;
            if (!guessedName?.trim()) return Response.json({ error: 'Name required' }, { status: 400 });

            const targetMember = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId } },
            });
            if (!targetMember) return Response.json({ error: 'Member not found' }, { status: 404 });
            if (targetMember.targetGuessAttempted) return Response.json({ error: '1-time guess already consumed' }, { status: 409 });

            const giverMember = await db.exchangeMember.findFirst({
              where: { exchangeId: operationId, targetUserId: userId },
              include: { user: { select: { id: true, name: true, codename: true } } },
            });
            if (!giverMember) return Response.json({ error: 'Secret Santa assignment not found' }, { status: 404 });

            const isCorrect = verifyGiverIdentityGuess(guessedName, giverMember.user.name);
            const outcome = evaluateCovertOutcome({ targetGuessAttempted: true, targetGuessCorrect: isCorrect });

            const updated = await db.exchangeMember.update({
              where: { id: targetMember.id },
              data: {
                targetGuessName: guessedName.trim(),
                targetGuessAttempted: true,
                targetGuessCorrect: isCorrect,
                detectionStatus: outcome.status,
                badgeAwarded: outcome.badgeAwarded,
              },
            });

            return Response.json({
              success: true,
              correct: isCorrect,
              canUploadEvidence: isCorrect,
              status: outcome.status,
              badgeAwarded: outcome.badgeAwarded,
              data: updated,
            });
          }

          // Action 13: Submit Busted Evidence
          if (action === 'submitBustedEvidence' && operationId) {
            const { bustedPhotoUrl, bustedReason } = body;
            if (!bustedPhotoUrl?.trim()) return Response.json({ error: 'Evidence required' }, { status: 400 });

            const targetMember = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId } },
            });
            if (!targetMember) return Response.json({ error: 'Member not found' }, { status: 404 });
            if (!targetMember.targetGuessCorrect) return Response.json({ error: 'Identity unconfirmed' }, { status: 403 });

            const updated = await db.exchangeMember.update({
              where: { id: targetMember.id },
              data: {
                bustedPhotoUrl: bustedPhotoUrl.trim(),
                bustedReason: bustedReason ? sanitizeText(bustedReason) : null,
                detectionStatus: 'BUSTED',
                badgeAwarded: BADGE_VIGILANT_ELF,
              },
            });
            return Response.json({ success: true, data: updated });
          }

          // Action 14: Confirm Ghost Drop
          if (action === 'confirmGhostDrop' && operationId) {
            const targetMember = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId } },
            });
            if (!targetMember) return Response.json({ error: 'Member not found' }, { status: 404 });

            const updated = await db.exchangeMember.update({
              where: { id: targetMember.id },
              data: {
                detectionStatus: 'UNDETECTED',
                badgeAwarded: BADGE_KOVERT_KLAUS,
                deliveredConfirmed: true,
              },
            });
            return Response.json({ success: true, data: updated });
          }

          // Create Exchange
          if (config) {
            const validation = validateOperationConfig(config);
            if (!validation.isValid) {
              return Response.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
            }

            // Invite codes are random; retry on the (rare) collision instead of failing the create.
            let inviteCode = generateInviteCode();
            for (let attempt = 0; attempt < 5; attempt++) {
              const taken = await db.exchange.findUnique({ where: { code: inviteCode }, select: { id: true } });
              if (!taken) break;
              inviteCode = generateInviteCode();
            }

            const organizerWishlistId = await resolveMemberWishlistId(db, userId, Boolean(config.isWhiteElephant));
            const newExchange = await db.exchange.create({
              data: {
                title: sanitizeText(String(config.title)).trim(),
                description: config.description ? sanitizeText(String(config.description)).trim() : undefined,
                code: inviteCode,
                organizerId: userId,
                maxParticipants: config.maxParticipants ? Number(config.maxParticipants) : null,
                giftingType: config.giftingType,
                isLocalOnly: Boolean(config.isLocalOnly),
                eventLocation: config.eventLocation ? sanitizeText(String(config.eventLocation)).trim() : undefined,
                isWhiteElephant: Boolean(config.isWhiteElephant),
                enforcePenalties: config.enforcePenalties !== undefined ? Boolean(config.enforcePenalties) : true,
                budgetMin: config.budgetMin,
                budgetMax: config.budgetMax,
                currency: config.currency || 'USD',
                inviteCutoffDate: new Date(config.inviteCutoffDate),
                assignmentDate: new Date(config.assignmentDate),
                shippingDate: new Date(config.shippingDate),
                executionDate: new Date(config.executionDate),
                paymentStatus: 'EXEMPT_SELF_HOSTED',
                members: { create: { userId, role: 'ORGANIZER', wishlistId: organizerWishlistId } },
              },
            });
            return Response.json({ success: true, data: newExchange });
          }

          return Response.json({ error: `Unsupported operation action: ${action ?? '(none)'}` }, { status: 400 });
        }

        if (request.method === 'PATCH') {
          const activeUserId = getUserIdFromRequest(request);
          if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

          const body = (await request.json().catch(() => ({}))) as any;
          const { operationId, action, dates, settings, agentId: memberId, targetUserId } = body;

          if (!operationId) return Response.json({ error: 'operationId required' }, { status: 400 });

          const ex = await db.exchange.findUnique({ where: { id: operationId } });
          if (!ex) return Response.json({ error: 'Exchange not found' }, { status: 404 });
          if (ex.organizerId !== activeUserId) return Response.json({ error: 'Only organizer can perform admin actions' }, { status: 403 });

          // Member-scoped actions must target a member of THIS exchange, never an arbitrary row.
          const findScopedMember = (id: string) =>
            db.exchangeMember.findFirst({ where: { id, exchangeId: operationId } });

          if (action === 'remove_agent' && memberId) {
            const memberToDelete = await findScopedMember(memberId);
            if (!memberToDelete) return Response.json({ error: 'Member not found in this operation' }, { status: 404 });
            if (memberToDelete.userId === ex.organizerId) return Response.json({ error: 'Cannot remove primary organizer' }, { status: 400 });
            await db.exchangeMember.delete({ where: { id: memberToDelete.id } });
            return Response.json({ success: true, message: 'Member removed' });
          }

          if (action === 'issue_demerit' && targetUserId) {
            if (!ex.enforcePenalties) {
              return Response.json({ error: 'Demerits are disabled for this operation' }, { status: 400 });
            }
            if (ex.status !== 'COMPLETED') {
              return Response.json({ error: 'Demerits can only be assigned when the mission is completed' }, { status: 400 });
            }
            const targetMember = await db.exchangeMember.findUnique({
              where: { exchangeId_userId: { exchangeId: operationId, userId: targetUserId } },
            });
            if (!targetMember) return Response.json({ error: 'Agent is not enrolled in this operation' }, { status: 404 });
            // Carrier Protection Waiver: verified delivery or a carrier tracking number grants immunity.
            if (targetMember.deliveredConfirmed || targetMember.trackingNumber) {
              return Response.json({ error: 'Demerit Waiver Active: this agent has verified delivery or carrier tracking.' }, { status: 400 });
            }

            // One citation per call; the client never needs more and an unbounded value would be abusable.
            const pts = 1;
            const updatedUser = await db.user.update({
              where: { id: targetUserId },
              data: { penaltyPoints: { increment: pts } },
            });
            return Response.json({ success: true, message: `Issued ${pts} point(s)`, totalDemerits: updatedUser.penaltyPoints });
          }

          if (action === 'nudge_agent' && memberId) {
            const scoped = await findScopedMember(memberId);
            if (!scoped) return Response.json({ error: 'Member not found in this operation' }, { status: 404 });
            const memberToNudge = await db.exchangeMember.findUnique({
              where: { id: scoped.id },
              include: { user: true, exchange: { include: { organizer: true } } },
            });
            if (!memberToNudge) return Response.json({ error: 'Member not found' }, { status: 404 });

            const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
            const result = await dispatchNudge(db, {
              baseUrl: url.origin || 'https://kovertklaus.com',
              sendEmail: (email) => sendNudgeEmail({ ...email, overrideConfig: emailConfig }),
            }, memberToNudge);
            return Response.json(result.body, { status: result.status });
          }

          if (action === 'update_settings' || settings) {
            if (!settings) return Response.json({ error: 'Settings payload required' }, { status: 400 });
            const memberCount = await db.exchangeMember.count({ where: { exchangeId: operationId } });
            const merged = {
              title: settings.title !== undefined ? sanitizeText(String(settings.title)).trim() : ex.title,
              description: settings.description !== undefined ? sanitizeText(String(settings.description)).trim() : ex.description,
              budgetMin: settings.budgetMin !== undefined && settings.budgetMin !== null ? Number(settings.budgetMin) : (ex.budgetMin == null ? null : Number(ex.budgetMin)),
              budgetMax: settings.budgetMax !== undefined ? Number(settings.budgetMax) : Number(ex.budgetMax),
              maxParticipants: settings.maxParticipants !== undefined ? (settings.maxParticipants ? Number(settings.maxParticipants) : null) : ex.maxParticipants,
              isLocalOnly: settings.isLocalOnly !== undefined ? Boolean(settings.isLocalOnly) : ex.isLocalOnly,
              eventLocation: settings.eventLocation !== undefined ? sanitizeText(String(settings.eventLocation)).trim() : ex.eventLocation,
              enforcePenalties: settings.enforcePenalties !== undefined ? Boolean(settings.enforcePenalties) : ex.enforcePenalties,
            };
            const validation = validateOperationSettings({ ...merged, isWhiteElephant: ex.isWhiteElephant, currentMemberCount: memberCount });
            if (!validation.isValid) {
              return Response.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
            }
            const updatedExchange = await db.exchange.update({ where: { id: operationId }, data: merged });
            return Response.json({ success: true, data: updatedExchange });
          }

          if (dates) {
            // Only the dates that change are checked against today (src/lib/validations/timeline.ts).
            const change = resolveTimelineUpdate(ex, dates, new Date());
            if (!change.ok) {
              return Response.json({ error: change.error, details: [change.error] }, { status: change.status });
            }
            if (Object.keys(change.data).length === 0) {
              return Response.json({ success: true, data: ex });
            }
            const updatedExchange = await db.exchange.update({ where: { id: operationId }, data: change.data });
            return Response.json({ success: true, data: updatedExchange });
          }

          return Response.json({ error: `Unsupported operation update action: ${action ?? '(none)'}` }, { status: 400 });
        }
        return methodNotAllowed(pathname, request.method);
      }

      // 14. /api/invitations (POST)
      // /api/invitations (GET / POST / PATCH): emailed invitations, shared with the Next route.
      if (pathname === '/api/invitations') {
        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        if (request.method === 'GET') {
          const operationId = url.searchParams.get('operationId');
          const result = operationId ? await listMissionInvitations(db, operationId, activeUserId) : await listMyInvitations(db, activeUserId);
          return Response.json(result.body, { status: result.status });
        }
        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as { invitationId?: unknown; operationId?: unknown; recipientEmail?: unknown; isLatePass?: unknown };
          const emailConfig = await resolveWorkerEmailConfig(env, adminDb);
          const inviteDeps = {
            baseUrl: url.origin || 'https://kovertklaus.com',
            sendEmail: (email: InvitationEmail) => sendInvitationEmail({ ...email, overrideConfig: emailConfig }),
          };
          // `{ invitationId }` resends an existing invitation; otherwise a new one is sent.
          const result = body.invitationId !== undefined
            ? await resendMissionInvitation(db, inviteDeps, { invitationId: body.invitationId, userId: activeUserId })
            : await sendMissionInvitation(db, inviteDeps, { exchangeId: body.operationId, inviterId: activeUserId, email: body.recipientEmail, isLatePass: body.isLatePass });
          return Response.json(result.body, { status: result.status });
        }
        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as { invitationId?: unknown; action?: unknown };
          const result = await updateInvitation(db, { invitationId: body.invitationId, userId: activeUserId, action: body.action });
          return Response.json(result.body, { status: result.status });
        }
        return methodNotAllowed(pathname, request.method);
      }

      // 15. /api/invitations/accept (POST)
      if (pathname === '/api/invitations/accept' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const activeUserId = getUserIdFromRequest(request);
        const { operationCode, wishlistId } = body;

        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });
        if (!operationCode || typeof operationCode !== 'string') return Response.json({ error: 'operationCode required' }, { status: 400 });

        const exchange = await db.exchange.findUnique({ where: { code: operationCode.trim().toUpperCase() }, include: { members: true } });
        if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });
        if (exchange.status !== 'RECRUITING') {
          return Response.json({ error: 'Recruitment for this mission has closed. Operatives cannot join active or completed operations.' }, { status: 400 });
        }

        const existing = exchange.members.find((m) => m.userId === activeUserId);
        if (existing) return Response.json({ error: 'You are already enrolled in this exchange.', exchangeCode: exchange.code }, { status: 409 });
        if (exchange.maxParticipants && exchange.members.length >= exchange.maxParticipants) {
          return Response.json({ error: 'This exchange has reached its maximum operative capacity.' }, { status: 400 });
        }

        // Attach a manifest the caller owns; otherwise link (or create) the right one for this mission.
        let memberWishlistId: string;
        if (wishlistId) {
          const owned = await db.wishlist.findFirst({ where: { id: wishlistId, userId: activeUserId }, select: { id: true } });
          if (!owned) return Response.json({ error: 'Wishlist Manifest not found' }, { status: 404 });
          memberWishlistId = owned.id;
        } else {
          memberWishlistId = await resolveMemberWishlistId(db, activeUserId, exchange.isWhiteElephant);
        }

        // Event-scoped codename, unique within this roster (parity with the Next.js route).
        const user = await db.user.findUnique({
          where: { id: activeUserId },
          select: { email: true, name: true, codename: true, preferredCodename: true, autoRandomizeCodename: true },
        });
        const rosterCodenames = exchange.members.map((m) => m.codename).filter(Boolean) as string[];
        const { customCodename, randomizeCodename } = body;
        const preferred = customCodename || user?.preferredCodename || user?.codename || user?.name || 'Agent';
        const resolution = resolveUniqueCodename(preferred, rosterCodenames, Boolean(randomizeCodename || user?.autoRandomizeCodename));

        const member = await db.exchangeMember.create({
          data: {
            exchangeId: exchange.id,
            userId: activeUserId,
            codename: resolution.codename,
            wishlistId: memberWishlistId,
            role: 'MEMBER',
          },
        });
        if (user?.email) await markInvitationAccepted(db, exchange.id, user.email, activeUserId);

        return Response.json({
          success: true,
          message: 'Member successfully enrolled in exchange!',
          data: { ...member, assignedCodename: resolution.codename, wasCollided: resolution.wasCollided, isRandomized: resolution.isRandomized },
        });
      }

      // /api/messages (GET / POST): Command, Intel and Debrief messaging, shared with the Next route.
      if (pathname === '/api/messages' && (request.method === 'GET' || request.method === 'POST')) {
        const userId = getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });
        if (request.method === 'GET') {
          const exchangeId = url.searchParams.get('exchangeId');
          if (!exchangeId) return Response.json({ error: 'exchangeId is required' }, { status: 400 });
          const result = await listIntelMessages(db, exchangeId, userId);
          return Response.json(result.body, { status: result.status });
        }
        const body = (await request.json().catch(() => ({}))) as { exchangeId?: unknown; channel?: unknown; to?: unknown; text?: unknown };
        if (typeof body.exchangeId !== 'string' || !body.exchangeId) {
          return Response.json({ error: 'exchangeId is required' }, { status: 400 });
        }
        const result = await sendIntelMessage(db, { exchangeId: body.exchangeId, userId, channel: body.channel, to: body.to, text: body.text });
        return Response.json(result.body, { status: result.status });
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
          include: {
            exchange: true,
          },
        });
        if (!member) return Response.json({ error: 'Member not enrolled in this exchange' }, { status: 404 });

        let shippingStatus: 'LOCAL_DELIVERY' | 'SHIPPED' = 'LOCAL_DELIVERY';
        let cleanTracking: string | null = null;
        let carrierInfo = null;

        if (!isLocalDelivery) {
          if (!trackingNumber) {
            return Response.json({ error: 'Tracking number is required for courier parcel shipments' }, { status: 400 });
          }

          const carrierResult = detectCarrier(trackingNumber);
          if (!carrierResult.isValid) {
            return Response.json({ error: 'Invalid carrier tracking number format (minimum 8 alphanumeric characters, USPS, UPS, FedEx, or DHL)' }, { status: 400 });
          }

          shippingStatus = 'SHIPPED';
          cleanTracking = carrierResult.normalizedTracking;
          carrierInfo = carrierResult;
        }

        const updatedMember = await db.exchangeMember.update({
          where: { id: member.id },
          data: { shippingStatus, trackingNumber: cleanTracking, shippedAt: new Date() },
        });

        if (member.targetUserId) {
          const exchangeTitle = member.exchange?.title || 'Operation';
          const notificationTitle = isLocalDelivery
            ? `🎁 Hand Delivery Dispatched: ${exchangeTitle}`
            : `📦 Parcel In Transit (${carrierInfo?.badgeLabel || 'Carrier'}): ${exchangeTitle}`;

          const notificationMsg = isLocalDelivery
            ? 'Your secret giver has confirmed personal hand delivery / local drop-off for your gift! Keep your eyes peeled.'
            : `Your secret giver has dispatched your parcel via ${carrierInfo?.carrierName || 'Courier'}! Tracking Number: ${cleanTracking}.`;

          await db.notification.create({
            data: {
              userId: member.targetUserId,
              exchangeId: operationId,
              title: notificationTitle,
              message: notificationMsg,
              isAcknowledged: false,
            },
          }).catch(() => {});
        }

        return Response.json({
          success: true,
          message: isLocalDelivery
            ? 'Local delivery confirmed. Target operative notified!'
            : `Shipment confirmed via ${carrierInfo?.badgeLabel || 'Carrier'}! Carrier Protection Waiver active.`,
          data: {
            ...updatedMember,
            carrierInfo,
          },
        });
      }

      // 17. /api/demerits/audit (POST)
      if (pathname === '/api/demerits/audit' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { operationId } = body;

        if (!operationId) return Response.json({ error: 'operationId required' }, { status: 400 });

        const activeUserId = getUserIdFromRequest(request);
        if (!activeUserId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        const exchange = await db.exchange.findUnique({
          where: { id: operationId },
          include: { members: { include: { user: true } } },
        });
        if (!exchange) return Response.json({ error: 'Exchange not found' }, { status: 404 });
        if (exchange.organizerId !== activeUserId) return Response.json({ error: 'Only organizer can run audit' }, { status: 403 });

        if (!exchange.enforcePenalties) {
          return Response.json({ error: 'Demerits are disabled for this operation.' }, { status: 400 });
        }

        if (exchange.status !== 'COMPLETED') {
          return Response.json({ error: 'Demerits can only be evaluated and assigned when the mission is completed.' }, { status: 400 });
        }

        const auditResults = await processExchangeAudit(db, exchange);
        return Response.json({ success: true, message: 'Execution Day audit completed.', data: { operationId: exchange.id, auditResults } });
      }

      // 17b. /api/operations/lifecycle (POST)
      if (pathname === '/api/operations/lifecycle' && request.method === 'POST') {
        const admin = await requireAdmin(request, adminDb);
        const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const cronHeader = request.headers.get('x-cron-secret');
        const expectedCronSecret = (env as any).CRON_SECRET || (typeof process !== 'undefined' ? process.env.CRON_SECRET : undefined);
        const isCronAuthorized = Boolean(expectedCronSecret && (authHeader === expectedCronSecret || cronHeader === expectedCronSecret));

        if (!admin && !isCronAuthorized) {
          return Response.json({ error: 'Unauthorized. Valid admin session or CRON_SECRET required.' }, { status: 401 });
        }

        const summary = await advanceMissionLifecycle(db);
        const now = new Date();
        await adminDb.systemConfig.upsert({
          where: { id: 'singleton' },
          update: {
            lastLifecycleRunAt: now,
            lastLifecycleTransitions: summary.transitionsCount,
          },
          create: {
            id: 'singleton',
            lifecycleCronEnabled: true,
            lifecycleCronIntervalMinutes: 60,
            lastLifecycleRunAt: now,
            lastLifecycleTransitions: summary.transitionsCount,
          },
        }).catch(() => {});

        return Response.json({
          success: true,
          message: `Lifecycle evaluated: ${summary.transitionsCount} transition(s) executed across ${summary.missionsCheckedCount} active mission(s).`,
          data: summary,
        });
      }

      // 18. /api/scraper (POST)
      if (pathname === '/api/scraper' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { url } = body;

        if (!url || typeof url !== 'string') return Response.json({ error: 'Valid product URL required' }, { status: 400 });

        const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
        const ssrfCheck = isSafePublicUrl(formattedUrl);
        if (!ssrfCheck.safe) {
          logScraperEvent(formattedUrl, 'BLOCKED_SSRF', { reason: ssrfCheck.error }, { dbClient: db, env }).catch(() => {});
          return Response.json({ error: ssrfCheck.error || 'URL forbidden' }, { status: 403 });
        }


        const normalizedUrl = normalizeProductUrl(formattedUrl);
        const parsedUrl = new URL(normalizedUrl);

        const existingCatalog = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const isFresh = existingCatalog && (Date.now() - new Date(existingCatalog.scrapedAt).getTime() < TWENTY_FOUR_HOURS_MS);

        if (existingCatalog && isFresh) {
          const category = (existingCatalog.properties as any)?.category || detectProductCategory(existingCatalog.title, existingCatalog.domain || parsedUrl.hostname, existingCatalog.description || '');
          const variables = (existingCatalog.properties as any)?.variables || getCategorySuggestedKeys(category);
          const properties = existingCatalog.properties || { category, variables, popularOptions: {} };

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
              properties,
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

          const category = detectProductCategory(title, parsedUrl.hostname, cleanDesc);
          const suggestedVariables = getCategorySuggestedKeys(category);
          const initialProps = (existingCatalog?.properties as any) || {
            category,
            variables: suggestedVariables,
            popularOptions: {},
          };

          const catalogRecord = await db.productCatalog.upsert({
            where: { url: normalizedUrl },
            create: {
              url: normalizedUrl,
              title,
              price: parsedPrice,
              description: cleanDesc,
              thumbnailUrl: image,
              domain: parsedUrl.hostname,
              properties: initialProps as unknown as Prisma.InputJsonValue,
            },
            update: {
              title,
              price: parsedPrice,
              description: cleanDesc,
              thumbnailUrl: image,
              domain: parsedUrl.hostname,
              scrapedAt: new Date(),
            },
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
              properties: catalogRecord.properties || initialProps,
            },
          });
        } catch {
          clearTimeout(timeoutId);
          if (existingCatalog) {
            const category = (existingCatalog.properties as any)?.category || detectProductCategory(existingCatalog.title, existingCatalog.domain || parsedUrl.hostname, existingCatalog.description || '');
            const variables = (existingCatalog.properties as any)?.variables || getCategorySuggestedKeys(category);
            const properties = existingCatalog.properties || { category, variables, popularOptions: {} };

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
                properties,
              },
            });
          }
          const fallbackCategory = detectProductCategory(parsedUrl.hostname, parsedUrl.hostname);
          return Response.json({
            success: false,
            fallback: true,
            metadata: {
              title: parsedUrl.hostname,
              url: parsedUrl.toString(),
              domain: parsedUrl.hostname,
              properties: {
                category: fallbackCategory,
                variables: getCategorySuggestedKeys(fallbackCategory),
                popularOptions: {},
              },
            },
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
          const formatted = wishlists.map((w, idx) => {
            const items = w.wishlistItems.map((wi) => ({
              id: wi.item.id,
              title: wi.item.name,
              price: wi.item.price ? Number(wi.item.price) : undefined,
              url: wi.item.url,
              thumbnail: wi.item.thumbnailUrl || undefined,
              description: wi.item.description || undefined,
              properties: wi.item.properties || undefined,
            }));
            return {
              id: w.id,
              name: w.name,
              isMaster: idx === 0,
              type: w.type,
              createdAt: w.createdAt,
              manifestItems: items,
              opTools: items,
            };
          });
          return Response.json({ success: true, manifests: formatted, opKits: formatted });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { action, name, type, wishlistId, title, url: itemUrl, price, description, thumbnail, properties } = body;

          if (action === 'add_manifest_item' || action === 'add_item' || action === 'add_optool' || (wishlistId && (itemUrl !== undefined || properties?.isPersonalized))) {
            if (!wishlistId) {
              return Response.json({ error: 'wishlistId is required to add a Manifest Item' }, { status: 400 });
            }

            const validation = validateAndSanitizeManifestItem({
              title,
              url: itemUrl,
              price,
              description,
              thumbnail,
              properties,
            });

            if (!validation.valid) {
              return Response.json({ error: validation.error }, { status: 400 });
            }

            const { data: itemData } = validation;

            const wishlist = await db.wishlist.findUnique({
              where: { id: wishlistId },
              include: { _count: { select: { wishlistItems: true } } },
            });
            if (!wishlist || wishlist.userId !== activeUserId) {
              return Response.json({ error: 'Wishlist Manifest not found or unauthorized' }, { status: 404 });
            }
            if (wishlist.type === 'WHITE_ELEPHANT' && wishlist._count.wishlistItems >= 1) {
              return Response.json({
                error: '🐘 White Elephant Wishlist Manifests are strictly limited to 1 brought gift item per operative!',
              }, { status: 400 });
            }

            const item = await db.item.create({
              data: {
                userId: activeUserId,
                name: itemData.name,
                url: itemData.url,
                price: itemData.price,
                description: itemData.description,
                thumbnailUrl: itemData.thumbnailUrl,
                properties: itemData.properties ? (itemData.properties as unknown as Prisma.InputJsonValue) : undefined,
              },
            });
            await db.wishlistItem.create({ data: { wishlistId, itemId: item.id } });

            if (itemData.url && itemData.properties?.details && itemData.properties.details.length > 0) {
              try {
                const normalizedUrl = normalizeProductUrl(itemData.url);
                const cat = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
                if (cat) {
                  const updatedCatalogProps = updateCatalogIntelligence(cat.properties, itemData.properties.details);
                  await db.productCatalog.update({
                    where: { url: normalizedUrl },
                    data: { properties: updatedCatalogProps as unknown as Prisma.InputJsonValue },
                  });
                }
              } catch (e) {
                console.warn('[Worker ProductCatalog Intelligence Update Error]', e);
              }
            }

            const itemObj = {
              id: item.id,
              title: item.name,
              price: Number(item.price),
              url: item.url,
              thumbnail: item.thumbnailUrl || undefined,
              description: item.description || undefined,
              properties: item.properties || undefined,
            };
            return Response.json({ success: true, manifestItem: itemObj, opTool: itemObj });
          }

          if (name) {
            const newW = await db.wishlist.create({
              data: { userId: activeUserId, name: sanitizeText(name), type: type === 'WHITE_ELEPHANT' ? 'WHITE_ELEPHANT' : 'STANDARD' },
            });
            const createdObj = { id: newW.id, name: newW.name, type: newW.type, manifestItems: [], opTools: [] };
            return Response.json({ success: true, manifest: createdObj, opKit: createdObj });
          }
          return Response.json({ error: 'Provide a manifest name or a Manifest Item to add' }, { status: 400 });
        }

        if (request.method === 'PATCH') {
          const body = (await request.json().catch(() => ({}))) as any;
          const { wishlistId, itemId, name, title, price, description, thumbnail, properties } = body;

          if (itemId) {
            const existingItem = await db.item.findFirst({
              where: { id: itemId, userId: activeUserId },
            });

            if (!existingItem) {
              return Response.json({ error: 'Item not found or unauthorized' }, { status: 404 });
            }

            const existingProps = (existingItem.properties && typeof existingItem.properties === 'object')
              ? (existingItem.properties as Record<string, any>)
              : {};

            const isPersonalized = properties?.isPersonalized !== undefined
              ? Boolean(properties.isPersonalized)
              : Boolean(existingProps.isPersonalized || !existingItem.url);

            const details = Array.isArray(properties?.details)
              ? sanitizeItemDetails(properties.details)
              : undefined;

            const updateData: any = {};
            if (title !== undefined) updateData.name = sanitizeText(title).trim().substring(0, 100);
            if (price !== undefined) {
              const numPrice = Number(price);
              updateData.price = !isNaN(numPrice) ? Math.max(0, Math.min(Math.round(numPrice * 100) / 100, 100000)) : 0;
            }
            if (description !== undefined) {
              updateData.description = description ? sanitizeText(description).trim().substring(0, 500) : null;
            }
            if (thumbnail !== undefined) updateData.thumbnailUrl = thumbnail ? thumbnail.trim() : null;

            if (properties !== undefined || details !== undefined) {
              const mergedProps: Record<string, any> = { ...existingProps };
              if (isPersonalized) {
                mergedProps.isPersonalized = true;
              } else {
                delete mergedProps.isPersonalized;
              }

              if (details !== undefined) {
                if (details.length > 0) {
                  mergedProps.details = details;
                } else {
                  delete mergedProps.details;
                }
              }

              updateData.properties = Object.keys(mergedProps).length > 0
                ? (mergedProps as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull;
            }

            const updated = await db.item.update({
              where: { id: itemId },
              data: updateData,
            });

            if (details && details.length > 0 && existingItem.url) {
              try {
                const normalizedUrl = normalizeProductUrl(existingItem.url);
                const cat = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
                if (cat) {
                  const updatedCatalogProps = updateCatalogIntelligence(cat.properties, details);
                  await db.productCatalog.update({
                    where: { url: normalizedUrl },
                    data: { properties: updatedCatalogProps as unknown as Prisma.InputJsonValue },
                  });
                }
              } catch (e) {
                console.warn('[Worker ProductCatalog Intelligence Update Error]', e);
              }
            }

            return Response.json({
              success: true,
              message: 'Manifest Item updated successfully',
              manifestItem: {
                id: updated.id,
                title: updated.name,
                price: Number(updated.price),
                url: updated.url,
                thumbnail: updated.thumbnailUrl || undefined,
                description: updated.description || undefined,
                properties: updated.properties || undefined,
              },
            });
          }

          if (wishlistId && name) {
            await db.wishlist.updateMany({
              where: { id: wishlistId, userId: activeUserId },
              data: { name: sanitizeText(name) },
            });
            return Response.json({ success: true, message: 'Wishlist renamed' });
          }

          return Response.json({ error: 'wishlistId or itemId required' }, { status: 400 });
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
          return Response.json({ error: 'itemId or wishlistId required' }, { status: 400 });
        }
        return methodNotAllowed(pathname, request.method);
      }

    } catch (err: any) {
      console.error('[Worker API Error]', err);
      await logSystemEvent({
        level: 'ERROR',
        category: 'WORKER',
        message: `Unhandled Worker Exception on ${pathname}: ${err?.message || err}`,
        metadata: {
          stack: err?.stack,
          url: request.url,
          pathname,
          method: request.method,
        },
        path: pathname,
        method: request.method,
        statusCode: 500,
        env,
      }).catch(() => {});


      await invalidateCachedDb().catch(() => {});
      await invalidateCachedAdminDb().catch(() => {});
      // Details are logged above; never echo internal error text (DB/Prisma messages) to clients.
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }


    // Never serve static HTML for unmatched API routes. A known path reached here was called with a
    // method its handler does not support: answer 405, not a misleading "route not found".
    if (pathname.startsWith('/api/')) {
      if (WORKER_API_PATHS.has(pathname)) {
        console.warn(`[Worker API] ${request.method} not allowed on ${pathname}`);
        return methodNotAllowed(pathname, request.method);
      }
      console.warn(`[Worker API] Unknown API route ${request.method} ${pathname}`);
      return new Response(JSON.stringify({ error: `API route not found: ${pathname}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mission pages: the static export has one shell (/exchange/preview); serve it for every code.
    const shellPath = request.method === 'GET' || request.method === 'HEAD' ? rewriteExchangeShellPath(pathname) : null;
    if (shellPath) {
      const shellUrl = new URL(request.url);
      shellUrl.pathname = shellPath;
      return env.ASSETS.fetch(new Request(shellUrl.toString(), request));
    }

    // Fallback: Serve static assets from Cloudflare edge CDN
    return env.ASSETS.fetch(request);
}

/** Minimal Cloudflare ExecutionContext surface used here. */
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  /**
   * Every request gets its own Prisma/Neon clients (runWithDbScope): Workers bind sockets to the
   * request that opened them, so module-cached pools reused across concurrent requests crashed the
   * worker (Cloudflare error 1101). Clients are closed after the response via waitUntil.
   */
  async fetch(request: Request, env: Env, ctx?: WorkerContext): Promise<Response> {
    return runWithDbScope(() => handleFetch(request, env), ctx ? (p) => ctx.waitUntil(p) : undefined);
  },

  /**
   * Cloudflare Worker Scheduled Cron Trigger Handler
   * Fires daily at 06:00 UTC (configured via wrangler.json triggers.crons)
   * Automatically advances active missions forward based on milestone dates:
   * - inviteCutoffDate -> SETUP
   * - assignmentDate   -> MATCHED (Executes target draw & emails assignments)
   * - shippingDate     -> SHIPPED
   * - executionDate    -> EXECUTED
   */
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    // Own database scope for the cron run (clients closed when it finishes).
    const lifecyclePromise = runWithDbScope(async () => {
      try {
        if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
        if (env.DATABASE_ADMIN_URL) process.env.DATABASE_ADMIN_URL = env.DATABASE_ADMIN_URL;
        if (env.DIRECT_URL) process.env.DIRECT_URL = env.DIRECT_URL;

        const adminConnStr =
          env.DATABASE_ADMIN_URL ||
          env.DIRECT_URL ||
          env.DATABASE_URL ||
          process.env.DATABASE_ADMIN_URL ||
          process.env.DIRECT_URL ||
          process.env.DATABASE_URL;
        const appConnStr =
          env.DATABASE_URL ||
          env.DATABASE_ADMIN_URL ||
          env.DIRECT_URL ||
          process.env.DATABASE_URL ||
          process.env.DATABASE_ADMIN_URL;

        const adminDb = getAdminDb(adminConnStr);
        const config = await adminDb.systemConfig.findUnique({
          where: { id: 'singleton' },
          select: {
            lifecycleCronEnabled: true,
            lifecycleCronIntervalMinutes: true,
            lastLifecycleRunAt: true,
          },
        });

        if (config && config.lifecycleCronEnabled === false) {
          console.log('[CRON] Mission lifecycle scheduler disabled in SystemConfig. Skipping sweep.');
          return;
        }

        const intervalMinutes = Math.max(1, config?.lifecycleCronIntervalMinutes ?? 60);
        const lastRunAt = config?.lastLifecycleRunAt ? new Date(config.lastLifecycleRunAt) : null;

        if (lastRunAt) {
          const elapsedMs = Date.now() - lastRunAt.getTime();
          if (elapsedMs < intervalMinutes * 60 * 1000) {
            console.log(`[CRON] Mission lifecycle sweep not due yet (${Math.round(elapsedMs / 60000)}m / ${intervalMinutes}m elapsed). Skipping.`);
            return;
          }
        }

        const db = getDb(appConnStr);
        const summary = await advanceMissionLifecycle(db);
        const now = new Date();

        await adminDb.systemConfig.upsert({
          where: { id: 'singleton' },
          update: {
            lastLifecycleRunAt: now,
            lastLifecycleTransitions: summary.transitionsCount,
          },
          create: {
            id: 'singleton',
            lifecycleCronEnabled: true,
            lifecycleCronIntervalMinutes: 60,
            lastLifecycleRunAt: now,
            lastLifecycleTransitions: summary.transitionsCount,
          },
        }).catch(() => {});

        console.log(`[CRON] Mission lifecycle milestone check at ${summary.processedAt}: ${summary.transitionsCount} transition(s) executed across ${summary.missionsCheckedCount} active mission(s).`);
        await logInfo('WORKER', `Cron: Mission lifecycle advanced ${summary.transitionsCount} mission(s).`, {
          metadata: { summary, cron: event?.cron, scheduledTime: event?.scheduledTime },
          env,
        }).catch(() => {});
      } catch (err: any) {
        console.error('[CRON] Mission lifecycle milestone check failed:', err);
        await logError('WORKER', `Cron: Mission lifecycle failed: ${err?.message || err}`, {
          metadata: { cron: event?.cron, scheduledTime: event?.scheduledTime, error: err?.message || String(err) },
          env,
        }).catch(() => {});
      }
    });

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(lifecyclePromise);
    } else {
      await lifecyclePromise;
    }
  },
};
