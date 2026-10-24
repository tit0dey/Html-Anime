import React, { useState } from 'react';
import {
  Clapperboard,
  Code2,
  Download,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { AppSettings, VideoEngineType, VideoGenerationItem } from '../types';
import { generateOpenBrainVideo } from '../services/videoEngine';
import { generateFreeLLMResponse } from '../services/llmEngine';
import { saveFileCrossPlatform, triggerHaptic } from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
}

const VIDEO_PRESETS = [
  'Manim-style animated proof of Pythagorean theorem a² + b² = c² with glowing geometric squares and formulas',
  'Solar system planets orbiting a blazing golden Sun with orbital rings, velocities, and sci-fi HUD telemetry',
  'Cyberpunk Kolkata street in monsoon rain at night, yellow taxis with neon reflections and futuristic trams',
];

export const VideoStudio: React.FC<Props> = ({ settings }) => {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<VideoEngineType>('claude-code-mp4');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('16:9');
  const [sceneCount, setSceneCount] = useState<number>(3);
  const [narratorVoice, setNarratorVoice] = useState<'onyx' | 'nova' | 'alloy' | 'echo'>('onyx');
  const [enhancing, setEnhancing] = useState(false);
  const [videos, setVideos] = useState<VideoGenerationItem[]>([]);
  const [activeJob, setActiveJob] = useState<VideoGenerationItem | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editedCodeDraft, setEditedCodeDraft] = useState<string>('');

  const enhancePrompt = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const enhanced = await generateFreeLLMResponse(
        [
          {
            role: 'system',
            content:
              'Rewrite the user video idea into a vivid, detailed 2-sentence animation/cinema prompt with motion, color palette, and visual clarity. Return ONLY the improved prompt.',
          },
          { role: 'user', content: prompt },
        ],
        settings,
        'openai'
      );
      if (enhanced) setPrompt(enhanced.replace(/^["']|["']$/g, '').trim());
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerateVideo = async (overrideCustomCode?: string, basePrompt?: string) => {
    const cleanPrompt = (basePrompt ?? prompt).trim();
    if (!cleanPrompt || activeJob) return;
    triggerHaptic(20);

    const jobId = `vid-${Date.now()}`;
    const initial: VideoGenerationItem = {
      id: jobId,
      prompt: cleanPrompt,
      engine: overrideCustomCode ? 'claude-code-mp4' : engine,
      aspectRatio,
      durationSec: sceneCount * 3,
      status: 'generating',
      progress: 5,
      statusMessage: 'Starting Open Brain Hardware MP4 Pipeline...',
      createdAt: Date.now(),
    };
    setActiveJob(initial);

    try {
      const out = await generateOpenBrainVideo({
        prompt: cleanPrompt,
        engine: overrideCustomCode ? 'claude-code-mp4' : engine,
        aspectRatio,
        sceneCount,
        voice: narratorVoice,
        customCode: overrideCustomCode,
        settings,
        onProgress: (pct, msg) => {
          setActiveJob((prev) =>
            prev ? { ...prev, progress: pct, statusMessage: msg } : prev
          );
        },
      });

      const finished: VideoGenerationItem = {
        ...initial,
        status: 'ready',
        progress: 100,
        statusMessage: 'Ready to Watch & Download (.mp4)!',
        videoUrl: out.videoUrl,
        mimeType: out.mimeType,
        thumbnailUrl: out.thumbnailUrl,
        generatedCode: out.generatedCode,
        scenes: out.scenes,
        spaceUsed: out.spaceUsed,
      };
      setVideos((prev) => [finished, ...prev]);
      setActiveJob(null);
      setEditingCodeId(null);
    } catch (err: any) {
      setActiveJob(null);
      alert(`Video generation error: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="glass-card rounded-2xl p-4 border border-violet-500/25">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 flex items-center justify-center shadow">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Open Brain MP4 Video Studio
              </h2>
              <p className="text-xs text-slate-400">
                Claude-Style Code Sandbox MP4 • Flux HD Cinema • Wan2.1 ZeroGPU
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            REAL .MP4 • ZERO LAG
          </span>
        </div>

        {/* 3 Video Engines */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setEngine('claude-code-mp4')}
            className={`text-left p-3 rounded-xl border transition ${
              engine === 'claude-code-mp4'
                ? 'bg-fuchsia-600/20 border-fuchsia-500 text-white'
                : 'bg-slate-900/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1 text-fuchsia-200">
                <Code2 className="w-3.5 h-3.5 text-fuchsia-400" />
                Code → Sandbox MP4
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/25 text-fuchsia-200 font-bold">
                CLAUDE STYLE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Writes Manim/Canvas JS code, renders in sandbox & muxes hardware H.264 `.mp4` in ~2s!
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEngine('cinema-director')}
            className={`text-left p-3 rounded-xl border transition ${
              engine === 'cinema-director'
                ? 'bg-violet-600/20 border-violet-500 text-white'
                : 'bg-slate-900/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1 text-violet-200">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Flux Cinema + Voice MP4
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                PHOTOREAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Multi-shot Flux-Realism scenes + AI Voiceover + Subtitles → Hardware `.mp4`!
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEngine('hf-wan-diffusion')}
            className={`text-left p-3 rounded-xl border transition ${
              engine === 'hf-wan-diffusion'
                ? 'bg-cyan-600/20 border-cyan-500 text-white'
                : 'bg-slate-900/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1 text-cyan-200">
                <Film className="w-3.5 h-3.5 text-cyan-400" />
                Wan2.1 / LTX Diffusion
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                HF GPU
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Live HuggingFace ZeroGPU diffusion nodes with automatic Cinema `.mp4` fallback!
            </p>
          </button>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe any explainer animation, Manim math visual, kinetic reel, or cinematic story..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-violet-500 p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {VIDEO_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(preset)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 truncate max-w-[240px]"
              >
                ✨ {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value="16:9">🖥️ 16:9 Widescreen MP4</option>
              <option value="9:16">📱 9:16 Reels / Shorts MP4</option>
              <option value="1:1">⬛ 1:1 Square MP4</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Duration / Phases</label>
            <select
              value={sceneCount}
              onChange={(e) => setSceneCount(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value={2}>Fast (~6–8s MP4)</option>
              <option value={3}>Standard (~9–12s MP4)</option>
              <option value={4}>Extended (~12–16s MP4)</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] text-slate-400 mb-1">AI Narrator Voice</label>
            <select
              value={narratorVoice}
              onChange={(e) => setNarratorVoice(e.target.value as any)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value="onyx">🎙️ Onyx (Deep Cinema)</option>
              <option value="nova">🎙️ Nova (Clear Female)</option>
              <option value="alloy">🎙️ Alloy (Studio Neutral)</option>
              <option value="echo">🎙️ Echo (Warm Narrator)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            disabled={!prompt.trim() || Boolean(activeJob) || enhancing}
            onClick={enhancePrompt}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-violet-300 flex items-center gap-1.5 disabled:opacity-40"
          >
            {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Enhance
          </button>

          <button
            type="button"
            disabled={!prompt.trim() || Boolean(activeJob)}
            onClick={() => handleGenerateVideo()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 hover:opacity-95 disabled:opacity-40 text-sm font-bold text-white shadow flex items-center justify-center gap-2"
          >
            {activeJob ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering MP4 ({activeJob.progress}%)...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Render Free .MP4 Video
              </>
            )}
          </button>
        </div>

        {activeJob && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-violet-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-violet-200 font-medium">{activeJob.statusMessage}</span>
              <span className="font-mono text-cyan-300">{activeJob.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rendered Videos List */}
      {videos.length > 0 && (
        <div className="space-y-4">
          {videos.map((vid) => {
            const ext = vid.mimeType?.includes('webm') ? 'webm' : 'mp4';
            const isEditing = editingCodeId === vid.id;
            return (
              <div
                key={vid.id}
                className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 fill-cyan-400" />
                      {vid.spaceUsed || 'Open Brain MP4 Engine'}
                    </span>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{vid.prompt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {vid.generatedCode && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingCodeId(null);
                          } else {
                            setEditingCodeId(vid.id);
                            setEditedCodeDraft(vid.generatedCode || '');
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        {isEditing ? 'Close Code' : 'Inspect / Edit Code'}
                      </button>
                    )}

                    {vid.videoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          saveFileCrossPlatform(
                            vid.videoUrl!,
                            `OpenBrain-${vid.id}.${ext}`,
                            vid.mimeType || 'video/mp4'
                          )
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow"
                      >
                        <Download className="w-4 h-4" /> Save .{ext}
                      </button>
                    )}
                  </div>
                </div>

                {vid.videoUrl && (
                  <div className="rounded-xl overflow-hidden bg-black border border-slate-800 flex justify-center">
                    <video
                      src={vid.videoUrl}
                      controls
                      playsInline
                      autoPlay
                      loop
                      className={
                        vid.aspectRatio === '9:16'
                          ? 'max-h-[450px] w-auto'
                          : 'w-full max-h-[420px]'
                      }
                    />
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-fuchsia-300">
                      Live Sandbox Animation Code (`ctx, t, duration, W, H, Math`) — Edit & Re-Render MP4:
                    </div>
                    <textarea
                      value={editedCodeDraft}
                      onChange={(e) => setEditedCodeDraft(e.target.value)}
                      rows={9}
                      className="w-full rounded-xl bg-[#05070D] border border-slate-700 p-3 text-xs font-mono text-emerald-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={Boolean(activeJob)}
                      onClick={() => handleGenerateVideo(editedCodeDraft, vid.prompt)}
                      className="px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-Render Custom Code to .MP4
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
