import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  FileText,
  Film,
  Flame,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react';
import { getShotAtFrame, renderAnimeFilmFrame } from '../engine/celRenderer';
import { LiveStageAudioPlayer } from '../engine/liveAudioPreview';
import { RenderProgressInfo } from '../engine/mp4Exporter';
import { downloadBlobCrossPlatform } from '../engine/nativeBridge';
import {
  CompiledFilmProject,
  ConcreteWeather,
  ConcreteWorld,
  FilmShot,
  RenderedVideoVaultItem,
  ShotKind,
} from '../types/film';

interface StageAndVaultPanelProps {
  project: CompiledFilmProject;
  onUpdateProjectShots: (shots: FilmShot[]) => void;
  isRendering: boolean;
  renderProgress: RenderProgressInfo | null;
  onCancelRender: () => void;
  onTriggerRenderMp4: () => void;
  latestVideo: RenderedVideoVaultItem | null;
  vault: RenderedVideoVaultItem[];
  onSelectVaultVideo: (item: RenderedVideoVaultItem) => void;
  onDeleteVaultVideo: (id: string) => void;
  activeTab: 'shots' | 'sheet' | 'vault';
  onTabChange: (tab: 'shots' | 'sheet' | 'vault') => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StageAndVaultPanel: React.FC<StageAndVaultPanelProps> = ({
  project,
  onUpdateProjectShots,
  isRendering,
  renderProgress,
  onCancelRender,
  onTriggerRenderMp4,
  latestVideo,
  vault,
  onSelectVaultVideo,
  onDeleteVaultVideo,
  activeTab,
  onTabChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioPlayerRef = useRef<LiveStageAudioPlayer>(new LiveStageAudioPlayer());
  const rafRef = useRef<number | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    audioPlayerRef.current.stop();
    setCurrentFrame(0);
  }, [project.id]);

  useEffect(() => {
    if (isRendering && isPlaying) {
      setIsPlaying(false);
      audioPlayerRef.current.stop();
    }
  }, [isRendering, isPlaying]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioPlayerRef.current.stop();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== project.width || canvas.height !== project.height) {
      canvas.width = project.width;
      canvas.height = project.height;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    renderAnimeFilmFrame(ctx, project, currentFrame);
  }, [project, currentFrame]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const startPerf = performance.now();
    const initialFrame =
      currentFrame >= project.totalFrames - 1 ? 0 : currentFrame;
    audioPlayerRef.current.start(project, initialFrame / project.fps);

