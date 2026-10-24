import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  Laptop,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  SquarePen,
  Volume2,
  X,
} from 'lucide-react';
import {
  AgentToolStep,
  AppSettings,
  ChatMessage,
  RenderedCodeVideoArtifact,
  VoiceProfile,
} from '../types';
import { FREE_LLM_MODELS } from '../services/llmEngine';
import { renderCodeSandboxToMp4 } from '../services/codeSandboxVideoEngine';
import {
  executePhoneAction,
  isRunningInAndroidApk,
  saveFileCrossPlatform,
  speakWithDeviceFallback,
  triggerHaptic,
} from '../services/nativeBridge';
import { OpenBrainLogo } from './OpenBrainLogo';
import { InlineVoiceRecorderCard } from './InlineVoiceRecorderCard';

interface Props {
  threadTitle: string;
  messages: ChatMessage[];
  liveSteps: AgentToolStep[];
  isThinking: boolean;
  settings: AppSettings;
  voiceProfiles: VoiceProfile[];
  activeProjectName?: string;
  composerDraft: string;
  attachedImage?: string;
  attachedFileName?: string;
  onChangeDraft: (val: string) => void;
  onClearAttachments: () => void;
  onSend: () => void;
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenAddSheet: () => void;
  onOpenModelSheet: () => void;
  onOpenPhoneControl: () => void;
  onSaveVoiceProfile: (profile: VoiceProfile) => void;
  onSelectVoiceProfile: (id: string) => void;
  onUpdateVideoArtifact: (msgId: string, updated: RenderedCodeVideoArtifact) => void;
}

function renderFormattedContent(text: string): React.ReactNode {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((seg, idx) => {
    if (seg.startsWith('```') && seg.endsWith('```')) {
      const firstLineEnd = seg.indexOf('\n');
      const lang =
        firstLineEnd > 3 ? seg.slice(3, firstLineEnd).trim() : 'code';
      const body =
        firstLineEnd > 0 ? seg.slice(firstLineEnd + 1, -3) : seg.slice(3, -3);
      return (
        <div
          key={idx}
          className="my-3 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#0D1117] text-slate-100"
        >
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#161B22] text-[11px] text-slate-400 font-mono">
            <span>{lang || 'code'}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(body)}
              className="flex items-center gap-1 text-slate-300 hover:text-white"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200">
            <code>{body}</code>
          </pre>
        </div>
      );
    }

    return (
      <div key={idx} className="space-y-2 leading-relaxed">
        {seg.split('\n').map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lIdx} className="h-1" />;

          if (trimmed.startsWith('### ')) {
            return (
              <h4
                key={lIdx}
                className="font-bold text-[15px] text-slate-900 dark:text-white pt-1"
              >
                {trimmed.slice(4)}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3
                key={lIdx}
                className="font-bold text-[16px] text-slate-900 dark:text-white pt-1.5"
              >
                {trimmed.slice(3)}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2
                key={lIdx}
                className="font-bold text-[18px] text-slate-900 dark:text-white pt-2"
              >
                {trimmed.slice(2)}
              </h2>
            );
          }

          const isBullet = /^[-*•]\s+/.test(trimmed);
          const cleanLine = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : line;

          const inlineParts = cleanLine.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((p, pIdx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return (
                <strong
                  key={pIdx}
                  className="font-semibold text-slate-900 dark:text-white"
                >
                  {p.slice(2, -2)}
                </strong>
              );
            }
            if (p.startsWith('`') && p.endsWith('`')) {
              return (
                <code
                  key={pIdx}
                  className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[13px] font-mono text-slate-800 dark:text-teal-300"
                >
                  {p.slice(1, -1)}
                </code>
              );
            }
            return p;
          });

          if (isBullet) {
            return (
              <div key={lIdx} className="flex items-start gap-2.5 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-2 shrink-0" />
                <span className="flex-1">{inlineParts}</span>
              </div>
            );
          }

          return <p key={lIdx}>{inlineParts}</p>;
        })}
      </div>
    );
  });
}

