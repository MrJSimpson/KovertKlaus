'use client';

/**
 * @file JoinCodeDialog.tsx
 * @description "Join with a code": asks for a mission code and opens that mission's page.
 *
 * Tier 1 (what): `JoinCodeButton` renders a button (styled by the caller) that opens a small dialog
 * with one code field; a complete code navigates to `/exchange/XXXX-XXXX`.
 * Tier 2 (why): The mission page already shows outsiders the preview and handles sign-in, sign-up
 * and the Head Elf join request (`src/lib/join-requests.ts`), so the entry pages only need to get
 * the visitor there. Replaces the landing's join modal, which duplicated that sign-up logic.
 * Tier 3 (how): Native `<dialog>` (focus trap, Escape to close, backdrop). Code formatting is
 * `formatMissionCode` from `src/lib/auth-flow.ts`. On phones the dialog sits at the bottom edge as a sheet.
 */

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { formatMissionCode, missionCodePath } from '@/lib/auth-flow';
import { Icon } from './Icon';

export function JoinCodeButton({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function open() {
    setCode('');
    setError('');
    dialog.current?.showModal();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const path = missionCodePath(code);
    if (!path) {
      setError('Mission codes have 8 letters and numbers, like AB12-CD34.');
      return;
    }
    dialog.current?.close();
    router.push(path);
  }

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="join-code-h"
        className="kk-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <form onSubmit={submit} className="kk-card flex flex-col gap-4" noValidate>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="join-code-h" className="font-display text-[22px] leading-7 font-semibold text-kk-heading m-0">
                Join with a code
              </h2>
              <p className="m-0 mt-1 text-kk-muted">Your Head Elf shared it with the invite. It opens the mission file.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="kk-btn kk-btn--ghost kk-btn--sm !px-0 w-11 shrink-0">
              <Icon name="close" />
            </button>
          </div>
          <div className={`kk-field${error ? ' is-error' : ''}`}>
            <label className="kk-field__label" htmlFor="join-code">
              Mission code
            </label>
            <input
              id="join-code"
              className="kk-field__input font-mono tracking-[0.12em] uppercase"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AB12-CD34"
              value={code}
              onChange={(e) => {
                setCode(formatMissionCode(e.target.value));
                setError('');
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'join-code-err' : undefined}
            />
            {error && (
              <p id="join-code-err" className="kk-field__help m-0">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="kk-btn kk-btn--primary kk-btn--block">
            <Icon name="folder" />
            Open the mission
          </button>
        </form>
      </dialog>
    </>
  );
}
