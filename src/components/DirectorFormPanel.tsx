import React from 'react';
import {
  Clapperboard,
  Clock,
  CloudRain,
  Globe,
  Layers,
  Mic,
  Minus,
  Monitor,
  Music,
  Palette,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Subtitles,
  Video,
  Wand2,
} from 'lucide-react';
import { COLOR_SCRIPTS, FPS } from '../engine/colorScripts';
import {
  AspectRatio,
  ColorScriptId,
  QualityPreset,
  StudioFormConfig,
  WeatherType,
  WorldArchetype,
} from '../types/film';

interface DirectorFormPanelProps {
  config: StudioFormConfig;
  onChange: (next: StudioFormConfig) => void;
  onCompilePreview: () => void;
  onRenderMp4: () => void;
  isCompiling: boolean;
  isRendering: boolean;
}

const INSPIRATION_IDEAS: Array<{
  label: string;
  prompt: string;
  dialogue: string;
  aspect: AspectRatio;
  min: number;
  sec: number;
  scriptId: ColorScriptId;
}> = [
  {
    label: 'Rainy Rooftop Samurai',
    prompt:
      'A lone swordsman stands on a rain-drenched neon rooftop watching the midnight train pass below. Lightning flashes across the skyline as he draws his blade in a single breathtaking strike, then stands in quiet resolve.',
    dialogue: 'STILL STANDING',
    aspect: '16:9',
    min: 0,
    sec: 12,
    scriptId: 'indigo',
  },
  {
    label: 'Cyberpunk Vertical Reel',
    prompt:
      'Inside a towering cyberpunk megacity grid at 2:00 AM, a young netrunner leaps across holographic billboards while neon rain streaks upward into the night sky.',
    dialogue: 'SYSTEM AWAKE // 2099',
    aspect: '9:16',
    min: 0,
    sec: 15,
    scriptId: 'cyberpunk',
  },
  {
    label: 'Black Hole Horizon',
    prompt:
      'Deep in interstellar space, an explorer gazes into the glowing accretion ring of a supermassive black hole where time slows down and starlight bends into eternity.',
    dialogue: 'BEYOND THE HORIZON',
    aspect: '16:9',
    min: 0,
    sec: 20,
    scriptId: 'shinkai',
  },
  {
    label: 'Bangla Rain Story',
    prompt:
      'বৃষ্টিভেজা শহরের ছাদে দাঁড়িয়ে এক তরুণ স্বপ্নবাজ আকাশের দিকে তাকিয়ে আছে। ঝড়ের রাত পেরিয়ে নতুন ভোরের আলো ফুটবেই, হাল ছাড়া যাবে না।',
    dialogue: 'নতুন ভোর আসবেই',
    aspect: '9:16',
    min: 0,
    sec: 16,
    scriptId: 'indigo',
  },
  {
    label: 'Crimson Eclipse Duel',
    prompt:
      'Under a blood-red solar eclipse above mountain shrine torii gates, an ancient guardian awakens. Wind whips fallen embers across the stone steps before one decisive slash.',
    dialogue: 'ECLIPSE PROTOCOL',
    aspect: '16:9',
    min: 0,
    sec: 18,
    scriptId: 'eclipse',
  },
  {
    label: 'Ocean Twilight',
    prompt:
      'At twilight along a quiet coastal horizon, comet trails streak across violet clouds reflecting cleanly on calm ocean water while sakura petals drift into the stars.',
    dialogue: 'REMEMBER THIS SKY',
    aspect: '16:9',
    min: 0,
    sec: 24,
    scriptId: 'sakura',
  },
];

const QUICK_DURATIONS: Array<{ label: string; min: number; sec: number }> = [
  { label: '8s', min: 0, sec: 8 },
  { label: '12s', min: 0, sec: 12 },
  { label: '20s', min: 0, sec: 20 },
  { label: '30s', min: 0, sec: 30 },
  { label: '45s', min: 0, sec: 45 },
  { label: '1m 00s', min: 1, sec: 0 },
  { label: '1m 30s', min: 1, sec: 30 },
  { label: '2m 00s', min: 2, sec: 0 },
  { label: '3m 00s', min: 3, sec: 0 },
];

