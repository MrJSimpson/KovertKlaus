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
  /** The Holiday Mission whose list the item belongs to. */
  exchangeId?: string;
  /** The mission's per-item price limit (`budgetMax`), shown and checked before saving. */
  itemMax?: number;
  /** Highest quantity of one item; 1 (White Elephant) hides the field. */
  maxQuantity?: number;
  /**
   * What the agent is adding: a store-bought gift (link + Get Data) or a personalized one
   * (handmade or specially crafted; every field filled in by hand). Edits read it from the item.
   */
  kind?: 'store' | 'personalized';
  initialData?: {
    id?: string;
    url?: string;
    title?: string;
    price?: number;
    quantity?: number;
    thumbnail?: string;
    description?: string;
    properties?: {
      isPersonalized?: boolean;
      details?: ItemDetail[];
      [key: string]: any;
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
  exchangeId,
  itemMax,
  maxQuantity = 1,
  kind = 'store',
  initialData,
  userDossier,
}: WishlistItemModalProps) {
  const { theme } = useTheme();

  // Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [thumbnail, setThumbnail] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<ProductCategory>('GENERAL');
  const [details, setDetails] = useState<ItemDetail[]>([]);
  const [catalogProps, setCatalogProps] = useState<CatalogProperties | null>(null);
  const [isPersonalizedMode, setIsPersonalizedMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Synchronize state when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage('');
    const rawTitle = initialData?.title || '';
    setTitle(rawTitle);
    setPrice(initialData?.price !== undefined && initialData?.price !== null ? String(initialData.price) : '');
    setQuantity(String(initialData?.quantity ?? 1));
    setThumbnail(initialData?.thumbnail || '');
    setDescription(initialData?.description || '');
    setUrl(initialData?.url || '');

    const isPersonalizedGift = mode === 'add'
      ? kind === 'personalized'
      : Boolean(initialData?.properties?.isPersonalized || !initialData?.url);
    setIsPersonalizedMode(isPersonalizedGift);

    const catProps = initialData?.catalogProperties || null;
    setCatalogProps(catProps);

    const detectedCat: ProductCategory = catProps?.category || 'GENERAL';
    setCategory(detectedCat);

    // Initialize details
    if (initialData?.properties?.details && initialData.properties.details.length > 0) {
      setDetails([...initialData.properties.details]);
    } else if (isPersonalizedGift) {
      setDetails([
        { label: 'Instructions', value: '' },
        { label: 'Preferences', value: '' },
      ]);
    } else {
      // Seed initial variables from category suggested keys
      const suggestedKeys = catProps?.variables || getCategorySuggestedKeys(detectedCat);
      const initialRows: ItemDetail[] = suggestedKeys.slice(0, 3).map((k) => ({
        label: k,
        value: '',
      }));
      setDetails(initialRows);
    }
  }, [isOpen, initialData, kind, mode]);

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

  /** Fills the form from the pasted store link (`/api/scraper`). Fields it cannot read stay as they are. */
  async function handleGetData() {
    setErrorMessage('');
    const link = url.trim();
    if (!link) {
      setErrorMessage('Paste a link to the item first.');
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });
      const json = await res.json().catch(() => ({}));
      const meta = json.metadata || {};
      if (meta.title) setTitle(String(meta.title).substring(0, 100));
      if (meta.price) setPrice(String(meta.price));
      if (meta.thumbnail) setThumbnail(meta.thumbnail);
      if (meta.description) setDescription(String(meta.description).substring(0, 500));
      if (meta.properties) {
        const props = meta.properties as CatalogProperties;
        const detected: ProductCategory = props.category || 'GENERAL';
        setCatalogProps(props);
        setCategory(detected);
        // Re-seed the detail rows for the detected category unless the agent already typed some.
        setDetails((prev) => prev.some((d) => d.value.trim())
          ? prev
          : (props.variables || getCategorySuggestedKeys(detected)).slice(0, 3).map((k) => ({ label: k, value: '' })));
      }
      if (!res.ok || !meta.title || !meta.price) {
        setErrorMessage(meta.title
          ? 'We filled in what we could. Please add the missing details below.'
          : "We couldn't read that page. Please fill in the details below.");
      }
    } catch {
      setErrorMessage("We couldn't read that page. Please fill in the details below.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    if (!title.trim()) {
      setErrorMessage('Item title is required.');
      return;
    }
    if (!isPersonalizedMode && !url.trim()) {
      setErrorMessage('Paste the link to the item in the store.');
      return;
    }
    if (isPersonalizedMode && !description.trim()) {
      setErrorMessage('Describe the gift for your Santa: what to make, and any details they need.');
      return;
    }

    setSaving(true);
    const cleanDetails = details
      .filter((d) => d.label.trim().length > 0 && d.value.trim().length > 0)
      .map((d) => ({ label: d.label.trim(), value: d.value.trim() }));

    // Every item needs a price within the mission's limit; the server checks the same rules.
    const parsedPrice = Number(price.trim());
    if (!price.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErrorMessage('Enter a price. For handmade or experience gifts, an estimate is fine.');
      setSaving(false);
      return;
    }
    if (itemMax !== undefined && Math.round(parsedPrice * 100) > Math.round(itemMax * 100)) {
      setErrorMessage(`Each item must cost $${itemMax.toFixed(2)} or less, the mission's spending limit.`);
      setSaving(false);
      return;
    }
    const parsedQuantity = Number(quantity.trim() || '1');
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > maxQuantity) {
      setErrorMessage(`Quantity must be a whole number from 1 to ${maxQuantity}.`);
      setSaving(false);
      return;
    }
    const cleanDescription = description.trim() || undefined;

    try {
      if (!exchangeId) {
        // Never fake a save: without a mission the item would vanish on reload.
        throw new Error('This list is not linked to a mission. Reload the page and try again.');
      }
      const res = await fetch('/api/wishlist', {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeId,
          itemId: mode === 'edit' ? initialData?.id : undefined,
          url: mode === 'add' ? url.trim() : undefined,
          title: title.trim(),
          price: parsedPrice,
          quantity: parsedQuantity,
          description: cleanDescription,
          // On edit, an empty string clears the thumbnail server-side.
          thumbnail: mode === 'add' ? thumbnail.trim() || undefined : thumbnail.trim(),
          properties: {
            isPersonalized: isPersonalizedMode,
            details: cleanDetails,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || (mode === 'add' ? 'Failed to add item to wishlist' : 'Failed to update Manifest Item'));
      }
      onSaveSuccess(json.item);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex sm:items-center items-end justify-center p-0 sm:p-4 overflow-y-auto">
      <div className={`w-full sm:max-w-xl max-h-[92dvh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border shadow-2xl transition-all my-0 sm:my-8 flex flex-col overflow-hidden ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-kk-border flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{isPersonalizedMode ? '✨' : mode === 'add' ? '🎁' : '✏️'}</span>
              <h3 className="text-lg sm:text-xl font-black">
                {isPersonalizedMode
                  ? mode === 'add'
                    ? 'Add a Personalized Gift'
                    : 'Edit Personalized Gift'
                  : mode === 'add'
                  ? 'Add a Store-Bought Gift'
                  : 'Edit Store-Bought Gift'}
              </h3>
            </div>
            <span className="text-xs text-kk-muted">
              {isPersonalizedMode
                ? '✨ Handmade or specially crafted'
                : categoryLabels[category] || 'Custom Gift Item'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-kk-muted hover:text-kk-ink font-bold text-lg min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 cursor-pointer transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs font-semibold">
            <div className={`p-3 rounded-xl border text-xs font-semibold ${theme.cardInnerBg}`}>
              {isPersonalizedMode
                ? 'Describe a handmade or specially crafted gift. Fill in every field marked *, including an estimated price.'
                : mode === 'add'
                ? <>Paste a link and click <strong>Get Data</strong> to auto-fill the form. Update any missing details.</>
                : 'Update any details your Santa needs. Fields marked * are required.'}
            </div>

            {!isPersonalizedMode && mode === 'add' && (
              <div>
                <label className="block text-[11px] text-kk-muted mb-0.5" htmlFor="wishlist-item-link">Link to the item *</label>
                <div className="flex gap-2">
                  <input
                    id="wishlist-item-link"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.store.com/item"
                    className={`flex-1 min-w-0 border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none ${theme.inputModalBg}`}
                  />
                  <button
                    type="button"
                    onClick={handleGetData}
                    disabled={lookingUp}
                    className={`px-4 py-2 rounded-xl font-bold text-xs shadow-sm cursor-pointer shrink-0 disabled:opacity-60 ${theme.btnPrimary}`}
                  >
                    {lookingUp ? 'Getting data…' : 'Get Data'}
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold border ${theme.alertWarning}`}>
                ⚠️ {errorMessage}
              </div>
            )}
          
          {/* Product Overview Card: Image, Title, Price */}
          <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
            <div className="flex items-start gap-4">
              {thumbnail ? (
                <div className="relative group shrink-0">
                  <img
                    src={thumbnail}
                    alt={title}
                    className="h-16 w-16 object-cover rounded-xl border border-kk-border shadow-sm"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-kk-inset flex items-center justify-center text-2xl shrink-0">
                  {isPersonalizedMode ? '✨' : '🛍️'}
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-[11px] text-kk-muted mb-0.5">
                    {isPersonalizedMode ? 'Gift name *' : 'Item name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      isPersonalizedMode
                        ? 'e.g. Handmade Holiday Cookies, Wool Knit Beanie, Sourdough Loaf'
                        : 'e.g. Classic Everyday Fleece Hoodie'
                    }
                    className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-kk-muted mb-0.5">
                      {isPersonalizedMode ? 'Estimated cost (USD $) *' : 'Price (USD $) *'}
                      {itemMax !== undefined && <span className="ml-1">(up to ${itemMax.toFixed(2)})</span>}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={itemMax}
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 25.00"
                      className={`w-full border rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-kk-muted mb-0.5">Image URL (Optional)</label>
                    <input
                      type="url"
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      placeholder="https://..."
                      className={`w-full border rounded-xl px-3 py-1.5 text-base sm:text-xs truncate focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                </div>

                {maxQuantity > 1 && (
                  <div>
                    <label htmlFor="wishlist-item-quantity" className="block text-[11px] text-kk-muted mb-0.5">
                      Quantity <span className="ml-1">(1 to {maxQuantity}; the price above is for one)</span>
                    </label>
                    <input
                      id="wishlist-item-quantity"
                      type="number"
                      step="1"
                      min="1"
                      max={maxQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={`w-24 border rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Description / Instructions for Santa */}
            <div>
              <label className="block text-[11px] text-kk-muted mb-0.5">
                {isPersonalizedMode ? 'Description for your Santa *' : 'Notes for your Santa (Optional)'}
              </label>
              <textarea
                rows={isPersonalizedMode ? 3 : 2}
                required={isPersonalizedMode}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isPersonalizedMode
                    ? 'What should your Santa make? Include colors, sizes, flavors, allergies or anything else they need to know.'
                    : 'Color preferences, sizing details, or gift receipt notes...'
                }
                className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs resize-none focus:outline-none ${theme.inputModalBg}`}
              />
              <div className="flex justify-end text-[10px] text-kk-muted mt-0.5 font-mono">
                {description.length}/500
              </div>
            </div>

            {isPersonalizedMode ? (
              <div className="pt-2 border-t border-kk-border">
                <label className="block text-[11px] text-kk-muted mb-0.5">Reference link, recipe or pattern (Optional)</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={mode === 'edit'}
                  placeholder="https://... (optional example for your Santa)"
                  className={`w-full border rounded-xl px-3 py-1.5 text-base sm:text-xs truncate focus:outline-none disabled:opacity-60 ${theme.inputModalBg}`}
                />
              </div>
            ) : mode === 'edit' && url ? (
              <div className="text-[11px] text-kk-muted flex items-center justify-between pt-1 border-t border-kk-border">
                <span className="truncate max-w-sm">🔗 {url}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-kk-accent hover:underline shrink-0 font-bold ml-2 min-h-[36px] flex items-center"
                >
                  View Store ↗
                </a>
              </div>
            ) : null}
          </div>

          {/* Section: Custom Item Details & Preferences */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block">
                  ⚙️ Specific Details for Your Secret Santa
                </span>
                <span className="text-[11px] text-kk-muted">
                  Size, color, style, or specific preferences (Up to {MAX_ITEM_DETAILS} details)
                </span>
              </div>

              {details.length < MAX_ITEM_DETAILS && (
                <button
                  type="button"
                  onClick={handleAddDetailRow}
                  className="text-[11px] font-bold text-kk-accent hover:underline cursor-pointer"
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
                        className={`w-1/3 border rounded-xl px-3 py-1.5 text-base sm:text-xs font-semibold focus:outline-none ${theme.inputModalBg}`}
                      />

                      <input
                        type="text"
                        value={detail.value}
                        onChange={(e) => handleDetailChange(idx, 'value', e.target.value)}
                        placeholder="Your choice (e.g. Large, Navy)"
                        className={`flex-1 border rounded-xl px-3 py-1.5 text-base sm:text-xs focus:outline-none ${theme.inputModalBg}`}
                      />

                      {details.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailRow(idx)}
                          className="text-kk-muted hover:text-kk-danger min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-sm cursor-pointer transition-colors"
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
                            className="bg-kk-inset border border-kk-border-strong text-kk-accent px-2 py-0.5 rounded-full hover:border-kk-border-strong transition flex items-center gap-1 cursor-pointer font-bold"
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
                            className="bg-kk-inset border border-kk-border px-2 py-0.5 rounded-full text-kk-muted hover:border-kk-border-strong transition cursor-pointer flex items-center gap-1"
                            title={`Chosen by ${opt.count} other operative${opt.count === 1 ? '' : 's'}`}
                          >
                            <span>{opt.val}</span>
                            <span className="text-[9px] text-kk-muted font-mono">({opt.count})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-6 border-t border-kk-border shrink-0 flex gap-3 pb-safe-sheet bg-inherit">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 min-h-[44px] rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`w-1/2 font-bold py-3 min-h-[44px] rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${theme.btnPrimary}`}
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
