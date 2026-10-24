import React, { useEffect, useState } from 'react';
import {
  AudioWaveform,
  Blocks,
  Brain,
  Clapperboard,
  Code2,
  Download,
  Image as ImageIcon,
  Smartphone,
} from 'lucide-react';
import {
  AppSettings,
  AppTab,
  BrainConnector,
  BrainSkill,
  CustomWebhookConnector,
} from './types';
import { AgentStudio } from './components/AgentStudio';
import { SkillsConnectorsHub } from './components/SkillsConnectorsHub';
import { VideoStudio } from './components/VideoStudio';
import { VoiceCloneStudio } from './components/VoiceCloneStudio';
import { ImageStudio } from './components/ImageStudio';
import { CodeBuilderStudio } from './components/CodeBuilderStudio';
import { ApkAndSettingsHub } from './components/ApkAndSettingsHub';
import { isRunningInAndroidApk, triggerHaptic } from './services/nativeBridge';
import {
  loadCustomWebhooks,
  loadSavedConnectors,
  loadSavedSkills,
  saveConnectors,
  saveCustomWebhooks,
  saveSkills,
} from './services/skillsAndConnectors';

const DEFAULT_SETTINGS: AppSettings = {
  selectedModel: 'openai',
  autonomousAgent: true,
  autoSpeak: false,
  featherlightEcoMode: true,
  language: 'banglish',
  groqApiKey: '',
  geminiApiKey: '',
  hfToken: '',
  githubToken: '',
  ollamaUrl: '',
};

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  accent: string;
}> = [
  { id: 'agent', label: 'Open Brain Agent', shortLabel: 'Brain', icon: Brain, accent: 'text-violet-400' },
  { id: 'skills', label: 'Skills & Connectors', shortLabel: 'Skills', icon: Blocks, accent: 'text-cyan-400' },
  { id: 'video', label: 'MP4 Video Sandbox', shortLabel: 'MP4', icon: Clapperboard, accent: 'text-fuchsia-400' },
  { id: 'voice', label: 'Voice Cloning', shortLabel: 'Voice', icon: AudioWaveform, accent: 'text-sky-400' },
  { id: 'image', label: 'Flux Art Studio', shortLabel: 'Art', icon: ImageIcon, accent: 'text-emerald-400' },
  { id: 'code', label: 'App Builder', shortLabel: 'Code', icon: Code2, accent: 'text-amber-400' },
  { id: 'apk', label: 'Android APK & Eco', shortLabel: 'APK', icon: Smartphone, accent: 'text-teal-400' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('agent');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem('openbrain_settings_v2');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [skills, setSkills] = useState<BrainSkill[]>(() => loadSavedSkills());
  const [connectors, setConnectors] = useState<BrainConnector[]>(() =>
    loadSavedConnectors()
  );
  const [webhooks, setWebhooks] = useState<CustomWebhookConnector[]>(() =>
    loadCustomWebhooks()
  );

  useEffect(() => {
    try {
      localStorage.setItem('openbrain_settings_v2', JSON.stringify(settings));
    } catch {
      // Ignore
    }
    if (settings.featherlightEcoMode) {
      document.body.classList.remove('fx-rich');
    } else {
      document.body.classList.add('fx-rich');
    }
  }, [settings]);

  useEffect(() => {
    (window as any).__openBrainBackHandler = () => {
      if (activeTab !== 'agent') {
        setActiveTab('agent');
        return true;
      }
      return false;
    };
  }, [activeTab]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleChangeSkills = (next: BrainSkill[]) => {
    setSkills(next);
    saveSkills(next);
  };

  const handleChangeConnectors = (next: BrainConnector[]) => {
    setConnectors(next);
    saveConnectors(next);
  };

  const handleChangeWebhooks = (next: CustomWebhookConnector[]) => {
    setWebhooks(next);
    saveCustomWebhooks(next);
  };

  const inApk = isRunningInAndroidApk();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row max-w-7xl mx-auto">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 p-4 flex-col justify-between">
        <div className="glass-card rounded-3xl p-4 space-y-5 h-full flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3 px-1">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-lg tracking-tight text-white">
                  Open <span className="text-cyan-400">Brain</span>
                </h1>
                <p className="text-[11px] text-emerald-400 font-semibold">
                  Free • Unlimited • Zero-Load
                </p>
              </div>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setActiveTab(item.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition ${
                      active
                        ? 'bg-gradient-to-r from-violet-600/30 to-cyan-500/20 text-white border border-violet-500/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? item.accent : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {!inApk && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-cyan-950/60 border border-emerald-500/30 space-y-2">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" /> Featherlight Android APK
              </div>
              <p className="text-[11px] text-slate-300">
                ~200 KB signed APK • Zero phone lag • Full Phone OS control!
              </p>
              <a
                href="./OpenBrain-AI.apk"
                download="OpenBrain-AI.apk"
                className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download OpenBrain APK
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 px-3 pt-2.5 pb-1.5 bg-[#06080F]/95 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white leading-tight">
                Open <span className="text-cyan-400">Brain</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                Zero-Pressure AI Super-Agent
              </div>
            </div>
          </div>

          {!inApk ? (
            <a
              href="./OpenBrain-AI.apk"
              download="OpenBrain-AI.apk"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-[11px] font-extrabold text-slate-950 flex items-center gap-1 shadow"
            >
              <Download className="w-3.5 h-3.5" /> Get APK
            </a>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
              📱 Native Zero-Load
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-3 sm:px-4 md:py-4 pt-2 pb-20 md:pb-4 min-w-0">
        {activeTab === 'agent' && (
          <AgentStudio
            settings={settings}
            skills={skills}
            connectors={connectors}
            webhooks={webhooks}
            onUpdateSettings={updateSettings}
            onOpenSkillsHub={() => setActiveTab('skills')}
          />
        )}
        {activeTab === 'skills' && (
          <SkillsConnectorsHub
            settings={settings}
            skills={skills}
            connectors={connectors}
            webhooks={webhooks}
            onChangeSkills={handleChangeSkills}
            onChangeConnectors={handleChangeConnectors}
            onChangeWebhooks={handleChangeWebhooks}
            onUpdateSettings={updateSettings}
          />
        )}
        {activeTab === 'video' && <VideoStudio settings={settings} />}
        {activeTab === 'voice' && <VoiceCloneStudio settings={settings} />}
        {activeTab === 'image' && <ImageStudio settings={settings} />}
        {activeTab === 'code' && <CodeBuilderStudio settings={settings} />}
        {activeTab === 'apk' && (
          <ApkAndSettingsHub settings={settings} onUpdateSettings={updateSettings} />
        )}
      </main>

      {/* Mobile Bottom Dock (7 crisp icons) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#070A12] border-t border-slate-800/80 px-1 py-1.5 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-7 gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
                  active ? 'bg-violet-600/20 text-white' : 'text-slate-400'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? item.accent : 'text-slate-500'}`} />
                <span className="text-[9.5px] font-semibold mt-0.5">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
