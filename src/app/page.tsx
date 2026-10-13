import React from 'react';
import HomeVariant from '@/components/landing/HomeVariant';
import { adminDb } from '@/lib/adminDb';
import { IS_SAAS } from '@/lib/config/mode';
import { resolveHomeVariant } from '@/lib/config/homeVariant';

export const dynamic = 'force-dynamic';

/**
 * Start Page Controller
 *
 * 1. `ALT_HOME` / `NEXT_PUBLIC_ALT_HOME`, if set, fixes the variant (no live override).
 * 2. Otherwise the server reads the North Pole `altHome` setting (`SystemConfig`, admin schema)
 *    for the initial render; `HomeVariant` then follows the live value from `/api/config`.
 *    That second step matters for the SaaS static export, where this function runs at build time.
 * 3. Empty or unknown values use the edition default: SaaS `coming_soon`, self-hosted `app_home`.
 */
export default async function Page() {
  const envAltHome = (process.env.ALT_HOME || process.env.NEXT_PUBLIC_ALT_HOME || '').trim();
  if (envAltHome) {
    return <HomeVariant initialKey={resolveHomeVariant(envAltHome, IS_SAAS)} locked />;
  }

  let altHome = '';
  try {
    const config = await adminDb.systemConfig.findFirst({ select: { altHome: true } });
    altHome = config?.altHome || '';
  } catch {
    // Database unavailable (or no database at static-export build): use the edition default.
  }

  return <HomeVariant initialKey={resolveHomeVariant(altHome, IS_SAAS)} />;
}
