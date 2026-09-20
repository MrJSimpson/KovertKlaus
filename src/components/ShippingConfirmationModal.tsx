'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { detectCarrier, CarrierDetectionResult } from '@/lib/carrier-tracking';

export interface ShippingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  targetCodename?: string;
  currentShippingStatus?: string;
  currentTrackingNumber?: string;
  onConfirmed?: (result: any) => void;
}

export function ShippingConfirmationModal({
  isOpen,
  onClose,
  operationId,
  targetCodename,
  currentShippingStatus,
  currentTrackingNumber,
  onConfirmed,
}: ShippingConfirmationModalProps) {
  const { theme, isDarkMode } = useTheme();

  const [deliveryType, setDeliveryType] = useState<'COURIER' | 'LOCAL'>('COURIER');
  const [trackingInput, setTrackingInput] = useState('');
  const [carrierResult, setCarrierResult] = useState<CarrierDetectionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessMessage('');
      if (currentShippingStatus === 'LOCAL_DELIVERY') {
        setDeliveryType('LOCAL');
        setTrackingInput('');
        setCarrierResult(null);
      } else {
        setDeliveryType('COURIER');
        const initialTracking = currentTrackingNumber || '';
        setTrackingInput(initialTracking);
        setCarrierResult(initialTracking ? detectCarrier(initialTracking) : null);
      }
    }
  }, [isOpen, currentShippingStatus, currentTrackingNumber]);

  function handleTrackingChange(val: string) {
    setTrackingInput(val);
    setErrorMessage('');
    if (val.trim()) {
      setCarrierResult(detectCarrier(val));
    } else {
      setCarrierResult(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const isLocal = deliveryType === 'LOCAL';

    if (!isLocal) {
      if (!trackingInput.trim()) {
        setErrorMessage('Tracking number is required for courier parcel shipping.');
        return;
      }
      const detection = detectCarrier(trackingInput);
      if (!detection.isValid) {
        setErrorMessage('Invalid tracking number format. Minimum 8 alphanumeric characters (USPS, UPS, FedEx, DHL, or regional).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          isLocalDelivery: isLocal,
          trackingNumber: isLocal ? undefined : trackingInput.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to confirm shipping status.');
      }

      setSuccessMessage(json.message || 'Shipment status confirmed!');
      if (onConfirmed) {
        onConfirmed(json.data);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting shipping status.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 relative overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>📦 Confirm Gift Shipment</span>
            </h3>
            {targetCodename && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Target Operative: <span className="text-sky-400 font-bold">{targetCodename}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg text-lg"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            ✓ {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delivery Method Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-400 mb-2 uppercase">
              Dispatch Vector
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDeliveryType('COURIER')}
                className={`p-3 rounded-xl border transition flex flex-col items-center gap-1 cursor-pointer ${
                  deliveryType === 'COURIER'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-400 font-black'
                    : isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                <span className="text-base">🚚</span>
                <span>Courier Parcel</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType('LOCAL')}
                className={`p-3 rounded-xl border transition flex flex-col items-center gap-1 cursor-pointer ${
                  deliveryType === 'LOCAL'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-black'
                    : isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                <span className="text-base">🤝</span>
                <span>Hand Delivery</span>
              </button>
            </div>
          </div>

          {/* Courier Parcel Tracking Section */}
          {deliveryType === 'COURIER' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-bold text-slate-400 uppercase">
                    Package Tracking Number
                  </label>
                  {carrierResult && carrierResult.isValid && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${carrierResult.badgeColor.bg} ${carrierResult.badgeColor.border} ${carrierResult.badgeColor.text}`}
                    >
                      ✓ {carrierResult.badgeLabel}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => handleTrackingChange(e.target.value)}
                  placeholder="e.g. 1Z9999999999999999 or 94001000..."
                  className={`w-full font-mono text-xs px-3 py-2.5 rounded-xl border focus:outline-none transition ${
                    isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-sky-500'
                      : 'bg-stone-50 border-stone-300 text-stone-900 focus:border-sky-500'
                  }`}
                />

                {/* Real-time Carrier Helper / Live Link Preview */}
                {carrierResult && (
                  <div className="mt-2 text-xs font-mono flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Carrier: <strong className="text-slate-200">{carrierResult.carrierName}</strong>
                    </span>
                    {carrierResult.trackingUrl && (
                      <a
                        href={carrierResult.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Test Link</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Immunity Waiver Banner */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1">
                  <span>🛡️ Carrier Protection Waiver</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Submitting a valid tracking number grants automatic penalty immunity. Even if carrier delays occur, no demerits can be assessed against your dossier.
                </p>
              </div>
            </div>
          )}

          {/* Local Hand Delivery Section */}
          {deliveryType === 'LOCAL' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <span>🤝 Covert Hand Delivery</span>
              </div>
              <p className="text-emerald-300/80 leading-relaxed text-[11px]">
                You are personally hand-delivering or covertly dropping off your gift. No courier tracking code required. Your shipment will be recorded immediately.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition ${
                isDarkMode
                  ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition shadow-lg shadow-sky-900/20 flex items-center justify-center gap-1 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <span>✓ Confirm Shipment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
