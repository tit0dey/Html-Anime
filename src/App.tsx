import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { DirectorFormPanel } from './components/DirectorFormPanel';
import { HeaderBar } from './components/HeaderBar';
import { StageAndVaultPanel } from './components/StageAndVaultPanel';
import { COLOR_SCRIPTS, getDimensions } from './engine/colorScripts';
import {
  buildShotSheetMarkdown,
  compileAnimeFilmProject,
  fetchOptionalTopicContext,
  inferColorScriptFromPrompt,
} from './engine/directorEngine';
import { RenderProgressInfo, renderFilmToMp4 } from './engine/mp4Exporter';
import {
  downloadBlobCrossPlatform,
  hapticTap,
  showToast,
} from './engine/nativeBridge';
import {
  CompiledFilmProject,
  FilmShot,
  RenderedVideoVaultItem,
  StudioFormConfig,
} from './types/film';

const INITIAL_CONFIG: StudioFormConfig = {
  prompt:
    'A lone swordsman stands on a rain-drenched neon rooftop watching the midnight train pass below. Lightning flashes across the skyline as he draws his blade in a single breathtaking strike, then stands in quiet resolve.',
  dialogue: 'STILL STANDING',
  aspect: '16:9',
  quality: '720p',
  minutes: 0,
  seconds: 12,
  scriptId: 'auto',
  world: 'auto',
  weather: 'auto',
  showSubtitles: true,
  includeScore: true,
  includeVoiceover: false,
  letterbox: true,
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<StudioFormConfig>(INITIAL_CONFIG);
  const [project, setProject] = useState<CompiledFilmProject>(() =>
    compileAnimeFilmProject(INITIAL_CONFIG)
  );
  const [hasCustomShotEdits, setHasCustomShotEdits] = useState(false);

  const [isCompiling, setIsCompiling] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] =
    useState<RenderProgressInfo | null>(null);

  const [latestVideo, setLatestVideo] = useState<RenderedVideoVaultItem | null>(
    null
  );
  const [vault, setVault] = useState<RenderedVideoVaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<'shots' | 'sheet' | 'vault'>('shots');

  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const prevStructuralRef = useRef<string>(
    JSON.stringify({
      prompt: INITIAL_CONFIG.prompt,
      dialogue: INITIAL_CONFIG.dialogue,
      minutes: INITIAL_CONFIG.minutes,
      seconds: INITIAL_CONFIG.seconds,
      world: INITIAL_CONFIG.world,
      weather: INITIAL_CONFIG.weather,
    })
  );
  const vaultUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of vaultUrlsRef.current) {
        URL.revokeObjectURL(u);
      }
    };
  }, []);

  useEffect(() => {
    const nextStructural = JSON.stringify({
      prompt: config.prompt,
      dialogue: config.dialogue,
      minutes: config.minutes,
      seconds: config.seconds,
      world: config.world,
      weather: config.weather,
    });

    const structuralChanged = nextStructural !== prevStructuralRef.current;

    const timer = setTimeout(() => {
      if (!structuralChanged && hasCustomShotEdits) {
        // Non-destructive update: keep custom shot edits while applying orientation/quality/palette/toggles!
        const { width, height } = getDimensions(config.aspect, config.quality);
        const resolvedId = inferColorScriptFromPrompt(
          config.prompt,
          config.scriptId
        );
        const colorScript = COLOR_SCRIPTS[resolvedId] || COLOR_SCRIPTS.indigo;

        setProject((prev) => ({
          ...prev,
          aspect: config.aspect,
          quality: config.quality,
          width,
          height,
          colorScript,
          includeScore: config.includeScore,
          includeVoiceover: config.includeVoiceover,
          showSubtitles: config.showSubtitles,
          letterbox: config.letterbox,
          shotSheetMarkdown: buildShotSheetMarkdown({
            cleanPrompt: prev.rawPrompt,
            totalSeconds: prev.totalSeconds,
            totalFrames: prev.totalFrames,
            width,
            height,
            aspect: config.aspect,
            colorScript,
            shots: prev.shots,
          }),
        }));
      } else {
        prevStructuralRef.current = nextStructural;
        const nextProj = compileAnimeFilmProject(config);
        setProject(nextProj);
        setHasCustomShotEdits(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [config, hasCustomShotEdits]);

  const handleCompilePreview = async () => {
    setIsCompiling(true);
    setBanner(null);
    try {
      const wikiContext = await fetchOptionalTopicContext(config.prompt);
      const compiled = compileAnimeFilmProject(config, wikiContext);
      setProject(compiled);
      setHasCustomShotEdits(false);
      hapticTap(18);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleUpdateProjectShots = (shots: FilmShot[]) => {
    setHasCustomShotEdits(true);
    setProject((prev) => ({
      ...prev,
      shots,
      shotSheetMarkdown: buildShotSheetMarkdown({
        cleanPrompt: prev.rawPrompt,
        totalSeconds: prev.totalSeconds,
        totalFrames: prev.totalFrames,
        width: prev.width,
        height: prev.height,
        aspect: prev.aspect,
        colorScript: prev.colorScript,
        shots,
      }),
    }));
  };

  const handleRenderMp4 = async () => {
    if (isRendering) return;
    setBanner(null);
    setIsRendering(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      let targetProject = project;
      if (!hasCustomShotEdits) {
        setRenderProgress({
          pct: 1,
          currentFrame: 0,
          totalFrames: Math.max(96, (config.minutes * 60 + config.seconds) * 24),
          statusText: 'Directing 24fps shot sheet & cel layers...',
          etaSec: 4,
        });
        const wikiContext = await fetchOptionalTopicContext(config.prompt);
        targetProject = compileAnimeFilmProject(config, wikiContext);
        setProject(targetProject);
      }

      const result = await renderFilmToMp4({
        project: targetProject,
        signal: abortController.signal,
        onProgress: (info) => setRenderProgress(info),
      });

      vaultUrlsRef.current.push(result.url);

      const vaultItem: RenderedVideoVaultItem = {
        id: `mp4_${Date.now().toString(36)}`,
        title: targetProject.title,
        slug: targetProject.slug,
        aspect: targetProject.aspect,
        width: targetProject.width,
        height: targetProject.height,
        durationSec: targetProject.totalSeconds,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
        videoUrl: result.url,
        blob: result.blob,
        scriptName: targetProject.colorScript.name,
        createdAt: Date.now(),
      };

      setLatestVideo(vaultItem);
      setVault((prev) => [vaultItem, ...prev]);
      hapticTap(28);

      const safeTitle = vaultItem.slug
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 34);
      const ext = result.mimeType.includes('webm') ? 'webm' : 'mp4';
      const fileName = `${safeTitle || 'HTML_Anime_Film'}_${vaultItem.aspect.replace(
        ':',
        'x'
      )}_${vaultItem.durationSec}s.${ext}`;

      await downloadBlobCrossPlatform(result.blob, fileName, result.mimeType);

      const msg = `Rendered ${vaultItem.durationSec}s MP4 (${result.engineLabel}) — download started!`;
      setBanner({ type: 'success', message: msg });
      showToast('MP4 video rendered & saved!');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Video rendering interrupted.';
      if (msg !== 'Render cancelled.') {
        setBanner({ type: 'error', message: msg });
      }
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
      abortRef.current = null;
    }
  };

  const handleCancelRender = () => {
    abortRef.current?.abort();
  };

  const handleDeleteVaultVideo = (id: string) => {
    setVault((prev) => {
      const target = prev.find((v) => v.id === id);
      if (target) {
        URL.revokeObjectURL(target.videoUrl);
        vaultUrlsRef.current = vaultUrlsRef.current.filter(
          (u) => u !== target.videoUrl
        );
      }
      return prev.filter((v) => v.id !== id);
    });
    if (latestVideo?.id === id) {
      setLatestVideo(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-indigo-950/35 via-violet-950/10 to-transparent" />

      <HeaderBar
        vaultCount={vault.length}
        onOpenVault={() => setActiveTab('vault')}
      />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {banner && (
          <div
            className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
              banner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{banner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs font-bold opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <DirectorFormPanel
              config={config}
              onChange={setConfig}
              onCompilePreview={handleCompilePreview}
              onRenderMp4={handleRenderMp4}
              isCompiling={isCompiling}
              isRendering={isRendering}
            />
          </div>

          <div className="lg:col-span-7">
            <StageAndVaultPanel
              project={project}
              onUpdateProjectShots={handleUpdateProjectShots}
              isRendering={isRendering}
              renderProgress={renderProgress}
              onCancelRender={handleCancelRender}
              onTriggerRenderMp4={handleRenderMp4}
              latestVideo={latestVideo}
              vault={vault}
              onSelectVaultVideo={(item) => setLatestVideo(item)}
              onDeleteVaultVideo={handleDeleteVaultVideo}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
