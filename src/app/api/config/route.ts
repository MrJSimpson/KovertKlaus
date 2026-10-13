import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { IS_SAAS } from '@/lib/config/mode';
import { toPublicConfig, type PublicSystemConfigResponse } from '@/lib/config/publicConfig';

/**
 * @file route.ts (/api/config)
 * @description Public site configuration (theme, season, banner, alt home, limits).
 *
 * Tier 1 (what): Returns the allowlisted public view of `SystemConfig` and its active theme.
 * Tier 2 (why): Built by `toPublicConfig`, the same builder the edge worker uses, so self-hosted
 * and SaaS responses match and no secret column can leak.
 * Tier 3 (how): Reads through `adminDb` because `SystemConfig` lives in the `admin` schema; falls
 * back to defaults if the database is empty or unreachable.
 */

export type { PublicSystemConfigResponse };

export const dynamic = 'force-dynamic';

const EDITION = IS_SAAS ? 'saas' : 'selfhosted';

export async function GET() {
  try {
    const config = await adminDb.systemConfig.findUnique({
      where: { id: 'singleton' },
      include: { activeTheme: true },
    });
    return NextResponse.json(toPublicConfig(config, config?.activeTheme, EDITION));
  } catch {
    // Database unavailable or initializing: serve defaults rather than failing the page.
    return NextResponse.json(toPublicConfig(null, null, EDITION));
  }
}
