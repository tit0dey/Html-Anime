import React, { useState } from 'react';
import {
  AudioWaveform,
  Blocks,
  Check,
  ChevronRight,
  Download,
  Feather,
  Globe,
  Info,
  KeyRound,
  Smartphone,
  SunMoon,
  Trash2,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { AppearanceMode, AppSettings } from '../types';
import { isRunningInAndroidApk } from '../services/nativeBridge';
import { OpenBrainLogo } from './OpenBrainLogo';

interface Props {
  open: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onOpenSkillsModal: () => void;
  onOpenVoiceModal: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export const ProfileSettingsSheet: React.FC<Props> = ({
  open,
  settings,
  onUpdateSettings,
  onOpenSkillsModal,
  onOpenVoiceModal,
  onClearHistory,
  onClose,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState(settings.userName);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showBoosters, setShowBoosters] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  if (!open) return null;

  const inApk = isRunningInAndroidApk();

  const cycleAppearance = (mode: AppearanceMode) => {
    onUpdateSettings({ appearance: mode });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-5">
        {/* Top Close */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#161B24] shadow-sm flex items-center justify-center text-slate-800 dark:text-slate-200"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white dark:bg-[#161B24] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800">
            Free & Unlimited Edition
          </span>
        </div>

        {/* User Avatar & Name Header (Zero Paywall / Zero Upgrade Banner) */}
        <div className="flex flex-col items-center text-center pt-1 pb-2">
          <div className="w-20 h-20 rounded-full bg-white dark:bg-[#161B24] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center mb-3">
            <OpenBrainLogo className="w-12 h-12 text-slate-900 dark:text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">
            {settings.userName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Open Brain v3.0 · Smart Multi-Agent · Zero Phone Load
          </p>
        </div>

        {/* Intelligence & Capabilities */}
        <div className="space-y-1.5">
          <div className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Capabilities
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#141821] divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSkillsModal();
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                <Blocks className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                Skills & MCP Connectors
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenVoiceModal();
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                <AudioWaveform className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                Voice Clone Profiles
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* General */}
        <div className="space-y-1.5">
          <div className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            General
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#141821] divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
            {/* Profile Name */}
            <div className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setNameDraft(settings.userName);
                  setEditingProfile((v) => !v);
                }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <User className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  Profile
                </span>
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  {settings.userName}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </span>
              </button>
              {editingProfile && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Your display name"
                    className="flex-1 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (nameDraft.trim()) {
                        onUpdateSettings({ userName: nameDraft.trim() });
                      }
                      setEditingProfile(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Appearance */}
            <div className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => setShowAppearance((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <SunMoon className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  Appearance
                </span>
                <span className="flex items-center gap-1 text-sm text-slate-500 capitalize">
                  {settings.appearance}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </span>
              </button>
              {showAppearance && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as AppearanceMode[]).map((m) => {
                    const active = settings.appearance === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => cycleAppearance(m)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize flex items-center justify-center gap-1.5 border ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'
                            : 'bg-[#F5F6F8] dark:bg-[#0E121A] text-slate-600 dark:text-slate-300 border-transparent'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Language Reply Preference */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                <Globe className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                Reply Language
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    responseLanguage: settings.responseLanguage === 'auto' ? 'en' : 'auto',
                  })
                }
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F5F6F8] dark:bg-[#1E2430] text-slate-700 dark:text-slate-200"
              >
                {settings.responseLanguage === 'auto' ? 'Match My Input' : 'English Default'}
              </button>
            </div>

            {/* Featherlight Eco Mode */}
            <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                <Feather className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                Featherlight Zero-Lag Mode
              </span>
              <input
                type="checkbox"
                checked={settings.featherlightEcoMode}
                onChange={(e) =>
                  onUpdateSettings({ featherlightEcoMode: e.target.checked })
                }
                className="w-4 h-4 accent-slate-900 dark:accent-teal-400"
              />
            </label>

            {/* Auto-Speak */}
            <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                <Volume2 className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                Auto-Speak Replies
              </span>
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => onUpdateSettings({ autoSpeak: e.target.checked })}
                className="w-4 h-4 accent-slate-900 dark:accent-teal-400"
              />
            </label>
          </div>
        </div>

        {/* Device, APK & Optional Boosters */}
        <div className="space-y-1.5">
          <div className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            About Open Brain
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#141821] divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
            {inApk ? (
              <div className="px-4 py-3.5 flex items-center justify-between">
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <Smartphone className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  Android OS Bridge
                </span>
                <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                  Active (v3.0)
                </span>
              </div>
            ) : (
              <a
                href="./OpenBrain-AI.apk"
                download="OpenBrain-AI.apk"
                className="w-full px-4 py-3.5 flex items-center justify-between"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <Download className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  Download Android APK
                </span>
                <span className="text-xs font-semibold text-slate-500">~195 KB</span>
              </a>
            )}

            <div className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => setShowBoosters((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <KeyRound className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  Optional API Boosters
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              {showBoosters && (
                <div className="mt-3 space-y-2.5 text-xs">
                  <p className="text-slate-500 dark:text-slate-400">
                    100% optional — Open Brain runs completely free and unlimited without any keys.
                  </p>
                  <input
                    type="password"
                    value={settings.hfToken}
                    onChange={(e) => onUpdateSettings({ hfToken: e.target.value })}
                    placeholder="HuggingFace Token hf_... (optional)"
                    className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    value={settings.groqApiKey}
                    onChange={(e) => onUpdateSettings({ groqApiKey: e.target.value })}
                    placeholder="Groq Free Key gsk_... (optional)"
                    className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value })}
                    placeholder="Gemini Studio Key AIza... (optional)"
                    className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => setShowAbout((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-slate-900 dark:text-white">
                  <Info className="w-5 h-5 text-slate-700 dark:text-slate-300 stroke-[1.75]" />
                  About Open Brain
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              {showAbout && (
                <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Open Brain v3.0 combines Smart Multi-Model Routing, Parallel Mixture-of-Agents Council synthesis (DeepSeek-R1 + Qwen 2.5 Coder 32B + Llama 3.3 70B + Omni-4o Vision), Hardware H.264 MP4 Sandbox Video, Zero-Shot Voice Cloning, Flux.1 HD Art, Modular SKILL.md Skills, Live MCP Connectors, and Native Android Phone OS Control with zero phone RAM or battery bloat.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClearHistory();
                onClose();
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left text-red-600 dark:text-red-400"
            >
              <span className="flex items-center gap-3 text-[15px] font-medium">
                <Trash2 className="w-5 h-5 stroke-[1.75]" />
                Clear Conversation History
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
