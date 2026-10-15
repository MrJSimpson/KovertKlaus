import { NextResponse } from 'next/server';
import { adminExists, bootstrapInitialAdmin, createFirstAdmin, setAdminSessionCookie } from '@/lib/adminAuth';
import { announceSetupToken, revokeSetupToken, verifySetupToken } from '@/lib/adminSetup';
import { issueSessionToken } from '@/lib/session-token';

/**
 * @file route.ts (/api/northpole/setup)
 * @description First-run administrator setup endpoint for self-hosted installations.
 *
 * Tier 1 (what): GET reports whether setup is required. POST creates the first administrator
 * when given the one-time token printed to the server console.
 * Tier 2 (why): Replaces the published default password. Only someone who can read the server
 * console can create the first admin, and only while no admin exists.
 * Tier 3 (how): GET first applies `INITIAL_ADMIN_*` configuration if present (SaaS), then
 * issues and prints a token when setup is still required. POST verifies the token in
 * constant time, creates the admin inside a transaction that re-checks emptiness, revokes the
 * token and opens an admin session.
 */

export const dynamic = 'force-dynamic';

/**
 * Reports first-run setup state and issues a console token when needed.
 */
export async function GET() {
  try {
    const state = await bootstrapInitialAdmin();
    if (state === 'setup-required') announceSetupToken();
    return NextResponse.json({ setupRequired: state === 'setup-required' });
  } catch (error) {
    console.error('[NorthPole Setup] Status check failed:', error);
    return NextResponse.json({ error: 'Setup status unavailable' }, { status: 500 });
  }
}

/**
 * Completes first-run setup with the console token and the operator's chosen credentials.
 */
export async function POST(request: Request) {
  try {
    if (await adminExists()) {
      revokeSetupToken();
      return NextResponse.json({ error: 'An administrator already exists. First-run setup is closed.' }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      setupToken?: string;
      username?: string;
      email?: string;
      name?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!verifySetupToken(body.setupToken)) {
      return NextResponse.json(
        { error: 'Invalid or expired setup token. Copy the token from the server console (restarting the server issues a new one).' },
        { status: 401 }
      );
    }

    if (!body.password || body.password !== body.confirmPassword) {
      return NextResponse.json({ error: 'Passphrase and confirmation do not match.' }, { status: 400 });
    }

    const result = await createFirstAdmin({
      username: body.username ?? '',
      email: body.email ?? '',
      name: body.name ?? '',
      password: body.password,
    });
    if (result.error || !result.admin) {
      return NextResponse.json({ error: result.error }, { status: result.error?.includes('already exists') ? 409 : 400 });
    }

    revokeSetupToken();
    await setAdminSessionCookie(result.admin.id);
    console.log(`[NorthPole Setup] First administrator created: username='${result.admin.username}'. Setup is now closed.`);

    return NextResponse.json({
      success: true,
      message: 'North Pole Command initialized. Administrator clearance activated.',
      token: issueSessionToken('admin', result.admin.id),
      admin: result.admin,
    });
  } catch (error) {
    console.error('[NorthPole Setup] Setup failed:', error);
    return NextResponse.json({ error: 'First-run setup failed' }, { status: 500 });
  }
}
