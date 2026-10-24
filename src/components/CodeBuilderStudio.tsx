import React, { useState } from 'react';
import { Code2, Copy, Download, Eye, Loader2, Sparkles } from 'lucide-react';
import { AppSettings } from '../types';
import { generateFreeLLMResponse } from '../services/llmEngine';
import { saveFileCrossPlatform, triggerHaptic } from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
}

const APP_IDEAS = [
  'Modern Pomodoro timer + Lo-Fi beat synthesizer in WebAudio with neon glass UI',
  'Personal daily Expense & EMI Calculator in ₹ INR with visual pie chart',
  'Playable Space Shooter mobile touch arcade game with particle explosions',
];

export const CodeBuilderStudio: React.FC<Props> = ({ settings }) => {
  const [prompt, setPrompt] = useState('');
  const [building, setBuilding] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [generatedHtml, setGeneratedHtml] = useState<string>('');

  const handleBuild = async (idea?: string) => {
    const target = (idea ?? prompt).trim();
    if (!target || building) return;
    if (idea) setPrompt(idea);
    triggerHaptic(20);
    setBuilding(true);

    try {
      const raw = await generateFreeLLMResponse(
        [
          {
            role: 'system',
            content:
              'You are Qwen-Coder Architect. Build a complete, rich, interactive, mobile-responsive single-file HTML5 app (<!DOCTYPE html>...</html>) with embedded CSS and vanilla JavaScript. Dark futuristic UI, touch-friendly controls, zero external broken links. Output ONLY the HTML code.',
          },
          { role: 'user', content: target },
        ],
        settings,
        'qwen-coder'
      );

      const match = raw.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
      const html = match ? match[0] : raw.replace(/```html|```/gi, '').trim();
      setGeneratedHtml(html);
      setViewMode('preview');
    } catch (err: any) {
      alert(`Code builder error: ${err?.message || String(err)}`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="glass-card rounded-2xl p-4 border border-emerald-500/25 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Instant App & Game Builder
              </h2>
              <p className="text-xs text-slate-400">
                Powered by Qwen 2.5 Coder 32B (Open-Source Free) • Live Phone Preview
              </p>
            </div>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Describe any app, calculator, dashboard, or game (Banglish / English)..."
          className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
        />

        <div className="flex flex-wrap gap-1.5">
          {APP_IDEAS.map((idTxt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleBuild(idTxt)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 truncate max-w-[260px]"
            >
              ⚡ {idTxt}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!prompt.trim() || building}
          onClick={() => handleBuild()}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-bold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg"
        >
          {building ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Compiling Full Interactive App...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Build & Launch Live App
            </>
          )}
        </button>
      </div>

      {generatedHtml && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                  viewMode === 'preview'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Live App
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                  viewMode === 'code'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                    : 'text-slate-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" /> Source Code
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(generatedHtml)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                title="Copy HTML"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  saveFileCrossPlatform(
                    new Blob([generatedHtml], { type: 'text/html' }),
                    `OpenBrainApp-${Date.now()}.html`,
                    'text/html'
                  )
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
              >
                <Download className="w-3.5 h-3.5" /> Download .html
              </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <iframe
              title="Live Generated App"
              srcDoc={generatedHtml}
              sandbox="allow-scripts"
              className="w-full h-[460px] bg-slate-950 border-0"
            />
          ) : (
            <pre className="p-4 max-h-[460px] overflow-auto text-xs font-mono text-emerald-200 bg-[#05070D]">
              <code>{generatedHtml}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
