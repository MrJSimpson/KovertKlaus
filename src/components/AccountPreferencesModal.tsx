'use client';

import { USER_ID_KEY } from '@/lib/constants/auth';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { generateRandomCodename } from '@/lib/codename';
import { Card, Button, Badge } from '@/components/ui';

export interface AccountPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export function AccountPreferencesModal({ isOpen, onClose, onProfileUpdated }: AccountPreferencesModalProps) {
  const { theme, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'identity' | 'shipping' | 'dossier' | 'security'>('identity');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codename, setCodename] = useState('');
  const [preferredCodename, setPreferredCodename] = useState('');
  const [autoRandomizeCodename, setAutoRandomizeCodename] = useState(false);
  
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
        setPreferredCodename(data.user.preferredCodename || rawCodename);
        setAutoRandomizeCodename(Boolean(data.user.autoRandomizeCodename));
        
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
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem(USER_ID_KEY) : undefined;

      const payload: any = {
        userId: savedUserId,
        name,
        codename: preferredCodename || codename,
        preferredCodename: preferredCodename || codename,
        autoRandomizeCodename,
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
                      <label className={`block text-xs font-semibold ${theme.textLabel}`}>Preferred Operative Codename</label>
                      <button
                        type="button"
                        onClick={() => setPreferredCodename(generateRandomCodename())}
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
                        value={preferredCodename}
                        onChange={(e) => setPreferredCodename(e.target.value)}
                        placeholder="e.g. Viper, Phoenix, Sentinel"
                        className={`flex-1 border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                    <p className={`text-[11px] mt-1 ${theme.textSubLabel}`}>
                      Your default identity across holiday operations. You can adjust this for individual missions.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-200 dark:border-slate-800">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRandomizeCodename}
                        onChange={(e) => setAutoRandomizeCodename(e.target.checked)}
                        className="mt-0.5 rounded text-sky-500 focus:ring-0"
                      />
                      <div>
                        <span className={`text-xs font-bold block ${theme.textLabel}`}>
                          🎲 Always randomize codename when joining operations (Stealth Mode)
                        </span>
                        <span className={`text-[11px] block mt-0.5 ${theme.textSubLabel}`}>
                          When enabled, you will be assigned a fresh random tactical callsign on every new mission for maximum secrecy.
                        </span>
                      </div>
                    </label>
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
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none ${theme.inputBg}`}
                      >
                        <option value="US">United States (US)</option>
                        <option value="CA">Canada (CA)</option>
                        <option value="GB">United Kingdom (GB)</option>
                        <option value="AU">Australia (AU)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={`block text-xs font-semibold mb-1 ${theme.textLabel}`}>Courier Delivery Notes (Gate Code / Drop Location)</label>
                      <input
                        type="text"
                        placeholder="e.g. Leave package on front porch behind planter."
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
                    Provide sizing and preferences so your Secret Santa can find gifts that fit your style.
                  </p>

                  {/* Section A: Sizing */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>👕 Clothing & Sizing</h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewSizes}
                          onChange={(e) => setAllowOperatorViewSizes(e.target.checked)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span className={`text-[11px] ${theme.textSubLabel}`}>Visible to Buyer</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Top / Shirt Size</label>
                        <input
                          type="text"
                          placeholder="e.g. L, Men's XL, Women's M"
                          value={topHalfSize}
                          onChange={(e) => setTopHalfSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Bottom / Pants Size</label>
                        <input
                          type="text"
                          placeholder="e.g. 34x32, 10, Medium"
                          value={bottomHalfSize}
                          onChange={(e) => setBottomHalfSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Shoe Size</label>
                        <input
                          type="text"
                          placeholder="e.g. 10.5 Men, 8 Women"
                          value={shoeSize}
                          onChange={(e) => setShoeSize(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section B: Tailored Measurements */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>📐 Tailored Measurements</h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewMeasurements}
                          onChange={(e) => setAllowOperatorViewMeasurements(e.target.checked)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span className={`text-[11px] ${theme.textSubLabel}`}>Visible to Buyer</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Chest / Bust (in)</label>
                        <input
                          type="text"
                          placeholder="e.g. 40 in"
                          value={chestBustMeasurement}
                          onChange={(e) => setChestBustMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Waist (in)</label>
                        <input
                          type="text"
                          placeholder="e.g. 34 in"
                          value={waistMeasurement}
                          onChange={(e) => setWaistMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Inseam (in)</label>
                        <input
                          type="text"
                          placeholder="e.g. 32 in"
                          value={inseamMeasurement}
                          onChange={(e) => setInseamMeasurement(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section C: Dietary & Allergies */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>🥜 Allergies & Dietary Restrictions</h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewAllergies}
                          onChange={(e) => setAllowOperatorViewAllergies(e.target.checked)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span className={`text-[11px] ${theme.textSubLabel}`}>Visible to Buyer</span>
                      </label>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="e.g. Peanut allergy, Gluten-free, Vegetarian"
                        value={allergiesDiet}
                        onChange={(e) => setAllergiesDiet(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>

                  {/* Section D: Hobbies & Favorites */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>🎨 Favorite Colors & Hobbies</h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOperatorViewFavorites}
                          onChange={(e) => setAllowOperatorViewFavorites(e.target.checked)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span className={`text-[11px] ${theme.textSubLabel}`}>Visible to Buyer</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Favorite Colors</label>
                        <input
                          type="text"
                          placeholder="e.g. Forest Green, Navy Blue"
                          value={favoriteColors}
                          onChange={(e) => setFavoriteColors(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Hobbies & Interests</label>
                        <input
                          type="text"
                          placeholder="e.g. Coffee brewing, Board games, Sci-Fi"
                          value={favoriteHobbies}
                          onChange={(e) => setFavoriteHobbies(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & COMPLIANCE */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Demerit Citations Gauge */}
                  <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-bold block ${theme.textLabel}`}>Coal Citations (Demerit Score)</span>
                      <span className={`text-[11px] ${theme.textSubLabel}`}>
                        {demerits === 0 ? 'Exemplary record. No demerits issued.' : `${demerits} demerit citations on record.`}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${
                      demerits === 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                    }`}>
                      {demerits === 0 ? '0 COAL CITATIONS' : `${demerits} COAL CITATIONS`}
                    </span>
                  </div>

                  {/* Password Rotation */}
                  <div className="space-y-3 pt-2">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textLabel}`}>🔑 Rotate Secret Password</h4>
                    <div>
                      <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] mb-1 ${theme.textSubLabel}`}>New Password (Min 10 characters)</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                      />
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="pt-2 border-t border-stone-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        className="rounded text-sky-500 focus:ring-0"
                      />
                      <span className={`text-xs font-bold ${theme.textLabel}`}>
                        Receive transactional email alerts for invitations and target reveals
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                saving ? 'opacity-50' : theme.btnPrimary
              }`}
            >
              {saving ? '💾 Saving Changes...' : '💾 Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
