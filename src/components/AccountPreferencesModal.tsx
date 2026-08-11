'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { generateRandomCodename } from '@/lib/codenameGenerator';
import { Card, Button, Badge } from '@/components/ui';

export interface AccountPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export function AccountPreferencesModal({ isOpen, onClose, onProfileUpdated }: AccountPreferencesModalProps) {
  const { theme, isDarkMode, terminology } = useTheme();
  const [activeTab, setActiveTab] = useState<'identity' | 'shipping' | 'dossier' | 'security'>('identity');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codename, setCodename] = useState('');
  
  // Shipping State
  const [streetAddress, setStreetAddress] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('US');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Operative Dossier State
  const [topHalfSize, setTopHalfSize] = useState('');
  const [bottomHalfSize, setBottomHalfSize] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [chestBustMeasurement, setChestBustMeasurement] = useState('');
  const [waistMeasurement, setWaistMeasurement] = useState('');
  const [inseamMeasurement, setInseamMeasurement] = useState('');
  const [favoriteColors, setFavoriteColors] = useState('');
  const [allergiesDiet, setAllergiesDiet] = useState('');
  const [favoriteHobbies, setFavoriteHobbies] = useState('');

  // Granular Section-Level Privacy Clearances
  const [allowOperatorViewSizes, setAllowOperatorViewSizes] = useState(true);
  const [allowOperatorViewMeasurements, setAllowOperatorViewMeasurements] = useState(false);
  const [allowOperatorViewAllergies, setAllowOperatorViewAllergies] = useState(true);
  const [allowOperatorViewFavorites, setAllowOperatorViewFavorites] = useState(false);

  // Security & Notifications State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [demerits, setDemerits] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  async function fetchProfile() {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/users/profile');
      const data = await res.json();
      if (data.success && data.user) {
        setName(data.user.name || '');
        setEmail(data.user.email || '');
        
        // Strip legacy Agent- prefix if provided for clean input display
        let rawCodename = (data.user.codename || '').replace(/^(agent[-:\s]+)/i, '').trim();
        setCodename(rawCodename);
        
        setStreetAddress(data.user.streetAddress || '');
        setAddressLine2(data.user.addressLine2 || '');
        setCity(data.user.city || '');
        setState(data.user.state || '');
        setZipCode(data.user.zipCode || '');
        setCountry(data.user.country || 'US');
        setDeliveryNotes(data.user.deliveryNotes || '');

        setTopHalfSize(data.user.topHalfSize || data.user.shirtSize || '');
        setBottomHalfSize(data.user.bottomHalfSize || '');
        setShoeSize(data.user.shoeSize || '');
        setChestBustMeasurement(data.user.chestBustMeasurement || '');
        setWaistMeasurement(data.user.waistMeasurement || '');
        setInseamMeasurement(data.user.inseamMeasurement || '');
        setFavoriteColors(data.user.favoriteColors || '');
        setAllergiesDiet(data.user.allergiesDiet || '');
        setFavoriteHobbies(data.user.favoriteHobbies || '');

        setAllowOperatorViewSizes(data.user.allowOperatorViewSizes ?? true);
        setAllowOperatorViewMeasurements(data.user.allowOperatorViewMeasurements ?? false);
        setAllowOperatorViewAllergies(data.user.allowOperatorViewAllergies ?? true);
        setAllowOperatorViewFavorites(Boolean(data.user.allowOperatorViewFavorites));

        setEmailNotifications(data.user.emailNotifications ?? true);
        setDemerits(data.user.demerits || 0);
      }
    } catch {
      setErrorMessage('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_user_id') : undefined;

      const payload: any = {
        userId: savedUserId,
        name,
        codename,
        streetAddress,
        addressLine2,
        city,
        state,
        zipCode,
        country,
        deliveryNotes,
        topHalfSize,
        bottomHalfSize,
        shoeSize,
        shirtSize: topHalfSize,
        chestBustMeasurement,
        waistMeasurement,
        inseamMeasurement,
        favoriteColors,
        allergiesDiet,
        favoriteHobbies,
        allowOperatorViewSizes,
        allowOperatorViewMeasurements,
        allowOperatorViewAllergies,
        allowOperatorViewFavorites,
        emailNotifications,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccessMessage('Profile and Operative Dossier updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden ${theme.cardBg}`}>
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚙️</span>
              <h2 className={`text-2xl font-black ${theme.textHeading}`}>Account Preferences & Operative Dossier</h2>
            </div>
            <p className={`text-xs ${theme.textSubLabel}`}>
              Manage your identity, courier shipping address, gifting preferences, and security parameters.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b overflow-x-auto text-xs font-bold px-6 ${theme.tabBarBg}`}>
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`py-3.5 px-4 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'identity' ? theme.tabActive : theme.tabInactive
            }`}
          >
            👤 Identity & Codename
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shipping')}
            className={`py-3.5 px-4 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'shipping' ? theme.tabActive : theme.tabInactive
            }`}
          >
            📦 Courier Shipping Address
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`py-3.5 px-4 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'dossier' ? theme.tabActive : theme.tabInactive
            }`}
          >
            🕵️ Operative Dossier
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3.5 px-4 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'security' ? theme.tabActive : theme.tabInactive
            }`}
          >
            🔒 Security & Compliance
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 max-h-[65vh] overflow-y-auto space-y-6">
          {successMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold border ${theme.alertSuccess}`}>
              ✓ {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold border ${theme.alertWarning}`}>
              ⚠️ {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-3xl animate-spin mb-2">🎁</div>
              <p className={`text-xs ${theme.textSubLabel}`}>Loading profile data...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: IDENTITY */}
              {activeTab === 'identity' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Email Address</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs ${theme.inputDisabled}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-xs font-semibold ${theme.textLabel}`}>Operative Codename</label>
                      <button
                        type="button"
                        onClick={() => setCodename(generateRandomCodename())}
                        className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        🎲 Randomize Call Sign
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-3 py-2.5 rounded-xl border ${theme.badgeCode}`}>
                        Agent:
                      </span>
                      <input
                        type="text"
                        value={codename}
                        onChange={(e) => setCodename(e.target.value)}
                        placeholder="e.g. Viper, Phoenix, Sentinel"
                        className={`flex-1 border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COURIER SHIPPING ADDRESS */}
              {activeTab === 'shipping' && (
                <div className="space-y-4">
                  <p className={`text-xs ${theme.textSubLabel}`}>
                    Your physical delivery address is shared <strong>strictly with your assigned Secret Santa operative</strong> for gift delivery.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Street Address Line 1</label>
                      <input
                        type="text"
                        placeholder="e.g. 123 North Pole Way"
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Street Address Line 2 (Apt / Suite / Unit)</label>
                      <input
                        type="text"
                        placeholder="e.g. Apt 4B"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>City</label>
                      <input
                        type="text"
                        placeholder="e.g. Fairbanks"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>State / Province</label>
                      <input
                        type="text"
                        placeholder="e.g. AK"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>ZIP / Postal Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 99701"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Country</label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Courier Delivery Notes (Gate Code / Drop-off Instructions)</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Gate code #4012. Leave package on side porch by red bench."
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: OPERATIVE DOSSIER */}
              {activeTab === 'dossier' && (
                <div className="space-y-6">
                  <p className={`text-xs ${theme.textSubLabel}`}>
                    Configure optional sizing metrics for apparel & body measurements. Unselected metrics remain <strong>CONFIDENTIAL</strong>.
                  </p>

                  {/* Section 1: Standardized Letter Apparel & Footwear */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${theme.textHeading}`}>
                        👕 Standardized Apparel & Footwear
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewSizes}
                          onChange={(e) => setAllowOperatorViewSizes(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-stone-300 accent-red-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {terminology.privacySizesToggle}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Top Half Size (Shirts)</label>
                        <select
                          value={topHalfSize}
                          onChange={(e) => setTopHalfSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        >
                          <option value="">CONFIDENTIAL (Unspecified)</option>
                          <option value="XXS">XXS (Double Extra Small)</option>
                          <option value="XS">XS (Extra Small)</option>
                          <option value="S">S (Small)</option>
                          <option value="M">M (Medium)</option>
                          <option value="L">L (Large)</option>
                          <option value="XL">XL (Extra Large)</option>
                          <option value="2XL">2XL (Double Large)</option>
                          <option value="3XL">3XL (Triple Large)</option>
                          <option value="4XL">4XL (Quadruple Large)</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Bottom Half Size (Pants)</label>
                        <select
                          value={bottomHalfSize}
                          onChange={(e) => setBottomHalfSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        >
                          <option value="">CONFIDENTIAL (Unspecified)</option>
                          <option value="XXS">XXS (Double Extra Small)</option>
                          <option value="XS">XS (Extra Small)</option>
                          <option value="S">S (Small)</option>
                          <option value="M">M (Medium)</option>
                          <option value="L">L (Large)</option>
                          <option value="XL">XL (Extra Large)</option>
                          <option value="2XL">2XL (Double Large)</option>
                          <option value="3XL">3XL (Triple Large)</option>
                          <option value="4XL">4XL (Quadruple Large)</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Shoe Size (US Dual-Gender)</label>
                        <select
                          value={shoeSize}
                          onChange={(e) => setShoeSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        >
                          <option value="">CONFIDENTIAL (Unspecified)</option>
                          <option value="US 5M / 6.5W">US 5M / 6.5W</option>
                          <option value="US 5.5M / 7W">US 5.5M / 7W</option>
                          <option value="US 6M / 7.5W">US 6M / 7.5W</option>
                          <option value="US 6.5M / 8W">US 6.5M / 8W</option>
                          <option value="US 7M / 8.5W">US 7M / 8.5W</option>
                          <option value="US 7.5M / 9W">US 7.5M / 9W</option>
                          <option value="US 8M / 9.5W">US 8M / 9.5W</option>
                          <option value="US 8.5M / 10W">US 8.5M / 10W</option>
                          <option value="US 9M / 10.5W">US 9M / 10.5W</option>
                          <option value="US 9.5M / 11W">US 9.5M / 11W</option>
                          <option value="US 10M / 11.5W">US 10M / 11.5W</option>
                          <option value="US 10.5M / 12W">US 10.5M / 12W</option>
                          <option value="US 11M / 12.5W">US 11M / 12.5W</option>
                          <option value="US 11.5M / 13W">US 11.5M / 13W</option>
                          <option value="US 12M / 13.5W">US 12M / 13.5W</option>
                          <option value="US 13M / 14.5W">US 13M / 14.5W</option>
                          <option value="US 14M / 15.5W">US 14M / 15.5W</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Body Measurements */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${theme.textHeading}`}>
                        📏 Body Measurements (Optional)
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewMeasurements}
                          onChange={(e) => setAllowOperatorViewMeasurements(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-stone-300 accent-red-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {terminology.privacyMeasurementsToggle}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Chest / Bust</label>
                        <input
                          type="text"
                          placeholder="e.g. 38 in / 96 cm"
                          value={chestBustMeasurement}
                          onChange={(e) => setChestBustMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Waist</label>
                        <input
                          type="text"
                          placeholder="e.g. 32 in / 81 cm"
                          value={waistMeasurement}
                          onChange={(e) => setWaistMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Inseam Length</label>
                        <input
                          type="text"
                          placeholder="e.g. 30 in / 76 cm"
                          value={inseamMeasurement}
                          onChange={(e) => setInseamMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Allergies & Dietary Restrictions */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${theme.textHeading}`}>
                        ⚠️ Dietary Restrictions & Allergies
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewAllergies}
                          onChange={(e) => setAllowOperatorViewAllergies(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-stone-300 accent-red-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {terminology.privacyAllergiesToggle}
                        </span>
                      </label>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="e.g. Peanut allergy, Gluten-Free, No alcohol"
                        value={allergiesDiet}
                        onChange={(e) => setAllergiesDiet(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>

                  {/* Section 4: Favorite Colors, Hobbies & Fandoms */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${theme.textHeading}`}>
                        🎨 Favorite Colors, Hobbies & Fandoms
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewFavorites}
                          onChange={(e) => setAllowOperatorViewFavorites(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-stone-300 accent-red-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {terminology.privacyFavoritesToggle}
                        </span>
                      </label>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="e.g. Forest Green, Sci-Fi novels, Espresso coffee, Board games"
                        value={favoriteHobbies}
                        onChange={(e) => setFavoriteHobbies(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & COMPLIANCE */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Demerits & Penalty Ledger */}
                  <Card variant="inner" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${theme.textLabel}`}>{terminology.naughtyListSectionHeader} Record</span>
                      <Badge variant={demerits === 0 ? 'code' : demerits >= 3 ? 'rose' : 'amber'}>
                        {demerits === 0
                          ? `0 ${terminology.penaltyUnitPlural} (Clean Standing 🟢)`
                          : demerits >= 3
                          ? `${demerits} ${terminology.penaltyUnitPlural} (Remote Restricted 🔴)`
                          : `${demerits} ${terminology.penaltyUnitSingular}(s) (Caution 🟡)`}
                      </Badge>
                    </div>
                    <p className={`text-xs ${theme.textSubLabel}`}>
                      {terminology.penaltyNoticeText} Accumulating 3+ {terminology.penaltyUnitPlural.toLowerCase()} restricts remote physical gifting privileges. Carrier tracking waivers automatically protect against loss.
                    </p>
                  </Card>

                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-stone-200 dark:border-slate-800">
                    <div>
                      <span className={`text-xs font-bold block ${theme.textLabel}`}>Encrypted Email Alerts</span>
                      <span className={`text-[11px] ${theme.textSubLabel}`}>Receive draw updates, shipping notifications, and anonymous intel alerts.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="h-5 w-5 rounded border-stone-300 accent-red-600 cursor-pointer"
                    />
                  </div>

                  {/* Change Password */}
                  <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-slate-800">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>Security & Password Update</h3>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Current Password</label>
                      <input
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>New Password</label>
                      <input
                        type="password"
                        placeholder="Enter new strong password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>

                    {newPassword.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono">
                        <div className="font-bold mb-1 text-slate-700 dark:text-slate-300">Password Security Requirements:</div>
                        <div className={newPassword.length >= 10 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                          {newPassword.length >= 10 ? '✓' : '○'} Minimum 10 characters long
                        </div>
                        <div className={/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                          {/[A-Z]/.test(newPassword) ? '✓' : '○'} At least 1 uppercase letter (A-Z)
                        </div>
                        <div className={/[a-z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                          {/[a-z]/.test(newPassword) ? '✓' : '○'} At least 1 lowercase letter (a-z)
                        </div>
                        <div className={/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                          {/[0-9]/.test(newPassword) ? '✓' : '○'} At least 1 number (0-9)
                        </div>
                        <div className={/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                          {/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(newPassword) ? '✓' : '○'} At least 1 special character (!@#$%^&*)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${theme.btnToggle}`}
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving || loading} variant="primary">
              {saving ? 'Saving Changes...' : 'Save Profile Preferences'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
