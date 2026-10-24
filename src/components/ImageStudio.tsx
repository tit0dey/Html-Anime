import React, { useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { AppSettings, GeneratedImageItem } from '../types';
import {
  buildFluxImageUrl,
  getDimensionsForRatio,
  preloadImageAsObjectUrl,
} from '../services/imageEngine';
import { generateFreeLLMResponse } from '../services/llmEngine';
import { saveFileCrossPlatform, triggerHaptic } from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
}

export const ImageStudio: React.FC<Props> = ({ settings }) => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo'>('flux');
  const [ratio, setRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [batchCount, setBatchCount] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [gallery, setGallery] = useState<GeneratedImageItem[]>([]);

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await generateFreeLLMResponse(
        [
          {
            role: 'system',
            content:
              'Expand this idea into an extraordinary Flux.1 image generation prompt in English with composition, lighting, lens details, and artistic mastery. Return ONLY the prompt.',
          },
          { role: 'user', content: prompt },
        ],
        settings,
        'openai'
      );
      if (res) setPrompt(res.replace(/^["']|["']$/g, '').trim());
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    triggerHaptic(20);
    setLoading(true);

    try {
      const { width, height } = getDimensionsForRatio(ratio);
      const created: GeneratedImageItem[] = await Promise.all(
        Array.from({ length: batchCount }, async (_, idx) => {
          const seed = Math.floor(Math.random() * 9999999) + idx * 71;
          const remoteUrl = buildFluxImageUrl({
            prompt,
            model,
            width,
            height,
            seed,
          });
          const localUrl = await preloadImageAsObjectUrl(remoteUrl, 38000).catch(
            () => remoteUrl
          );
          return {
            id: `img-${Date.now()}-${idx}`,
            prompt,
            model,
            aspectRatio: ratio,
            width,
            height,
            seed,
            url: localUrl,
            createdAt: Date.now(),
          };
        })
      );
      setGallery((prev) => [...created, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="glass-card rounded-2xl p-4 border border-violet-500/25 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-emerald-500 flex items-center justify-center shadow-lg">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Unlimited Flux.1 Art Studio
              </h2>
              <p className="text-xs text-slate-400">
                Open-Source Black Forest Labs Flux • Photorealism, Anime, 3D & Wallpapers
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
            HD NO WATERMARK
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe any image, logo, character, or wallpaper..."
          className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white focus:outline-none focus:border-violet-500"
        />

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Open Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value="flux">Flux.1 Pro</option>
              <option value="flux-realism">Flux Realism</option>
              <option value="flux-anime">Flux Anime</option>
              <option value="flux-3d">Flux 3D Render</option>
              <option value="turbo">SDXL Turbo</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Aspect Ratio</label>
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value as any)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value="1:1">1:1 Square HD</option>
              <option value="9:16">9:16 Phone Wallpaper</option>
              <option value="16:9">16:9 Widescreen</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Variations</label>
            <select
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              <option value={1}>1 Image</option>
              <option value={2}>2 Variations</option>
              <option value={4}>4 Variations</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!prompt.trim() || enhancing || loading}
            onClick={handleEnhance}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-violet-300 flex items-center gap-1.5 disabled:opacity-40"
          >
            {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Enhance
          </button>

          <button
            type="button"
            disabled={!prompt.trim() || loading}
            onClick={handleGenerate}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Rendering HD Flux Art...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate Unlimited Art
              </>
            )}
          </button>
        </div>
      </div>

      {gallery.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gallery.map((item) => (
            <div
              key={item.id}
              className="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col"
            >
              <img
                src={item.url}
                alt={item.prompt}
                className="w-full max-h-96 object-cover bg-slate-950"
              />
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-violet-300 uppercase">
                    {item.model} • {item.width}×{item.height}
                  </div>
                  <p className="text-xs text-slate-300 truncate">{item.prompt}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveFileCrossPlatform(
                      item.url,
                      `OpenBrainFlux-${item.seed}.jpg`,
                      'image/jpeg'
                    )
                  }
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white"
                >
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
