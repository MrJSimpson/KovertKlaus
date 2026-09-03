'use client';

import React, { useState, useRef } from 'react';
import {
  compressImageToWebP,
  calculateAspectFitDimensions,
  formatFileSize,
  CompressedImageResult,
} from '@/lib/imageCompression';
import { AfterActionReportSection, AARReportEntry } from '@/components/AfterActionReportSection';

export default function AARWorkshopBenchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compression Lab Settings
  const [maxWidth, setMaxWidth] = useState(1200);
  const [maxHeight, setMaxHeight] = useState(1200);
  const [quality, setQuality] = useState(0.82);
  const [targetMime, setTargetMime] = useState<'image/webp' | 'image/jpeg' | 'image/png'>('image/webp');

  // Interactive Test State
  const [compressing, setCompressing] = useState(false);
  const [compressionTimeMs, setCompressionTimeMs] = useState<number | null>(null);
  const [originalFile, setOriginalFile] = useState<{ name: string; size: number; type: string; url: string } | null>(null);
  const [result, setResult] = useState<CompressedImageResult | null>(null);
  const [error, setError] = useState('');

  // Simulated Live AAR Feed State
  const [mockReports, setMockReports] = useState<AARReportEntry[]>([
    {
      id: 'mock-1',
      userId: 'user-shannon',
      thankYouText: '[🎁 Received in Person] Thank you so much Secret Santa! The cozy winter throw blanket and gourmet cocoa are perfect for the snowstorm! 🎄☕',
      photoUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      user: {
        id: 'user-shannon',
        name: 'Shannon Simpson',
        codename: 'Agent: Starlight',
      },
    },
    {
      id: 'mock-2',
      userId: 'user-zach',
      thankYouText: '[🐘 White Elephant Unboxed] Stole the tactical titanium multitool on turn 3 and held through the 3-swap freeze! Best White Elephant steal ever! 🕶️⚡',
      photoUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      user: {
        id: 'user-zach',
        name: 'Zach Simpson',
        codename: 'Agent: Shadow',
      },
    },
    {
      id: 'mock-3',
      userId: 'user-terry',
      thankYouText: '[📦 Delivered via Carrier] Package arrived on time in pristine condition! Thank you for the aviation mechanics handbook and tools! ✈️',
      photoUrl: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      user: {
        id: 'user-terry',
        name: 'Terry Simpson',
        codename: 'Agent: Falcon',
      },
    },
  ]);

  async function handleFileProcess(file: File) {
    setError('');
    setCompressing(true);
    const start = performance.now();

    try {
      const originalUrl = URL.createObjectURL(file);
      setOriginalFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url: originalUrl,
      });

      const compressed = await compressImageToWebP(file, {
        maxWidth,
        maxHeight,
        quality,
        targetMimeType: targetMime,
      });

      const elapsed = Math.round(performance.now() - start);
      setCompressionTimeMs(elapsed);
      setResult(compressed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compression failed';
      setError(msg);
      setResult(null);
    } finally {
      setCompressing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  }

  // Generate synthetic sample photo for rapid testing without external files
  function generateSyntheticCanvas(width: number, height: number, label: string): File {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Festive gradient background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#064e3b'); // Dark Emerald
    grad.addColorStop(0.5, '#0f172a'); // Slate 900
    grad.addColorStop(1, '#991b1b'); // Crimson Red
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Festive Text Overlay
    ctx.fillStyle = '#fbbf24'; // Amber Gold
    ctx.font = `bold ${Math.max(24, Math.round(width / 20))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🎁 KOVERTKLAUS AAR PHOTO BENCH', width / 2, height / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(16, Math.round(width / 32))}px monospace`;
    ctx.fillText(`${label} (${width}×${height})`, width / 2, height / 2 + 20);
    ctx.fillText(`Timestamp: ${new Date().toLocaleTimeString()}`, width / 2, height / 2 + 60);

    // Convert to Blob and File
    const dataUrl = canvas.toDataURL('image/png');
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/png' });
    return new File([blob], `synthetic-${width}x${height}.png`, { type: 'image/png' });
  }

  function handleLoadPreset(preset: 'dslr' | 'phone_portrait' | 'square' | 'huge') {
    let file: File;
    if (preset === 'dslr') {
      file = generateSyntheticCanvas(3840, 2160, '4K Ultra-HD Landscape Gift');
    } else if (preset === 'phone_portrait') {
      file = generateSyntheticCanvas(1440, 3120, 'High-Res Phone Camera Portrait');
    } else if (preset === 'square') {
      file = generateSyntheticCanvas(2048, 2048, 'Square Social Unboxing Photo');
    } else {
      file = generateSyntheticCanvas(5000, 3500, 'Raw 17MP Oversized Camera File');
    }
    handleFileProcess(file);
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-500/30">
              LAB BENCH // AAR & IMAGE OPTIMIZATION
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            After-Action Report & WebP Compressor Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Test client-side canvas WebP downscaling, compression ratios, delivery tags, and interactive debrief feeds.
          </p>
        </div>

        {/* Preset Triggers */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleLoadPreset('phone_portrait')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            📱 Phone (1440×3120)
          </button>
          <button
            onClick={() => handleLoadPreset('dslr')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            📸 4K (3840×2160)
          </button>
          <button
            onClick={() => handleLoadPreset('huge')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            🐘 17MP Raw File
          </button>
        </div>
      </div>

      {/* SECTION 1: Compression Parameter Controls & Drag Drop Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Tunable Parameters */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-lg">
            <h2 className="text-sm font-black uppercase text-amber-300 font-mono tracking-wider flex items-center gap-2">
              <span>⚙️ Compression Parameters</span>
            </h2>

            {/* Max Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1 font-mono">Max Width (px)</label>
                <input
                  type="number"
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(Math.max(200, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1 font-mono">Max Height (px)</label>
                <input
                  type="number"
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(Math.max(200, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Quality Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="font-bold text-gray-300">WebP Quality</span>
                <span className="text-emerald-400 font-bold">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                <span>Smaller Size (20%)</span>
                <span>Balanced (82%)</span>
                <span>Max Quality (100%)</span>
              </div>
            </div>

            {/* Target MIME Format */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 font-mono">Output MIME Format</label>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs font-bold">
                {(['image/webp', 'image/jpeg', 'image/png'] as const).map((mime) => (
                  <button
                    key={mime}
                    type="button"
                    onClick={() => setTargetMime(mime)}
                    className={`py-2 rounded-xl border transition-all cursor-pointer ${
                      targetMime === mime
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-gray-400 hover:bg-slate-800'
                    }`}
                  >
                    {mime.replace('image/', '').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop Zone File Upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="workshop-aar-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📁 Upload Custom Photo to Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Metrics & Visual Comparison */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-black uppercase text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                <span>📊 Optimization Benchmark Telemetry</span>
              </h2>
              {compressionTimeMs !== null && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-amber-300">
                  ⚡ Processed in {compressionTimeMs}ms
                </span>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800 text-red-200 text-xs font-mono">
                ⚠️ {error}
              </div>
            )}

            {!result && !error && (
              <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                <div className="text-4xl">📸</div>
                <p className="text-xs font-bold text-gray-300 font-mono">No image loaded yet.</p>
                <p className="text-[10px] text-gray-500 font-mono">
                  Upload a photo or click one of the preset synthetic buttons above to benchmark downscaling.
                </p>
              </div>
            )}

            {result && originalFile && (
              <div className="space-y-6">
                {/* 4 Stat Telemetry Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase">Original Size</span>
                    <p className="text-sm font-bold text-white">{formatFileSize(originalFile.size)}</p>
                    <span className="text-[9px] text-gray-500 block truncate">{originalFile.type}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase">WebP Output</span>
                    <p className="text-sm font-bold text-emerald-300">{formatFileSize(result.compressedSize)}</p>
                    <span className="text-[9px] text-emerald-500 block truncate">{result.mimeType}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase">Space Saved</span>
                    <p className="text-sm font-bold text-amber-300">{result.compressionRatioPercent}%</p>
                    <span className="text-[9px] text-gray-400 block truncate">
                      -{formatFileSize(originalFile.size - result.compressedSize)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-sky-400 uppercase">Dimensions</span>
                    <p className="text-sm font-bold text-sky-300">{result.width}×{result.height}</p>
                    <span className="text-[9px] text-gray-500 block truncate">Fit Box: {maxWidth}×{maxHeight}</span>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono font-bold text-gray-400">Original Source Image</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 max-h-52 flex items-center justify-center">
                      <img src={originalFile.url} alt="Original" className="max-h-52 object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono font-bold text-emerald-400">Compressed WebP Canvas</span>
                    <div className="rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950 max-h-52 flex items-center justify-center">
                      <img src={result.dataUrl} alt="Compressed WebP" className="max-h-52 object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Live Embedded AAR Component Sandbox */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-base font-black text-amber-300 font-mono flex items-center gap-2">
              <span>📸 LIVE AFTER-ACTION REPORT COMPONENT TESTBED</span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Live component rendered with simulated session credentials and real-time state injection.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {mockReports.length} Debrief Entries Loaded
          </span>
        </div>

        {/* Render Actual Component */}
        <div className="bg-slate-950 rounded-3xl p-2 border border-slate-800 shadow-2xl">
          <AfterActionReportSection
            operationId="mock-operation-simpson-2026"
            currentUserId="user-joshua"
            reports={mockReports}
            onReportPosted={() => {
              // Append a synthetic new debrief report to state
              const newEntry: AARReportEntry = {
                id: `mock-${Date.now()}`,
                userId: 'user-joshua',
                thankYouText: '[🎁 Received in Person] Test debrief posted from workshop sandbox! 🌟',
                photoUrl: result?.dataUrl || null,
                createdAt: new Date().toISOString(),
                user: {
                  id: 'user-joshua',
                  name: 'Joshua Simpson',
                  codename: 'Agent: Prime',
                },
              };
              setMockReports((prev) => [newEntry, ...prev]);
            }}
          />
        </div>
      </div>
    </div>
  );
}