export const ChatWorkspace: React.FC<Props> = ({
  threadTitle,
  messages,
  liveSteps,
  isThinking,
  settings,
  voiceProfiles,
  activeProjectName,
  composerDraft,
  attachedImage,
  attachedFileName,
  onChangeDraft,
  onClearAttachments,
  onSend,
  onOpenDrawer,
  onNewChat,
  onOpenAddSheet,
  onOpenModelSheet,
  onOpenPhoneControl,
  onSaveVoiceProfile,
  onSelectVoiceProfile,
  onUpdateVideoArtifact,
}) => {
  const [showPhonePill, setShowPhonePill] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openTraceIds, setOpenTraceIds] = useState<Record<string, boolean>>({});
  const [appCodeTabIds, setAppCodeTabIds] = useState<Record<string, boolean>>({});
  const [editingVideoMsgId, setEditingVideoMsgId] = useState<string | null>(null);
  const [videoCodeDraft, setVideoCodeDraft] = useState('');
  const [reRenderingId, setReRenderingId] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecRef = useRef<any>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking, liveSteps.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [composerDraft]);

  const currentModelInfo =
    FREE_LLM_MODELS.find((m) => m.id === settings.selectedModel) ||
    FREE_LLM_MODELS[0];

  const inApk = isRunningInAndroidApk();
  const hasSendableInput =
    Boolean(composerDraft.trim()) ||
    Boolean(attachedImage) ||
    Boolean(attachedFileName);

  const toggleVoiceDictation = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Live microphone dictation is not supported in this browser.');
      return;
    }
    if (isListening && speechRecRef.current) {
      speechRecRef.current.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const txt = ev?.results?.[0]?.[0]?.transcript || '';
      if (txt) {
        onChangeDraft((composerDraft ? `${composerDraft} ` : '') + txt);
      }
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    speechRecRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const handleReRenderCodeVideo = async (
    msgId: string,
    art: RenderedCodeVideoArtifact
  ) => {
    if (!videoCodeDraft.trim() || reRenderingId) return;
    setReRenderingId(msgId);
    try {
      const out = await renderCodeSandboxToMp4({
        prompt: art.title,
        aspectRatio: art.height > art.width ? '9:16' : '16:9',
        durationSec: art.durationSec || 7,
        customCode: videoCodeDraft,
        ecoMode: settings.featherlightEcoMode,
        includeVoiceover: false,
        settings,
      });
      onUpdateVideoArtifact(msgId, {
        ...art,
        videoUrl: out.videoUrl,
        mimeType: out.mimeType,
        code: out.code,
      });
      setEditingVideoMsgId(null);
    } catch (err: any) {
      alert(`Sandbox code error: ${err?.message || String(err)}`);
    } finally {
      setReRenderingId(null);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-white dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      {/* Minimalist Top Header (Zero Paywall / Zero Upgrade Banner) */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[calc(0.65rem+env(safe-area-inset-top,0px))] pb-2.5 bg-white/95 dark:bg-[#0B0E14]/95 z-20">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onOpenDrawer();
          }}
          className="p-2 -ml-1.5 rounded-full text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
          aria-label="Open menu"
        >
          {/* Exact MiniMax Two-Line Menu Vector Icon */}
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          >
            <line x1="4" y1="8.5" x2="18" y2="8.5" />
            <line x1="4" y1="15.5" x2="18" y2="15.5" />
          </svg>
        </button>

        {/* Subtle Center Thread / Project Title */}
        <div className="min-w-0 px-2 text-center">
          {messages.length > 0 ? (
            <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[210px] sm:max-w-xs">
              {threadTitle}
            </div>
          ) : activeProjectName ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F3F4F6] dark:bg-[#161B24] text-slate-700 dark:text-slate-300">
              {activeProjectName}
            </span>
          ) : null}
        </div>

        {/* Right Header Action */}
        <div className="flex items-center gap-1">
          {!inApk && messages.length === 0 && (
            <a
              href="./OpenBrain-AI.apk"
              download="OpenBrain-AI.apk"
              className="px-2.5 py-1 rounded-full bg-[#F3F4F6] dark:bg-[#161B24] text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
              title="Download Android APK"
            >
              <Download className="w-3 h-3" /> APK
            </a>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onNewChat();
              }}
              className="p-2 -mr-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
              aria-label="New conversation"
            >
              <SquarePen className="w-5 h-5 stroke-[1.75]" />
            </button>
          )}
        </div>
      </header>

      {/* Main Scrollable Canvas */}
      <main className="flex-1 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          {messages.length === 0 && !isThinking ? (
            /* Exact MiniMax Empty Hero Screen */
            <div className="flex-1 flex flex-col items-center justify-center pb-12 select-none">
              <OpenBrainLogo className="w-16 h-16 sm:w-20 sm:h-20 text-slate-900 dark:text-white mb-5" />
              <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-slate-900 dark:text-white text-center">
                How can I help you?
              </h1>
            </div>
          ) : (
            /* Active Chat Stream */
            <div className="py-3 space-y-6">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex flex-col items-end space-y-2">
                      {msg.attachedImage && (
                        <img
                          src={msg.attachedImage}
                          alt="Attachment"
                          className="max-h-52 rounded-2xl border border-slate-200 dark:border-slate-800 object-cover"
                        />
                      )}
                      {msg.attachedFileName && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1E2430] text-xs font-medium text-slate-700 dark:text-slate-200">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{msg.attachedFileName}</span>
                        </div>
                      )}
                      <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-[#F3F4F6] dark:bg-[#1E2430] px-4 py-2.5 text-[15px] text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const hasTraceOrSteps =
                  Boolean(msg.thinkingTrace) ||
                  Boolean(msg.toolSteps && msg.toolSteps.length > 0);
                const traceExpanded = Boolean(openTraceIds[msg.id]);
                const showingCodeTab = Boolean(appCodeTabIds[msg.id]);
                const isEditingVid = editingVideoMsgId === msg.id;

                return (
                  <div key={msg.id} className="space-y-2.5">
                    {/* Assistant Identity Row */}
                    <div className="flex items-center gap-2">
                      <OpenBrainLogo className="w-5 h-5 text-slate-900 dark:text-white shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        Open Brain
                      </span>
                      {msg.routedModelLabel && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] dark:bg-[#161B24] text-slate-500 dark:text-slate-400 font-medium">
                          {msg.routedModelLabel}
                        </span>
                      )}
                    </div>

                    {/* Collapsible Agent Steps & Deep Reasoning Accordion */}
                    {hasTraceOrSteps && (
                      <div className="rounded-2xl bg-[#F8F9FB] dark:bg-[#131720] border border-slate-200/70 dark:border-slate-800/80 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTraceIds((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>
                              {msg.toolSteps && msg.toolSteps.length > 0
                                ? `Completed ${msg.toolSteps.length} autonomous step${
                                    msg.toolSteps.length > 1 ? 's' : ''
                                  }`
                                : 'Thought process'}
                            </span>
                          </span>
                          {traceExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {traceExpanded && (
                          <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                            {msg.toolSteps?.map((st) => (
                              <div key={st.id} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {st.title}
                                  </span>
                                  {st.durationMs ? ` (${st.durationMs}ms)` : ''}
                                  {st.resultSummary && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                      {st.resultSummary}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {msg.thinkingTrace && (
                              <div className="pt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/60">
                                {msg.thinkingTrace}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assistant Text Body */}
                    <div className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
                      {renderFormattedContent(msg.content)}
                    </div>

                    {/* Inline Phone OS Action Pills */}
                    {msg.phoneActions && msg.phoneActions.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {msg.phoneActions.map((pa, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-2xl bg-[#F5F6F8] dark:bg-[#151A24] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {pa.label}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {pa.executedResult}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => executePhoneAction(pa)}
                              className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold"
                            >
                              Run
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline MP4 Video Artifact */}
                    {msg.codeVideoArtifact && (
                      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F8F9FB] dark:bg-[#141821]">
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/70 dark:border-slate-800">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {msg.codeVideoArtifact.engineLabel || 'Rendered MP4 Video'} ·{' '}
                            {msg.codeVideoArtifact.width}x{msg.codeVideoArtifact.height}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {msg.codeVideoArtifact.code && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingVid) {
                                    setEditingVideoMsgId(null);
                                  } else {
                                    setEditingVideoMsgId(msg.id);
                                    setVideoCodeDraft(msg.codeVideoArtifact!.code || '');
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1E2430] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                              >
                                <Code2 className="w-3 h-3" />
                                {isEditingVid ? 'Hide Code' : 'Code'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                saveFileCrossPlatform(
                                  msg.codeVideoArtifact!.videoUrl,
                                  `OpenBrain-${msg.id}.mp4`,
                                  msg.codeVideoArtifact!.mimeType || 'video/mp4'
                                )
                              }
                              className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Save .mp4
                            </button>
                          </div>
                        </div>

                        <div className="bg-black flex justify-center">
                          <video
                            src={msg.codeVideoArtifact.videoUrl}
                            controls
                            autoPlay
                            loop
                            playsInline
                            className="w-full max-h-[380px] object-contain"
                          />
                        </div>

                        {isEditingVid && (
                          <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-800">
                            <textarea
                              value={videoCodeDraft}
                              onChange={(e) => setVideoCodeDraft(e.target.value)}
                              rows={7}
                              className="w-full rounded-xl bg-[#0D1117] text-teal-200 p-3 text-xs font-mono focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={reRenderingId === msg.id}
                              onClick={() =>
                                handleReRenderCodeVideo(msg.id, msg.codeVideoArtifact!)
                              }
                              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5"
                            >
                              {reRenderingId === msg.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Re-Render MP4
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Cloned / Neural Voice Audio Clip */}
                    {msg.voiceClipArtifact && (
                      <div className="p-3.5 rounded-2xl bg-[#F8F9FB] dark:bg-[#141821] border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {msg.voiceClipArtifact.voiceName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {msg.voiceClipArtifact.engineUsed}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              saveFileCrossPlatform(
                                msg.voiceClipArtifact!.audioUrl,
                                `OpenBrainVoice-${msg.voiceClipArtifact!.id}.wav`,
                                'audio/wav'
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> Save WAV
                          </button>
                        </div>
                        <audio
                          src={msg.voiceClipArtifact.audioUrl}
                          controls
                          autoPlay
                          className="w-full h-9"
                        />
                      </div>
                    )}

                    {/* Inline Voice Clone Setup Card (Triggered when user asks "can you clone my voice?") */}
                    {msg.showVoiceCloneRecorder && (
                      <InlineVoiceRecorderCard
                        profiles={voiceProfiles}
                        activeProfileId={settings.activeVoiceProfileId}
                        onSaveProfile={onSaveVoiceProfile}
                        onSelectProfile={onSelectVoiceProfile}
                      />
                    )}

                    {/* Inline Generated Flux HD Images */}
                    {msg.generatedImages && msg.generatedImages.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {msg.generatedImages.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F8F9FB] dark:bg-[#141821]"
                          >
                            <img
                              src={imgUrl}
                              alt="Generated HD Artwork"
                              className="w-full max-h-80 object-cover"
                            />
                            <div className="px-3 py-2 flex items-center justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                Flux.1 Studio HD
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  saveFileCrossPlatform(
                                    imgUrl,
                                    `OpenBrainArt-${Date.now()}.jpg`,
                                    'image/jpeg'
                                  )
                                }
                                className="font-semibold text-slate-900 dark:text-white flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Interactive HTML5 Mini-App Artifact */}
                    {msg.codeArtifact && (
                      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F8F9FB] dark:bg-[#141821]">
                        <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setAppCodeTabIds((prev) => ({
                                  ...prev,
                                  [msg.id]: false,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                                !showingCodeTab
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                  : 'text-slate-500'
                              }`}
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAppCodeTabIds((prev) => ({
                                  ...prev,
                                  [msg.id]: true,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                                showingCodeTab
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                  : 'text-slate-500'
                              }`}
                            >
                              <Code2 className="w-3 h-3" /> Source
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              saveFileCrossPlatform(
                                new Blob([msg.codeArtifact!.html], {
                                  type: 'text/html',
                                }),
                                `OpenBrainApp-${msg.id}.html`,
                                'text/html'
                              )
                            }
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> .html
                          </button>
                        </div>

                        {!showingCodeTab ? (
                          <iframe
                            title={msg.codeArtifact.title}
                            srcDoc={msg.codeArtifact.html}
                            sandbox="allow-scripts"
                            className="w-full h-96 border-0 bg-slate-950"
                          />
                        ) : (
                          <pre className="p-3.5 max-h-96 overflow-auto text-xs font-mono bg-[#0D1117] text-slate-200">
                            <code>{msg.codeArtifact.html}</code>
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Subtle Message Action Row */}
                    <div className="flex items-center gap-3 pt-0.5 text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(msg.content);
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        title="Copy"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-4 h-4 text-teal-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => speakWithDeviceFallback(msg.content, 'en-US')}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        title="Read aloud"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Live Thinking & Autonomous Tool Execution Indicator */}
              {isThinking && (
                <div className="space-y-2 py-2">
                  <div className="flex items-center gap-2">
                    <OpenBrainLogo className="w-5 h-5 text-slate-900 dark:text-white animate-pulse" />
                    <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                      {liveSteps.length > 0
                        ? liveSteps[liveSteps.length - 1].title
                        : 'Thinking...'}
                    </span>
                  </div>
                  {liveSteps.length > 0 && (
                    <div className="pl-7 space-y-1">
                      {liveSteps.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                        >
                          {st.status === 'running' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700 dark:text-teal-400" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          )}
                          <span className="truncate">{st.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div ref={feedEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Pills + MiniMax Rounded Composer */}
      <footer className="shrink-0 px-3.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] pt-1.5 bg-white dark:bg-[#0B0E14]">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Attachment Preview or "Connect Phone" Pill (Exact Match to Screenshot 1) */}
          <div className="flex flex-wrap items-center gap-2">
            {attachedImage && (
              <div className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#F3F4F6] dark:bg-[#1A202C] text-xs font-medium text-slate-700 dark:text-slate-200">
                <img
                  src={attachedImage}
                  alt="Preview"
                  className="w-6 h-6 rounded-lg object-cover"
                />
                <span>Image attached</span>
                <button type="button" onClick={onClearAttachments}>
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}

            {attachedFileName && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1A202C] text-xs font-medium text-slate-700 dark:text-slate-200">
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[180px]">{attachedFileName}</span>
                <button type="button" onClick={onClearAttachments}>
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}

            {messages.length === 0 &&
              showPhonePill &&
              !attachedImage &&
              !attachedFileName && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F3F4F6] dark:bg-[#161B24] text-[13px] font-medium text-slate-800 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={onOpenPhoneControl}
                    className="flex items-center gap-1.5"
                  >
                    <Laptop className="w-4 h-4 stroke-[1.8]" />
                    <span>{inApk ? 'Phone OS Ready' : 'Phone Control'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPhonePill(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-0.5"
                    aria-label="Dismiss pill"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
          </div>

          {/* Rounded Soft-Gray Composer Card */}
          <div className="rounded-[26px] bg-[#F3F4F6] dark:bg-[#161B24] px-4 pt-3 pb-2.5 transition">
            <textarea
              ref={textareaRef}
              value={composerDraft}
              onChange={(e) => onChangeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
                  e.preventDefault();
                  if (hasSendableInput && !isThinking) onSend();
                }
              }}
              rows={1}
              placeholder="Message Open Brain"
              className="w-full bg-transparent text-[16px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none max-h-[132px]"
            />

            {/* Bottom Toolbar Inside Composer (Exact MiniMax Layout) */}
            <div className="flex items-center justify-between pt-2">
              {/* Left "+" Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onOpenAddSheet();
                }}
                className="p-1 -ml-1 rounded-full text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
                aria-label="Add to Chat"
              >
                <Plus className="w-6 h-6 stroke-[1.8]" />
              </button>

              {/* Right Model + Effort + Mic / Send */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onOpenModelSheet();
                  }}
                  className="flex items-center gap-2 text-[14px] hover:opacity-80 transition"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100 max-w-[110px] truncate">
                    {currentModelInfo.shortName}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">
                    {settings.reasoningEffort}
                  </span>
                </button>

                {hasSendableInput ? (
                  <button
                    type="button"
                    disabled={isThinking}
                    onClick={onSend}
                    className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center disabled:opacity-40 shadow-xs transition"
                    aria-label="Send message"
                  >
                    {isThinking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4 stroke-[2.4]" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`p-1 rounded-full transition ${
                      isListening
                        ? 'bg-red-500 text-white'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                    aria-label="Voice input"
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5 stroke-[1.8]" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
