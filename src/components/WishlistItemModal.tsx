'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  ItemDetail,
  ProductCategory,
  CatalogProperties,
  UserDossierPreferences,
  matchDossierToVariables,
  getCategorySuggestedKeys,
  MAX_ITEM_DETAILS,
} from '@/lib/product-intelligence';

export interface WishlistItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (savedItem: any) => void;
  mode: 'add' | 'edit';
  wishlistId?: string;
  initialData?: {
    id?: string;
    url: string;
    title: string;
    price?: number;
    thumbnail?: string;
    description?: string;
    properties?: {
      details?: ItemDetail[];
    };
    catalogProperties?: CatalogProperties;
  };
  userDossier?: UserDossierPreferences;
}

export function WishlistItemModal({
  isOpen,
  onClose,
  onSaveSuccess,
  mode,
  wishlistId,
  initialData,
  userDossier,
}: WishlistItemModalProps) {
  const { theme, isDarkMode } = useTheme();

  // Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [thumbnail, setThumbnail] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<ProductCategory>('GENERAL');
  const [details, setDetails] = useState<ItemDetail[]>([]);
  const [catalogProps, setCatalogProps] = useState<CatalogProperties | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Synchronize state when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage('');
    const rawTitle = initialData?.title || '';
    setTitle(rawTitle);
    setPrice(initialData?.price !== undefined && initialData?.price !== null ? String(initialData.price) : '');
    setThumbnail(initialData?.thumbnail || '');
    setUrl(initialData?.url || '');

    const catProps = initialData?.catalogProperties || null;
    setCatalogProps(catProps);

    const detectedCat: ProductCategory = catProps?.category || 'GENERAL';
    setCategory(detectedCat);

    // Initialize details
    if (initialData?.properties?.details && initialData.properties.details.length > 0) {
      setDetails([...initialData.properties.details]);
    } else {
      // Seed initial variables from category suggested keys
      const suggestedKeys = catProps?.variables || getCategorySuggestedKeys(detectedCat);
      const initialRows: ItemDetail[] = suggestedKeys.slice(0, 3).map((k) => ({
        label: k,
        value: '',
      }));
      setDetails(initialRows);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Dossier quick-matches for current detail rows
  const activeLabels = details.map((d) => d.label);
  const dossierSuggestions = userDossier ? matchDossierToVariables(activeLabels, userDossier) : {};

  // Category labels with emojis
  const categoryLabels: Record<ProductCategory, string> = {
    APPAREL_TOPS: '👕 Apparel (Tops & Outerwear)',
    APPAREL_BOTTOMS: '👖 Apparel (Pants & Bottoms)',
    FOOTWEAR: '👟 Footwear & Shoes',
    ELECTRONICS: '📱 Tech & Electronics',
    BOOKS_GAMES: '📚 Books, Media & Games',
    GENERAL: '🎁 General Merchandise',
  };

  function handleDetailChange(index: number, field: 'label' | 'value', text: string) {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: text };
      return next;
    });
  }

  function handleAddDetailRow() {
    if (details.length >= MAX_ITEM_DETAILS) return;
    setDetails((prev) => [...prev, { label: '', value: '' }]);
  }

  function handleRemoveDetailRow(index: number) {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }

  function handleApplyOption(index: number, val: string) {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value: val };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    if (!title.trim()) {
      setErrorMessage('Item title is required.');
      return;
    }

    setSaving(true);
    const cleanDetails = details
      .filter((d) => d.label.trim().length > 0 && d.value.trim().length > 0)
      .map((d) => ({ label: d.label.trim(), value: d.value.trim() }));

    const parsedPrice = price.trim() ? parseFloat(price.trim()) : 0;

    try {
      if (mode === 'add') {
        if (wishlistId) {
          const res = await fetch('/api/opkits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_manifest_item',
              wishlistId,
              url: url.trim(),
              title: title.trim(),
              price: parsedPrice,
              thumbnail: thumbnail.trim() || undefined,
              properties: { details: cleanDetails },
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || 'Failed to add item to wishlist');
          }

          onSaveSuccess(json.manifestItem || json.opTool);
        } else {
          // Client-side fallback if wishlistId is not provided
          onSaveSuccess({
            id: Math.random().toString(36).substring(2, 9),
            url: url.trim(),
            title: title.trim(),
            price: parsedPrice,
            thumbnail: thumbnail.trim() || undefined,
            properties: { details: cleanDetails },
          });
        }
      } else {
        // Edit Mode
        if (initialData?.id && !initialData.id.startsWith('mock-') && initialData.id.length > 10) {
          try {
            const res = await fetch('/api/opkits', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemId: initialData.id,
                title: title.trim(),
                price: parsedPrice,
                thumbnail: thumbnail.trim() || undefined,
                properties: { details: cleanDetails },
              }),
            });

            const json = await res.json();
            if (res.ok && json.success) {
              onSaveSuccess(json.manifestItem);
              onClose();
              return;
            }
          } catch {
            // Fall through to local update
          }
        }

        onSaveSuccess({
          id: initialData?.id || Math.random().toString(36).substring(2, 9),
          url: url.trim(),
          title: title.trim(),
          price: parsedPrice,
          thumbnail: thumbnail.trim() || undefined,
          properties: { details: cleanDetails },
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-xl w-full border shadow-2xl transition-all my-8 ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{mode === 'add' ? '✨' : '✏️'}</span>
              <h3 className="text-xl font-black">
                {mode === 'add' ? 'Confirm & Customize Wishlist Item' : 'Edit Wishlist Item Details'}
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {categoryLabels[category] || 'Custom Gift Item'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1.5"
            title="Close"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold border ${theme.alertWarning}`}>
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs font-semibold">
          
          {/* Product Overview Card: Image, Title, Price */}
          <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
            <div className="flex items-start gap-4">
              {thumbnail ? (
                <div className="relative group shrink-0">
                  <img
                    src={thumbnail}
                    alt={title}
                    className="h-16 w-16 object-cover rounded-xl border border-stone-200 dark:border-slate-800 shadow-sm"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-2xl shrink-0">
                  🛍️
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Classic Everyday Fleece Hoodie"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Price (USD $)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 29.99"
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Image URL</label>
                    <input
                      type="url"
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      placeholder="https://..."
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs truncate focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {url && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-stone-200 dark:border-slate-800">
                <span className="truncate max-w-sm">🔗 {url}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-500 hover:underline shrink-0 font-bold ml-2"
                >
                  View Store ↗
                </a>
              </div>
            )}
          </div>

          {/* Section: Custom Item Details & Preferences */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block">
                  ⚙️ Specific Details for Your Secret Santa
                </span>
                <span className="text-[11px] text-slate-500">
                  Size, color, style, or specific preferences (Up to {MAX_ITEM_DETAILS} details)
                </span>
              </div>

              {details.length < MAX_ITEM_DETAILS && (
                <button
                  type="button"
                  onClick={handleAddDetailRow}
                  className="text-[11px] font-bold text-sky-500 hover:underline cursor-pointer"
                >
                  + Add Detail
                </button>
              )}
            </div>

            {/* Detail Rows */}
            <div className="space-y-2.5">
              {details.map((detail, idx) => {
                const dossierVals = dossierSuggestions[detail.label] || [];
                const communityOptions = catalogProps?.popularOptions?.[detail.label] || [];

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border space-y-2 ${theme.cardInnerBg}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={detail.label}
                        onChange={(e) => handleDetailChange(idx, 'label', e.target.value)}
                        placeholder="Variable (e.g. Size, Color)"
                        className={`w-1/3 border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none ${theme.inputModalBg}`}
                      />

                      <input
                        type="text"
                        value={detail.value}
                        onChange={(e) => handleDetailChange(idx, 'value', e.target.value)}
                        placeholder="Your choice (e.g. Large, Navy)"
                        className={`flex-1 border rounded-xl px-3 py-1.5 text-xs focus:outline-none ${theme.inputModalBg}`}
                      />

                      {details.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailRow(idx)}
                          className="text-slate-400 hover:text-red-500 p-1 text-sm cursor-pointer"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Smart Suggestion Chips */}
                    {(dossierVals.length > 0 || communityOptions.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        {/* Profile Dossier Matches */}
                        {dossierVals.map((val) => (
                          <button
                            key={`dossier-${val}`}
                            type="button"
                            onClick={() => handleApplyOption(idx, val)}
                            className="bg-sky-50 dark:bg-sky-950/60 border border-sky-400/60 text-sky-600 dark:text-sky-300 px-2 py-0.5 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="Click to apply size/color from your saved account dossier"
                          >
                            <span>✨ Dossier:</span>
                            <span>{val}</span>
                          </button>
                        ))}

                        {/* Community Popular Options from ProductCatalog */}
                        {communityOptions.map((opt) => (
                          <button
                            key={`opt-${opt.val}`}
                            type="button"
                            onClick={() => handleApplyOption(idx, opt.val)}
                            className="bg-stone-100 dark:bg-slate-800 border border-stone-300 dark:border-slate-700 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer flex items-center gap-1"
                            title={`Chosen by ${opt.count} other operative${opt.count === 1 ? '' : 's'}`}
                          >
                            <span>{opt.val}</span>
                            <span className="text-[9px] text-slate-400 font-mono">({opt.count})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-stone-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`w-1/2 font-bold py-3 rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${theme.btnPrimary}`}
            >
              {saving ? (
                <span>Saving Details...</span>
              ) : (
                <span>{mode === 'add' ? '🎁 Add to Wishlist' : '✓ Save Changes'}</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
