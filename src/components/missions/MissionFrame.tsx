'use client';

/**
 * @file MissionFrame.tsx
 * @description The mission page's frame: the signed-in shell for agents, the public one for visitors.
 *
 * Tier 1 (what): Signed in: `AppShell` with an open-folder tab for this mission's code after
 * Missions (owner review 2026-11-19), plus Alerts, Profile, Sign out.
 * Signed out (the mission preview anyone with the code can open): `PublicShell`.
 * Tier 2 (why): Visual refresh (2.0.0-beta). The mission page replaces its own "Command Center"
 * header with the shared ones, so it reads as part of the app and keeps the phone tab bar.
 * Tier 3 (how): Profile lives on the dashboard until it has its own page, so the Profile tab opens
 * `/dashboard?profile=1` (the dashboard opens Account Preferences for that parameter).
 */

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/brand/AppShell';
import { PublicShell } from '@/components/brand/PublicShell';

export function MissionFrame({ signedIn, onSignOut, children, code, title }: { signedIn: boolean; onSignOut: () => void; children: ReactNode; code?: string; title?: string }) {
  const router = useRouter();
  if (!signedIn) return <PublicShell bare>{children}</PublicShell>;
  return (
    <AppShell
      active="missions"
      openFile={code ? { label: code, title } : undefined}
      onProfile={() => router.push('/dashboard?profile=1')}
      onSignOut={onSignOut}
    >
      {children}
    </AppShell>
  );
}
