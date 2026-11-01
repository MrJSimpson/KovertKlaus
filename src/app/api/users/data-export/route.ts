/**
 * @file route.ts
 * @description `GET /api/users/data-export?token=…`: download the copy of a deleted account's data.
 *
 * Tier 1 (what): Answers with the JSON file as a download, 410 for an expired, invalid or already
 * deleted copy, or 429 after too many attempts from one IP.
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `downloadAccountExport`. The
 * link is emailed when an agent deletes their account (owner request, 2026-11-01).
 * Tier 3 (how): No session (the account no longer exists): the signed token is the proof. Reads the
 * sealed copy from local disk (`EXPORT_DIR`) and decrypts it.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/adminDb';
import { downloadAccountExport } from '@/lib/account-export';
import { diskExportStore } from '@/lib/export-store-disk';
import { clientIp } from '@/lib/login-throttle';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    const result = await downloadAccountExport({ adminDb, store: diskExportStore() }, { token, ip: clientIp(request.headers) });
    if (result.status === 200) return new NextResponse(result.body as string, { status: 200, headers: result.headers });
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in GET /api/users/data-export:', err);
    return NextResponse.json({ error: 'Could not prepare the download. Please try again.' }, { status: 500 });
  }
}
