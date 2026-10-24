import React from 'react';
import {
  BatteryCharging,
  CheckCircle2,
  Download,
  Feather,
  Github,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { AppSettings } from '../types';
import { isRunningInAndroidApk } from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

const OPEN_SOURCE_ARSENAL = [
  { name: 'Claude-Style Code -> MP4 Sandbox', role: 'Canvas/Manim JS + Hardware H.264 mp4-muxer', status: 'Active' },
  { name: 'Modular Skills + MCP Connectors', role: 'SKILL.md Engine + 8 Live Connectors + Webhooks', status: 'Active' },
  { name: 'Android Phone OS Native Bridge', role: 'Alarms, Timers, WhatsApp, SMS, Calls, Maps, Settings', status: 'Active' },
  { name: 'DeepSeek-R1 + Qwen 2.5 Coder + Llama 3.3', role: 'Zero-Key Cloud LLM Inference (0% Phone Load)', status: 'Active' },
  { name: 'SWivid F5-TTS + Vocal DNA Twin DSP', role: 'Zero-Shot Voice Cloning & 16-bit WAV Export', status: 'Active' },
  { name: 'Black Forest Labs Flux.1 + Wan2.1', role: 'HD Cinema Frames, Wallpapers & Diffusion Video', status: 'Active' },
];

export const ApkAndSettingsHub: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const inApk = isRunningInAndroidApk();

  return (
    <div className="space-y-4 pb-8">
      {/* Android APK Flagship Download Card */}
      <div className="glass-card neon-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg text-white">
                  Open Brain — Official Android APK
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  v2.0 SIGNED
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Package: <code className="text-cyan-300">com.openbrain.ai</code> • Featherlight (~200 KB!) • Zero Phone Pressure
              </p>
            </div>
          </div>

          {inApk ? (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Running Natively Inside Open Brain APK!
            </div>
          ) : (
            <a
              href="./OpenBrain-AI.apk"
              download="OpenBrain-AI.apk"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-600 hover:opacity-95 text-sm font-extrabold text-white shadow-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download OpenBrain-AI.apk
            </a>
          )}
        </div>

        {/* Zero Phone Pressure Architecture Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
              <Feather className="w-4 h-4" /> Zero Phone Pressure (~200 KB)
            </div>
            <p className="text-slate-400">
              All heavy LLM, Flux, and Voice compute runs in free cloud clusters — <b>0 MB model bloat</b> on your phone storage or RAM!
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4" /> 0% Background Battery Drain
            </div>
            <p className="text-slate-400">
              Native <code className="text-slate-200">onPause()</code> timer suspension freezes WebView instantly when screen locks or app switches!
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-violet-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Hardware H.264 MP4 Silicon
            </div>
            <p className="text-slate-400">
              Uses Android hardware <code className="text-slate-200">VideoEncoder</code> + frame yielding so MP4 videos render cool & fast!
            </p>
          </div>
        </div>
      </div>

      {/* Featherlight & Language Settings */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
        <h3 className="font-bold text-sm text-white">Performance, Language & Agent Controls</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Language Style</label>
            <select
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value as any })}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
            >
              <option value="banglish">Banglish + English (Auto)</option>
              <option value="bn">বাংলা (Bengali Script)</option>
              <option value="en">English</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/35 cursor-pointer text-xs text-emerald-200 font-semibold">
            <input
              type="checkbox"
              checked={settings.featherlightEcoMode}
              onChange={(e) =>
                onUpdateSettings({ featherlightEcoMode: e.target.checked })
              }
              className="accent-emerald-500"
            />
            ⚡ Featherlight Zero-Pressure Mode
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
            <input
              type="checkbox"
              checked={settings.autonomousAgent}
              onChange={(e) => onUpdateSettings({ autonomousAgent: e.target.checked })}
              className="accent-violet-500"
            />
            Autonomous Agent Tools
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
            <input
              type="checkbox"
              checked={settings.autoSpeak}
              onChange={(e) => onUpdateSettings({ autoSpeak: e.target.checked })}
              className="accent-cyan-500"
            />
            Auto-Speak Replies
          </label>
        </div>
      </div>

      {/* Integrated Open-Source Stack */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Github className="w-4 h-4 text-violet-400" />
          Open Brain Integrated Free Open-Source Stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPEN_SOURCE_ARSENAL.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-200">{item.name}</div>
                <div className="text-[11px] text-slate-400">{item.role}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                ● {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Free Boosters */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Optional Free Boosters (100% Optional — Runs Unlimited Free Without Any Key!)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Open Brain works completely free out of the box. Optionally add free HuggingFace, Groq, or Gemini keys if desired.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              HuggingFace Free Token (Priority ZeroGPU for F5-TTS & Wan2.1)
            </label>
            <input
              type="password"
              value={settings.hfToken}
              onChange={(e) => onUpdateSettings({ hfToken: e.target.value })}
              placeholder="hf_... (optional)"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Groq Free API Key (Instant Llama 3.3 70B)
            </label>
            <input
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => onUpdateSettings({ groqApiKey: e.target.value })}
              placeholder="gsk_... (optional)"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Google Gemini Free Studio Key (Optional)
            </label>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value })}
              placeholder="AIza... (optional)"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Custom / LAN Ollama Endpoint (Optional)
            </label>
            <input
              type="text"
              value={settings.ollamaUrl}
              onChange={(e) => onUpdateSettings({ ollamaUrl: e.target.value })}
              placeholder="http://192.168.1.10:11434 (optional)"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
