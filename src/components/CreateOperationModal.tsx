'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { calculateAutomaticOperationDates } from '@/lib/validations/operation';

interface CreateOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSuccess?: (operationCode: string) => void;
}

export function CreateOperationModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: CreateOperationModalProps) {
  const router = useRouter();
  const { isDarkMode, theme } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isWhiteElephant, setIsWhiteElephant] = useState(false);
  const [isLocalOnly, setIsLocalOnly] = useState(false);
  const [eventLocation, setEventLocation] = useState('');
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(50);
  const [maxParticipants, setMaxParticipants] = useState<number>(5);

  // Default execution date to 12/25/<current year>
  const currentYear = new Date().getFullYear();
  const defaultExecDate = `${currentYear}-12-25`;
  const [executionDate, setExecutionDate] = useState(defaultExecDate);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const activeUserId = userId || localStorage.getItem('kovertklaus_user_id');
      if (!activeUserId) {
        throw new Error('Authentication required. Please sign in to create an operation.');
      }

      if (!title.trim()) {
        throw new Error('Operation title is required.');
      }

      if (maxParticipants < 2 || maxParticipants > 25) {
        throw new Error('Max Operative capacity must be between 2 and 25 agents.');
      }

      if (isLocalOnly && !eventLocation.trim()) {
        throw new Error('In-person local events require an event location address.');
      }

      if (isWhiteElephant && !isLocalOnly) {
        throw new Error('White Elephant gifting is restricted to in-person local events only.');
      }

      // Calculate automatic 25%, 50%, 75%, 100% timeline cutoffs
      const calculatedDates = calculateAutomaticOperationDates(executionDate);

      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          config: {
            title: title.trim(),
            description: description.trim() || undefined,
            budgetMin: Number(budgetMin),
            budgetMax: Number(budgetMax),
            currency: 'USD',
            giftingType: 'SINGLE',
            isLocalOnly,
            eventLocation: isLocalOnly ? eventLocation.trim() : undefined,
            isWhiteElephant,
            maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
            inviteCutoffDate: calculatedDates.inviteCutoffDate,
            assignmentDate: calculatedDates.assignmentDate,
            shippingDate: calculatedDates.shippingDate,
            executionDate: calculatedDates.executionDate,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const detailMsg = json.details?.join(' ') || json.error;
        throw new Error(detailMsg || 'Failed to create operation');
      }

      const createdCode = json.data.code;
      onClose();

      if (onSuccess) {
        onSuccess(createdCode);
      } else {
        router.push(`/exchange/${createdCode}`);
      }
    } catch (err: any) {
      setError(err.message || 'Operation creation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full transition-all shadow-2xl my-8 ${theme.modalBg}`}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200 dark:border-slate-800">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              ⭐ OpsLeader Console
            </span>
            <h3 className="text-2xl font-black mt-1">Organize New Operation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          
          {/* Operation Title */}
          <div>
            <label className="block text-slate-500 mb-1">Operation Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Klaus Covert Ops Exchange 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-500 mb-1">Mission Brief / Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Annual holiday gift exchange rules, funny guidelines, or party info..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
            />
          </div>

          {/* Gifting Mode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setIsWhiteElephant(false);
              }}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                !isWhiteElephant
                  ? isDarkMode
                    ? 'border-sky-500 bg-sky-950/40 text-sky-200'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-950 font-extrabold'
                  : theme.cardInnerBg
              }`}
            >
              <div className="text-xl mb-1">🎁</div>
              <div className="font-extrabold text-xs">Secret Santa</div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                Target assignment wishlist gifting
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsWhiteElephant(true);
                setIsLocalOnly(true); // White Elephant is strictly local per AGENTS.md rules
              }}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                isWhiteElephant
                  ? isDarkMode
                    ? 'border-amber-500 bg-amber-950/40 text-amber-200'
                    : 'border-amber-600 bg-amber-50 text-amber-950 font-extrabold'
                  : theme.cardInnerBg
              }`}
            >
              <div className="text-xl mb-1">🐘</div>
              <div className="font-extrabold text-xs">White Elephant</div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                Live gift stealing pool (Local only, 1 gift/agent)
              </div>
            </button>
          </div>

          {/* Event Delivery Type */}
          <div>
            <label className="block text-slate-500 mb-1">Event Delivery Mode</label>
            <div className="flex gap-4 items-center pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deliveryMode"
                  checked={!isLocalOnly}
                  onChange={() => {
                    if (isWhiteElephant) return; // Blocked for White Elephant
                    setIsLocalOnly(false);
                  }}
                  disabled={isWhiteElephant}
                  className="accent-emerald-600"
                />
                <span>📦 Remote Shipping (Courier Delivery)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deliveryMode"
                  checked={isLocalOnly}
                  onChange={() => setIsLocalOnly(true)}
                  className="accent-emerald-600"
                />
                <span>📍 Local In-Person Event</span>
              </label>
            </div>
          </div>

          {/* Location Address (if local) */}
          {isLocalOnly && (
            <div>
              <label className="block text-slate-500 mb-1">In-Person Event Location Address *</label>
              <input
                type="text"
                required={isLocalOnly}
                placeholder="e.g. 123 North Pole Way, Seattle, WA"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              />
            </div>
          )}

          {/* Budget Range & Execution Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-500 mb-1">Min Budget ($)</label>
              <input
                type="number"
                min={0}
                value={budgetMin}
                onChange={(e) => setBudgetMin(Number(e.target.value))}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Max Budget ($) *</label>
              <input
                type="number"
                required
                min={1}
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Execution Day *</label>
              <input
                type="date"
                required
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className={`w-full border rounded-xl px-2 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              />
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-slate-500 mb-1">Max Operatives * (Required - Max 25)</label>
            <input
              type="number"
              required
              min={2}
              max={25}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-stone-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-1/2 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Creating...</span>
                </>
              ) : (
                <span>🚀 Launch Operation</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