    const tick = (now: number) => {
      const elapsedSec = (now - startPerf) / 1000;
      const nextFrame = initialFrame + Math.floor(elapsedSec * project.fps);
      if (nextFrame >= project.totalFrames - 1) {
        setCurrentFrame(project.totalFrames - 1);
        setIsPlaying(false);
        audioPlayerRef.current.stop();
        return;
      }
      setCurrentFrame(nextFrame);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, project]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioPlayerRef.current.stop();
    } else {
      if (currentFrame >= project.totalFrames - 1) {
        setCurrentFrame(0);
      }
      setIsPlaying(true);
    }
  };

  const handleScrub = (nextFrame: number) => {
    if (isPlaying) {
      setIsPlaying(false);
      audioPlayerRef.current.stop();
    }
    setCurrentFrame(nextFrame);
  };

  const handleSaveStillPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const safeName = project.slug.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 28);
      await downloadBlobCrossPlatform(
        blob,
        `${safeName || 'anime'}_frame_${currentFrame}.png`,
        'image/png'
      );
    }, 'image/png');
  };

  const handleDownloadMp4 = async (item: RenderedVideoVaultItem) => {
    const safeTitle = item.slug.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 34);
    const ext = item.mimeType.includes('webm') ? 'webm' : 'mp4';
    const fileName = `${safeTitle || 'HTML_Anime_Film'}_${item.aspect.replace(
      ':',
      'x'
    )}_${item.durationSec}s.${ext}`;
    await downloadBlobCrossPlatform(item.blob, fileName, item.mimeType);
  };

  const handleCopyShotSheet = async () => {
    try {
      await navigator.clipboard.writeText(project.shotSheetMarkdown);
      setCopiedSheet(true);
      setTimeout(() => setCopiedSheet(false), 1800);
    } catch {
      // Ignore
    }
  };

  const activeShot = getShotAtFrame(project, currentFrame);

  const updateShotField = <K extends keyof FilmShot>(
    shotId: string,
    field: K,
    value: FilmShot[K]
  ) => {
    const updated = project.shots.map((s) =>
      s.id === shotId ? { ...s, [field]: value } : s
    );
    onUpdateProjectShots(updated);
  };

  const isPortrait = project.aspect === '9:16';
  const isSquare = project.aspect === '1:1';

  return (
    <div className="space-y-4">
      {/* Live 24fps Interactive Anime Stage Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/75 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/75 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            <span className="truncate text-xs font-bold text-white">
              {project.title}
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
              {project.width}×{project.height} · 24fps
            </span>
            <span className="hidden rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 sm:inline-block">
              Shot {activeShot.index + 1}/{project.shots.length}
              {activeShot.sakuga ? ' · SAKUGA' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveStillPng}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-indigo-500/50 hover:text-white"
              title="Export current cel frame as PNG"
            >
              <Camera className="h-3.5 w-3.5 text-indigo-400" />
              <span>Save Cel PNG</span>
            </button>

            <button
              type="button"
              disabled={isRendering}
              onClick={onTriggerRenderMp4}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Video className="h-3.5 w-3.5" />
              <span>Export .MP4</span>
            </button>
          </div>
        </div>

        {/* Theater Canvas Viewport */}
        <div className="relative flex items-center justify-center bg-[#04060d] p-3 sm:p-4">
          <div
            className={`relative overflow-hidden rounded-xl border border-slate-800/90 shadow-2xl ${
              isPortrait
                ? 'aspect-[9/16] w-full max-w-[295px]'
                : isSquare
                ? 'aspect-square w-full max-w-[430px]'
                : 'aspect-video w-full'
            }`}
          >
            <canvas
              ref={canvasRef}
              onClick={togglePlay}
              className="h-full w-full cursor-pointer object-contain"
            />

            {!isPlaying && !isRendering && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play interactive 24fps anime preview"
                className="group absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/10"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-slate-950/80 text-white shadow-xl backdrop-blur-md transition group-hover:scale-105 group-hover:border-indigo-400">
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Transport & Frame Scrubber Bar */}
        <div className="border-t border-slate-800/80 bg-slate-950/85 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isRendering}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-50"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleScrub(0)}
              disabled={isRendering}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
              aria-label="Restart"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={Math.max(1, project.totalFrames - 1)}
                value={currentFrame}
                onChange={(e) => handleScrub(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
              <div className="mt-0.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>
                  {formatTime(currentFrame / project.fps)} /{' '}
                  {formatTime(project.totalSeconds)}
                </span>
                <span>
                  Frame {currentFrame + 1} / {project.totalFrames}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {project.shots.map((s) => {
              const isCurr = activeShot.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScrub(s.startFrame)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    isCurr
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  S{s.index + 1} ({s.durationSec}s){s.sakuga ? ' · Sakuga' : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Hardware MP4 Render Progress Card */}
      {isRendering && renderProgress && (
        <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/35 p-4 shadow-lg backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Rendering On-Device .MP4 Video ({renderProgress.pct}%)
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelRender}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-150"
              style={{ width: `${Math.max(3, renderProgress.pct)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
            <span className="truncate">{renderProgress.statusText}</span>
            <span className="shrink-0 font-semibold text-indigo-300">
              ETA ~{renderProgress.etaSec}s
            </span>
          </div>
        </div>
      )}

      {/* Ready-to-Download MP4 Card */}
      {latestVideo && !isRendering && (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/35 via-slate-900/90 to-slate-950 p-4 shadow-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  MP4 Video Ready to Download
                </h3>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {formatBytes(latestVideo.sizeBytes)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {latestVideo.title} · {latestVideo.width}×{latestVideo.height} ·{' '}
                {latestVideo.durationSec}s @ 24fps
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadMp4(latestVideo)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/60 transition hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              <span>Download .MP4 Now</span>
            </button>
          </div>

          <div className="flex justify-center rounded-xl border border-slate-800 bg-black/80 p-2">
            <video
              key={latestVideo.videoUrl}
              src={latestVideo.videoUrl}
              controls
              playsInline
              className={`rounded-lg ${
                latestVideo.aspect === '9:16'
                  ? 'max-h-[360px] w-auto'
                  : 'max-h-[340px] w-full'
              }`}
            />
          </div>
        </div>
      )}

      {/* Storyboard / Director Shot-Sheet / MP4 Vault Tabs */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => onTabChange('shots')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'shots'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Editable Storyboard ({project.shots.length} Shots)</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('sheet')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'sheet'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Director Shot Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('vault')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'vault'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Rendered MP4 Vault ({vault.length})</span>
          </button>
        </div>

        {activeTab === 'shots' && (
          <div className="max-h-[410px] space-y-2.5 overflow-y-auto pr-1">
            {project.shots.map((shot) => {
              const isCurr = activeShot.id === shot.id;
              const frameCount = shot.endFrame - shot.startFrame;
              return (
                <div
                  key={shot.id}
                  onClick={() => handleScrub(shot.startFrame)}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    isCurr
                      ? 'border-indigo-500/70 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                        Shot {shot.index + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        {shot.startSec.toFixed(1)}s – {shot.endSec.toFixed(1)}s (
                        {shot.durationSec}s · {frameCount}f)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateShotField(shot.id, 'sakuga', !shot.sakuga);
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition ${
                        shot.sakuga
                          ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Flame className="h-3 w-3" />
                      <span>{shot.sakuga ? 'Sakuga Climax ON' : 'Set Sakuga'}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={shot.caption}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateShotField(shot.id, 'caption', e.target.value)
                    }
                    placeholder="Shot subtitle or narration..."
                    className="mb-2 w-full rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                  />

                  <div
                    className="grid grid-cols-3 gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={shot.kind}
                      onChange={(e) =>
                        updateShotField(
                          shot.id,
                          'kind',
                          e.target.value as ShotKind
                        )
                      }
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none"
                    >
                      <option value="establish">Wide Establish</option>
                      <option value="approach">Medium Approach</option>
                      <option value="turn">Anticipation Turn</option>
                      <option value="close_eyes">Close-Up Gaze</option>
                      <option value="sakuga">Sakuga Action</option>
                      <option value="panoramic">Horizon Vista</option>
                      <option value="aftermath">Aftermath Hold</option>
                      <option value="button">Button &amp; Resolve</option>
                    </select>

                    <select
                      value={shot.world}
                      onChange={(e) =>
                        updateShotField(
                          shot.id,
                          'world',
                          e.target.value as ConcreteWorld
                        )
                      }
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none"
                    >
                      <option value="rooftop_city">Rooftop City</option>
                      <option value="shrine_mountains">Mountain Shrine</option>
                      <option value="cosmos_nebula">Cosmos / Black Hole</option>
                      <option value="ocean_horizon">Ocean Horizon</option>
                      <option value="cyber_arena">Cyber Arena</option>
                    </select>

                    <select
                      value={shot.weather}
                      onChange={(e) =>
                        updateShotField(
                          shot.id,
                          'weather',
                          e.target.value as ConcreteWeather
                        )
                      }
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none"
                    >
                      <option value="rain">Rain</option>
                      <option value="petals">Sakura Petals</option>
                      <option value="embers">Embers</option>
                      <option value="snow">Snow</option>
                      <option value="stardust">Stardust</option>
                      <option value="clear">Clear</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'sheet' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Auto-compiled 24fps shot breakdown &amp; closed 10-hex color script
              </span>
              <button
                type="button"
                onClick={handleCopyShotSheet}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-indigo-500"
              >
                {copiedSheet ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Copy Shot Sheet</span>
                  </>
                )}
              </button>
            </div>
            <pre className="max-h-[370px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-300">
              {project.shotSheetMarkdown}
            </pre>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="max-h-[380px] space-y-2.5 overflow-y-auto">
            {vault.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center">
                <Film className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                <p className="text-xs font-semibold text-slate-300">
                  No MP4 videos rendered yet in this session.
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Click &ldquo;Render &amp; Download .MP4&rdquo; to generate your
                  first anime video!
                </p>
              </div>
            ) : (
              vault.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-xs font-bold text-white">
                      {item.title}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {item.aspect} ({item.width}×{item.height}) ·{' '}
                      {item.durationSec}s · {formatBytes(item.sizeBytes)} ·{' '}
                      {item.scriptName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectVaultVideo(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-indigo-500"
                    >
                      <Play className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Watch</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadMp4(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>.MP4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteVaultVideo(item.id)}
                      className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:border-rose-500/40 hover:text-rose-400"
                      aria-label="Remove from vault"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
