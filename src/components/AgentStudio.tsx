import React, { useEffect, useRef, useState } from 'react';
import {
  Blocks,
  Brain,
  Camera,
  Check,
  Clapperboard,
  CloudSun,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Film,
  Gamepad2,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Plug,
  Send,
  Smartphone,
  Trash2,
  Volume2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AgentToolStep,
  AppSettings,
  BrainConnector,
  BrainSkill,
  ChatMessage,
  CustomWebhookConnector,
} from '../types';
import { FREE_LLM_MODELS } from '../services/llmEngine';
import { runOpenBrainAutonomousAgent } from '../services/agentEngine';
import {
  executePhoneAction,
  saveFileCrossPlatform,
  speakWithDeviceFallback,
  triggerHaptic,
} from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onOpenSkillsHub: () => void;
}

const QUICK_PROMPTS = [
  {
    icon: Film,
    label: 'Claude-Style Code to MP4 Video',
    prompt:
      'Write animation code and render an MP4 video explaining our Solar System with glowing orbiting planets and labels.',
  },
  {
    icon: Smartphone,
    label: 'Phone Battery and Morning Alarm',
    prompt: 'Check my phone battery status and set a 7:00 AM morning wake-up alarm.',
  },
  {
    icon: CloudSun,
    label: 'Live Weather and Crypto Markets',
    prompt: 'Check live weather in Kolkata right now and live Bitcoin and Solana prices in INR and USD.',
  },
  {
    icon: Gamepad2,
    label: 'Build Playable Arcade Game',
    prompt: 'Build a playable neon brick-breaker arcade mini-game in HTML5 with mobile touch controls.',
  },
];

