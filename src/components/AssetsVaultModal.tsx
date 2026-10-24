import React, { useState } from 'react';
import {
  AudioWaveform,
  Clapperboard,
  Code2,
  Download,
  Folder,
  Image as ImageIcon,
  Trash2,
  X,
} from 'lucide-react';
import { GeneratedAssetItem } from '../types';
import { saveFileCrossPlatform } from '../services/nativeBridge';

interface Props {
  open: boolean;
  assets: GeneratedAssetItem[];
  onDeleteAsset: (id: string) => void;
  onClose: () => void;
}

export const AssetsVaultModal: React.FC<Props> = ({
  open,
  assets,
  onDeleteAsset,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'video' | 'voice' | 'image' | 'app'>('all');

  if (!open) return null;

  const list = assets.filter((a) => (filter === 'all' ? true : a.kind === filter));

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-3xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-slate-900 dark:text-white" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assets</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#161B24] flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ['all', 'All'],
              ['video', 'Videos'],
              ['voice', 'Voice'],
              ['image', 'Images'],
              ['app', 'Apps'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                filter === id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-white dark:bg-[#141821] text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#141821] p-10 text-center space-y-2 border border-slate-200/70 dark:border-slate-800">
            <Folder className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No generated assets yet
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Ask Open Brain in chat to create any MP4 video, cloned voice clip, HD image, or web app — everything saves here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#141821] border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {item.kind === 'video' && item.url && (
                    <video
                      src={item.url}
                      controls
                      playsInline
                      className="w-full max-h-56 bg-black object-contain"
                    />
                  )}
                  {item.kind === 'image' && item.url && (
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full max-h-60 object-cover bg-slate-100 dark:bg-slate-900"
                    />
                  )}
                  {item.kind === 'voice' && item.url && (
                    <div className="p-4 bg-[#F8F9FB] dark:bg-[#1A202C]">
                      <audio src={item.url} controls className="w-full h-9" />
                    </div>
                  )}
                  {item.kind === 'app' && item.html && (
                    <iframe
                      title={item.title}
                      srcDoc={item.html}
                      sandbox="allow-scripts"
                      className="w-full h-56 border-0 bg-slate-950"
                    />
                  )}
                </div>

                <div className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {item.kind === 'video' && <Clapperboard className="w-3.5 h-3.5 shrink-0" />}
                      {item.kind === 'voice' && <AudioWaveform className="w-3.5 h-3.5 shrink-0" />}
                      {item.kind === 'image' && <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
                      {item.kind === 'app' && <Code2 className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.subtitle && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === 'app' && item.html) {
                          saveFileCrossPlatform(
                            new Blob([item.html], { type: 'text/html' }),
                            `OpenBrain-${item.id}.html`,
                            'text/html'
                          );
                        } else if (item.url) {
                          const ext =
                            item.kind === 'video'
                              ? 'mp4'
                              : item.kind === 'voice'
                              ? 'wav'
                              : 'jpg';
                          saveFileCrossPlatform(
                            item.url,
                            `OpenBrain-${item.id}.${ext}`,
                            item.mimeType || 'application/octet-stream'
                          );
                        }
                      }}
                      className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(item.id)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
