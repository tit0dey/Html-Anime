import React from 'react';
import { Download, Film, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { isAndroidApk, showToast } from '../engine/nativeBridge';

interface HeaderBarProps {
  vaultCount: number;
  onOpenVault: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ vaultCount, onOpenVault }) => {
  const isAndroid = isAndroidApk();

  const handleDownloadApk = () => {
    if (isAndroid) {
      showToast('You are already running the native Android Studio app.');
      return;
    }
    const a = document.createElement('a');
    a.href = '/api/download-apk';
    a.download = 'HTML-Anime-Studio.apk';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 800);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060913]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-indigo-400/40 bg-white shadow-lg shadow-indigo-950/50">
            <img
              src="./logo.png"
              alt="HTML-Anime Studio"
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                HTML-Anime Studio
              </h1>
              <span className="hidden items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 sm:inline-flex">
                <Sparkles className="h-3 w-3" />
                24fps MP4 Engine
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              100% Free &amp; Unlimited · Zero API Keys · Idea to Downloadable .MP4
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 lg:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Zero Lag · Local H.264</span>
          </div>

          <button
            type="button"
            onClick={onOpenVault}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-800/90"
          >
            <Film className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden sm:inline">MP4 Vault</span>
            <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[11px] font-bold text-indigo-300">
              {vaultCount}
            </span>
          </button>

          {isAndroid ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-200">
              <Smartphone className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Android Native</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDownloadApk}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-950/50 transition hover:from-indigo-500 hover:to-violet-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Android APK</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