function FormattedMessageContent({ content }: { content: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-[14.5px] leading-relaxed break-words">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0]?.trim() || 'code';
          const code = lines.slice(1).join('\n');
          return (
            <div
              key={idx}
              className="rounded-xl overflow-hidden border border-slate-700/80 bg-[#04090D] my-2"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-mono uppercase tracking-wider text-teal-400">{lang}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(code);
                    setCopiedIdx(idx);
                    setTimeout(() => setCopiedIdx(null), 1800);
                  }}
                  className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                >
                  {copiedIdx === idx ? (
                    <Check className="w-3.5 h-3.5 text-teal-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-teal-400" />
                  )}
                  {copiedIdx === idx ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-xs font-mono text-teal-100/95 leading-relaxed">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={idx} className="whitespace-pre-wrap">
            {part.split('\n').map((line, lIdx) => {
              if (line.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-bold text-base text-teal-200 mt-2 mb-1">
                    {line.slice(4)}
                  </h4>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="font-bold text-lg text-teal-300 mt-2.5 mb-1">
                    {line.slice(3)}
                  </h3>
                );
              }
              if (line.startsWith('> ')) {
                return (
                  <div
                    key={lIdx}
                    className="border-l-2 border-teal-500/70 pl-3 py-0.5 text-xs text-slate-300/90 italic bg-teal-950/20 rounded-r"
                  >
                    {line.slice(2)}
                  </div>
                );
              }
              const boldSegments = line.split(/(\*\*.*?\*\*)/g);
              return (
                <React.Fragment key={lIdx}>
                  {boldSegments.map((seg, sIdx) =>
                    seg.startsWith('**') && seg.endsWith('**') ? (
                      <strong key={sIdx} className="font-semibold text-white">
                        {seg.slice(2, -2)}
                      </strong>
                    ) : (
                      <span key={sIdx}>{seg}</span>
                    )
                  )}
                  {lIdx < part.split('\n').length - 1 ? '\n' : ''}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const AgentStudio: React.FC<Props> = ({
  settings,
  skills,
  connectors,
  webhooks,
  onUpdateSettings,
  onOpenSkillsHub,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('openbrain_chat_v3');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [
      {
        id: 'welcome-openbrain-v3',
        role: 'assistant',
        timestamp: Date.now(),
        model: 'Open Brain Super-Core',
        content:
          'Welcome to **Open Brain** — your **100% Free, Unlimited & Zero-Phone-Pressure AI Super-Agent**.\n\nEverything is ready out of the box:\n- **Code to Sandbox MP4 Video**: Ask for any animation or explainer video and Open Brain writes programmatic Canvas2D code, executes it in Sandbox, and renders a real **`.mp4` video**.\n- **Modular Skills & Live Connectors**: Attach custom `SKILL.md` skills and connect GitHub, Live Web, Weather, Crypto Markets, Research Papers, and Webhooks.\n- **Full Android Phone Control**: Control system Alarms, Timers, WhatsApp, SMS, Dialer, Maps, Calendar, YouTube, Settings, and Battery directly.\n- **Universal Multilingual Input**: Message Open Brain in **any language** (English, Banglish, Bengali, Hindi, or any global language) — it understands everything seamlessly.',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [liveSteps, setLiveSteps] = useState<AgentToolStep[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [expandedCodeMsgId, setExpandedCodeMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeSkillsCount = skills.filter((s) => s.enabled).length;
  const activeConnCount =
    connectors.filter((c) => c.enabled).length + webhooks.filter((w) => w.enabled).length;

  useEffect(() => {
    try {
      const slim = messages.slice(-24).map((m) => ({
        ...m,
        codeVideoArtifact: undefined,
      }));
      localStorage.setItem('openbrain_chat_v3', JSON.stringify(slim));
    } catch {
      // Ignore
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveSteps]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleVoiceInput = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech dictation is unavailable in this view. Use the Voice Clone tab for microphone recording.');
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const sendMessage = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if ((!promptText && !attachedImage) || isRunning) return;

    triggerHaptic(14);
    const currentImage = attachedImage;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: promptText || 'Analyze this image in detail.',
      timestamp: Date.now(),
      attachedImage: currentImage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedImage(undefined);
    setIsRunning(true);
    setLiveSteps([]);

    try {
      const result = await runOpenBrainAutonomousAgent({
        userPrompt: userMsg.content,
        history: messages,
        settings,
        skills,
        connectors,
        webhooks,
        attachedImage: currentImage,
        onStepsChange: (updated) => setLiveSteps([...updated]),
      });

      const modelMeta =
        FREE_LLM_MODELS.find((m) => m.id === settings.selectedModel)?.name ||
        settings.selectedModel;

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
        model: modelMeta,
        activeSkillNames: result.activeSkillNames,
        generatedImages: result.generatedImages.length ? result.generatedImages : undefined,
        codeVideoArtifact: result.codeVideoArtifact,
        phoneActions: result.phoneActions.length ? result.phoneActions : undefined,
        codeArtifact: result.codeArtifact,
        toolSteps: result.toolSteps.length ? result.toolSteps : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (settings.autoSpeak) {
        speakWithDeviceFallback(result.reply, 'en-US');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Network retry needed: ${err?.message || String(err)}. Please tap Send again.`,
          timestamp: Date.now(),
          model: 'Open Brain',
        },
      ]);
    } finally {
      setIsRunning(false);
      setLiveSteps([]);
    }
  };

  const clearHistory = () => {
    triggerHaptic(18);
    localStorage.removeItem('openbrain_chat_v3');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        timestamp: Date.now(),
        model: 'Open Brain Super-Core',
        content: 'Conversation cleared. Open Brain is ready — message me in any language.',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.6rem)] md:h-[calc(100dvh-2.5rem)]">
      {/* Top Control Bar */}
      <div className="glass-card rounded-2xl p-2.5 mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[185px]">
          <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/35 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-teal-400" />
          </div>
          <select
            value={settings.selectedModel}
            onChange={(e) => onUpdateSettings({ selectedModel: e.target.value })}
            aria-label="Select Free AI Model"
            className="bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-100 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-teal-500 flex-1 max-w-xs"
          >
            {FREE_LLM_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} [{m.badge}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenSkillsHub}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-teal-950/40 border border-teal-500/40 text-teal-200 hover:bg-teal-900/40"
          >
            <Blocks className="w-3.5 h-3.5 text-teal-400" />
            {activeSkillsCount} Skills
            <span className="text-slate-600">|</span>
            <Plug className="w-3.5 h-3.5 text-teal-400" />
            {activeConnCount} Connectors
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ autonomousAgent: !settings.autonomousAgent })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
              settings.autonomousAgent
                ? 'bg-teal-500/20 border-teal-500/50 text-teal-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-teal-400" />
            Auto
          </button>

          <button
            type="button"
            onClick={clearHistory}
            title="Clear Chat"
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-teal-400 hover:text-teal-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {messages.length <= 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
            {QUICK_PROMPTS.map((q) => {
              const QIcon = q.icon;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => sendMessage(q.prompt)}
                  className="text-left p-3 rounded-xl glass-card hover:border-teal-500/50 transition group"
                >
                  <div className="text-xs font-semibold text-teal-300 group-hover:text-teal-200 flex items-center gap-2">
                    <QIcon className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>{q.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-1">{q.prompt}</div>
                </button>
              );
            })}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[94%] sm:max-w-[85%] rounded-2xl px-3.5 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-br-sm shadow-md'
                  : 'glass-card text-slate-100 rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300">
                    <Brain className="w-3.5 h-3.5 text-teal-400" />
                    <span>{msg.model || 'Open Brain'}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      ZERO-LOAD
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => speakWithDeviceFallback(msg.content, 'en-US')}
                      title="Read Aloud"
                      className="p-1 rounded hover:bg-slate-800 text-teal-400 hover:text-teal-300"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(msg.content)}
                      title="Copy Reply"
                      className="p-1 rounded hover:bg-slate-800 text-teal-400 hover:text-teal-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {msg.attachedImage && (
                <img
                  src={msg.attachedImage}
                  alt="Attached visual"
                  className="max-h-52 rounded-xl mb-2 border border-white/20 object-cover"
                />
              )}

              {msg.toolSteps && msg.toolSteps.length > 0 && (
                <div className="mb-2.5 space-y-1.5">
                  {msg.toolSteps.map((st) => (
                    <div
                      key={st.id}
                      className="rounded-xl bg-slate-950/85 border border-slate-800 px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium text-teal-300">
                          <Wrench className="w-3 h-3 text-teal-400" />
                          {st.title}
                        </span>
                        <span className="text-[10px] text-teal-400 font-mono">
                          {st.durationMs ? `${st.durationMs}ms` : 'DONE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{st.query}</div>
                    </div>
                  ))}
                </div>
              )}

              <FormattedMessageContent content={msg.content} />

              {/* Phone OS Action Cards */}
              {msg.phoneActions && msg.phoneActions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.phoneActions.map((pa, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-teal-950/25 border border-teal-500/40 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-teal-300 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-teal-400" />
                          <span>Phone Action: {pa.label}</span>
                        </div>
                        {pa.executedResult && (
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            {pa.executedResult}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => executePhoneAction(pa)}
                        className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                      >
                        Run Again
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Claude-Style Code -> Sandbox Rendered MP4 Video Artifact */}
              {msg.codeVideoArtifact && (
                <div className="mt-3 rounded-xl overflow-hidden border border-teal-500/45 bg-slate-950 space-y-2 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-200 flex items-center gap-1.5">
                      <Clapperboard className="w-4 h-4 text-teal-400" />
                      Sandbox Rendered MP4 ({msg.codeVideoArtifact.width}x{msg.codeVideoArtifact.height})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCodeMsgId(
                            expandedCodeMsgId === msg.id ? null : msg.id
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-teal-300 font-semibold"
                      >
                        {expandedCodeMsgId === msg.id ? 'Hide Code' : 'View JS Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveFileCrossPlatform(
                            msg.codeVideoArtifact!.videoUrl,
                            `OpenBrain-Video-${Date.now()}.mp4`,
                            msg.codeVideoArtifact!.mimeType || 'video/mp4'
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-[11px] font-bold text-slate-950"
                      >
                        <Download className="w-3.5 h-3.5" /> Save .mp4
                      </button>
                    </div>
                  </div>

                  <video
                    src={msg.codeVideoArtifact.videoUrl}
                    controls
                    playsInline
                    autoPlay
                    loop
                    className="w-full max-h-80 rounded-lg bg-black"
                  />

                  {expandedCodeMsgId === msg.id && (
                    <pre className="p-2.5 max-h-48 overflow-auto rounded-lg bg-[#04090D] border border-slate-800 text-[11px] font-mono text-teal-200">
                      <code>{msg.codeVideoArtifact.code}</code>
                    </pre>
                  )}
                </div>
              )}

              {/* Inline Flux Images */}
              {msg.generatedImages && msg.generatedImages.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2.5">
                  {msg.generatedImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-slate-700/70 bg-slate-950"
                    >
                      <img
                        src={imgUrl}
                        alt="Generated Art"
                        loading="lazy"
                        className="w-full max-h-80 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          saveFileCrossPlatform(
                            imgUrl,
                            `OpenBrain-Flux-${Date.now()}.jpg`,
                            'image/jpeg'
                          )
                        }
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 text-xs font-semibold text-teal-300 border border-teal-500/40 hover:bg-teal-600 hover:text-white"
                      >
                        <Download className="w-3.5 h-3.5" /> Save HD
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Playable HTML5 App */}
              {msg.codeArtifact && (
                <div className="mt-3 rounded-xl overflow-hidden border border-teal-500/40 bg-slate-950">
                  <div className="flex items-center justify-between px-3 py-2 bg-teal-950/40 border-b border-teal-500/30 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-teal-200">
                      <Code2 className="w-4 h-4 text-teal-400" />
                      Live App: {msg.codeArtifact.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        saveFileCrossPlatform(
                          new Blob([msg.codeArtifact!.html], { type: 'text/html' }),
                          `OpenBrainApp-${Date.now()}.html`,
                          'text/html'
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                    >
                      <ExternalLink className="w-3 h-3" /> Save App
                    </button>
                  </div>
                  <iframe
                    title={msg.codeArtifact.title}
                    srcDoc={msg.codeArtifact.html}
                    sandbox="allow-scripts"
                    className="w-full h-72 bg-slate-950 border-0"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="flex justify-start">
            <div className="glass-card rounded-2xl px-4 py-3 max-w-[88%] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Open Brain Cortex Executing...</span>
              </div>
              {liveSteps.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 text-xs bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5"
                >
                  <Globe
                    className={`w-3.5 h-3.5 text-teal-400 ${
                      st.status === 'running' ? 'animate-spin' : ''
                    }`}
                  />
                  <span className="text-slate-200">{st.title}:</span>
                  <span className="text-slate-400 truncate max-w-[180px]">{st.query}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Multimodal Input Bar */}
      <div className="glass-card rounded-2xl p-2 mt-1 border border-slate-800">
        {attachedImage && (
          <div className="relative inline-block mb-2 ml-1">
            <img
              src={attachedImage}
              alt="Preview"
              className="h-16 w-16 rounded-xl object-cover border border-teal-500"
            />
            <button
              type="button"
              onClick={() => setAttachedImage(undefined)}
              className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-teal-500 text-teal-300 rounded-full p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Photo for Vision"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 shrink-0"
          >
            <Camera className="w-4 h-4 text-teal-400" />
          </button>

          <button
            type="button"
            onClick={toggleVoiceInput}
            title="Voice Dictation"
            className={`p-2.5 rounded-xl border shrink-0 transition ${
              isListening
                ? 'bg-teal-500/25 border-teal-400 text-teal-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800'
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-teal-300" />
            ) : (
              <Mic className="w-4 h-4 text-teal-400" />
            )}
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder="Message Open Brain in any language (render MP4 video, control phone, research, code)..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 px-2 py-2 focus:outline-none resize-none max-h-28"
          />

          <button
            type="button"
            disabled={isRunning || (!input.trim() && !attachedImage)}
            onClick={() => sendMessage()}
            className="p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-95 disabled:opacity-40 text-slate-950 font-bold shadow shrink-0 flex items-center gap-1"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