export const DirectorFormPanel: React.FC<DirectorFormPanelProps> = ({
  config,
  onChange,
  onCompilePreview,
  onRenderMp4,
  isCompiling,
  isRendering,
}) => {
  const totalSeconds = Math.max(
    4,
    Math.min(600, Math.floor(config.minutes) * 60 + Math.floor(config.seconds))
  );
  const totalFrames = totalSeconds * FPS;

  const update = <K extends keyof StudioFormConfig>(
    key: K,
    val: StudioFormConfig[K]
  ) => {
    onChange({ ...config, [key]: val });
  };

  const adjustMinutes = (delta: number) => {
    const nextMin = Math.max(0, Math.min(10, config.minutes + delta));
    const nextSec = nextMin === 0 && config.seconds < 4 ? 4 : config.seconds;
    onChange({ ...config, minutes: nextMin, seconds: nextSec });
  };

  const adjustSeconds = (delta: number) => {
    let total = config.minutes * 60 + config.seconds + delta;
    total = Math.max(4, Math.min(600, total));
    onChange({
      ...config,
      minutes: Math.floor(total / 60),
      seconds: total % 60,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4 shadow-xl backdrop-blur-md sm:p-5">
      {/* Section 1: Topic / Idea / Detailed Script */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
            <Clapperboard className="h-4 w-4 text-indigo-400" />
            <span>1. Topic, Idea, or Detailed Story Script</span>
          </label>
          <span className="text-[11px] text-slate-400">
            Any language · Unlimited length
          </span>
        </div>

        <textarea
          rows={4}
          value={config.prompt}
          onChange={(e) => update('prompt', e.target.value)}
          placeholder="Enter a short topic (e.g. 'Cyberpunk samurai in neon rain'), an idea, or paste a full multi-scene script in English, Bangla, Banglish, or Hindi..."
          className="w-full rounded-xl border border-slate-700/80 bg-slate-950/90 px-3.5 py-3 text-sm leading-relaxed text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />

        {/* Quick Inspiration Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-slate-400">
            Quick Ideas:
          </span>
          {INSPIRATION_IDEAS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  prompt: item.prompt,
                  dialogue: item.dialogue,
                  aspect: item.aspect,
                  minutes: item.min,
                  seconds: item.sec,
                  scriptId: item.scriptId,
                })
              }
              className="rounded-lg border border-slate-700/70 bg-slate-800/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-indigo-500/50 hover:bg-indigo-500/15 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Optional Verbatim Closing Line */}
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-semibold text-slate-400">
            Closing Title / Final Line (Optional — rendered verbatim on final shot)
          </label>
          <input
            type="text"
            value={config.dialogue}
            onChange={(e) => update('dialogue', e.target.value)}
            placeholder="e.g. STILL HERE, CHAPTER ONE, নতুন ভোর..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/75 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Section 2: Orientation & Resolution */}
      <div className="border-t border-slate-800/80 pt-4">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
            <Monitor className="h-4 w-4 text-indigo-400" />
            <span>2. Orientation &amp; Resolution</span>
          </label>
          <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-950 p-0.5">
            {(['720p', '1080p'] as QualityPreset[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => update('quality', q)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  config.quality === q
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {q === '720p' ? '720p Fast' : '1080p FHD'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              id: '16:9' as AspectRatio,
              title: 'Landscape',
              sub: '16:9 Widescreen',
              Icon: RectangleHorizontal,
            },
            {
              id: '9:16' as AspectRatio,
              title: 'Vertical',
              sub: '9:16 Reels / Shorts',
              Icon: RectangleVertical,
            },
            {
              id: '1:1' as AspectRatio,
              title: 'Square',
              sub: '1:1 Social Post',
              Icon: Square,
            },
          ].map(({ id, title, sub, Icon }) => {
            const active = config.aspect === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => update('aspect', id)}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-inner shadow-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`mb-1.5 h-5 w-5 ${
                    active ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold">{title}</span>
                <span className="mt-0.5 text-[10px] opacity-80">{sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Custom Duration (Minutes + Seconds) */}
      <div className="border-t border-slate-800/80 pt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span>3. Custom Video Duration (Min &amp; Sec)</span>
          </label>
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
            {totalSeconds}s total · {totalFrames.toLocaleString()} frames @ 24fps
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Minutes Stepper */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">
              Minutes (0 – 10 min)
            </span>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => adjustMinutes(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                aria-label="Decrease minutes"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={0}
                max={10}
                value={config.minutes}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                  update('minutes', v);
                }}
                className="w-16 bg-transparent text-center text-base font-bold text-white outline-none"
              />
              <button
                type="button"
                onClick={() => adjustMinutes(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                aria-label="Increase minutes"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Seconds Stepper */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">
              Seconds (0 – 59 sec)
            </span>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => adjustSeconds(-2)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                aria-label="Decrease seconds"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={0}
                max={59}
                value={config.seconds}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                  update('seconds', v);
                }}
                className="w-16 bg-transparent text-center text-base font-bold text-white outline-none"
              />
              <button
                type="button"
                onClick={() => adjustSeconds(2)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                aria-label="Increase seconds"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Duration Pills */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_DURATIONS.map((qd) => {
            const isSel = config.minutes === qd.min && config.seconds === qd.sec;
            return (
              <button
                key={qd.label}
                type="button"
                onClick={() =>
                  onChange({ ...config, minutes: qd.min, seconds: qd.sec })
                }
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  isSel
                    ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {qd.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Closed 10-Hex Anime Color Script & World */}
      <div className="border-t border-slate-800/80 pt-4">
        <label className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
          <Palette className="h-4 w-4 text-indigo-400" />
          <span>4. Closed 10-Hex Anime Color Script</span>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          {(Object.keys(COLOR_SCRIPTS) as ColorScriptId[]).map((id) => {
            const cs = COLOR_SCRIPTS[id];
            const active = config.scriptId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => update('scriptId', id)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/15 text-white'
                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="flex shrink-0 -space-x-1">
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ backgroundColor: cs.colors.sky }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ backgroundColor: cs.colors.accent }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ backgroundColor: cs.colors.moon }}
                  />
                </span>
                <span className="truncate">{cs.name}</span>
              </button>
            );
          })}
        </div>

        {/* World & Weather Selectors */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <Globe className="h-3 w-3 text-indigo-400" />
              <span>World Backdrop</span>
            </label>
            <select
              value={config.world}
              onChange={(e) => update('world', e.target.value as WorldArchetype)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="auto">Auto Detect from Idea</option>
              <option value="rooftop_city">Tokyo Rooftop &amp; Skyline</option>
              <option value="shrine_mountains">Mountain Shrine &amp; Torii</option>
              <option value="cosmos_nebula">Deep Space &amp; Black Hole</option>
              <option value="ocean_horizon">Twilight Ocean Horizon</option>
              <option value="cyber_arena">Cyberpunk Neon Grid</option>
            </select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <CloudRain className="h-3 w-3 text-indigo-400" />
              <span>Weather Particle Layer</span>
            </label>
            <select
              value={config.weather}
              onChange={(e) => update('weather', e.target.value as WeatherType)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="auto">Auto Match Palette</option>
              <option value="rain">24fps Anime Rain Streaks</option>
              <option value="petals">Drifting Sakura Petals</option>
              <option value="embers">Glowing Fireflies / Embers</option>
              <option value="snow">Soft Winter Snowfall</option>
              <option value="stardust">Starlight Shimmer</option>
              <option value="clear">Clear Sky (No Particles)</option>
            </select>
          </div>
        </div>

        {/* Toggle Switches */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            {
              key: 'showSubtitles' as const,
              label: 'Burned-In Subtitles',
              Icon: Subtitles,
            },
            {
              key: 'letterbox' as const,
              label: 'Cinema Letterbox',
              Icon: Layers,
            },
            {
              key: 'includeScore' as const,
              label: 'Cinema Score & SFX',
              Icon: Music,
            },
            {
              key: 'includeVoiceover' as const,
              label: 'AI Voiceover',
              Icon: Mic,
            },
          ].map(({ key, label, Icon }) => {
            const active = config[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => update(key, !active)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  active
                    ? 'border-indigo-500/45 bg-indigo-500/15 text-indigo-100'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      active ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    active ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons: Instant Storyboard Compile + Direct MP4 Render */}
      <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-4 sm:flex-row">
        <button
          type="button"
          disabled={isCompiling || isRendering}
          onClick={onCompilePreview}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-xs font-bold text-slate-100 transition hover:border-indigo-500/60 hover:bg-slate-800 disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4 text-indigo-400" />
          <span>{isCompiling ? 'Compiling Shots...' : 'Preview Storyboard'}</span>
        </button>

        <button
          type="button"
          disabled={isRendering || !config.prompt.trim()}
          onClick={onRenderMp4}
          className="inline-flex flex-[1.45] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/60 transition hover:brightness-110 disabled:opacity-50"
        >
          <Video className="h-4 w-4" />
          <span>
            {isRendering
              ? 'Rendering .MP4...'
              : `Render & Download .MP4 (${totalSeconds}s)`}
          </span>
        </button>
      </div>
    </div>
  );
};
