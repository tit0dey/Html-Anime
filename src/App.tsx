import React, { useEffect, useRef, useState } from 'react';
import {
  AgentToolStep,
  AppSettings,
  BrainConnector,
  BrainSkill,
  ChatMessage,
  ConversationProject,
  ConversationThread,
  CustomWebhookConnector,
  GeneratedAssetItem,
  MemoryItem,
  RenderedCodeVideoArtifact,
  SynthesizedClip,
  VoiceProfile,
} from './types';
import { runOpenBrainAutonomousAgent } from './services/agentEngine';
import { AttachedDocItem } from './services/ragDocumentEngine';
import {
  addOrUpdateMemory,
  loadMemories,
  saveMemories,
} from './services/memoryEngine';
import { analyzeVocalBiometrics } from './services/voiceCloneEngine';
import {
  loadCustomWebhooks,
  loadSavedConnectors,
  loadSavedSkills,
  saveConnectors,
  saveCustomWebhooks,
  saveSkills,
} from './services/skillsAndConnectors';
import {
  speakWithDeviceFallback,
  syncNativeSystemBars,
  triggerHaptic,
} from './services/nativeBridge';
import { ChatWorkspace } from './components/ChatWorkspace';
import { NavigationDrawer } from './components/NavigationDrawer';
import { AddToChatSheet } from './components/AddToChatSheet';
import { SelectModelSheet } from './components/SelectModelSheet';
import { ProfileSettingsSheet } from './components/ProfileSettingsSheet';
import { AssetsVaultModal } from './components/AssetsVaultModal';
import { PhoneControlModal } from './components/PhoneControlModal';
import { SkillsConnectorsModal } from './components/SkillsConnectorsModal';
import { VoiceLabModal } from './components/VoiceLabModal';
import { MemoryModal } from './components/MemoryModal';

const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Open Brain',
  selectedModel: 'auto',
  reasoningEffort: 'default',
  appearance: 'light',
  responseLanguage: 'en',
  autonomousAgent: true,
  selfVerification: true,
  autoMemory: true,
  autoSpeak: false,
  featherlightEcoMode: true,
  activeVoiceProfileId: '',
  openrouterApiKey: '',
  groqApiKey: '',
  geminiApiKey: '',
  hfToken: '',
  githubToken: '',
  ollamaUrl: '',
};

function createEmptyThread(projectId?: string): ConversationThread {
  return {
    id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'New Chat',
    projectId,
    updatedAt: Date.now(),
    messages: [],
  };
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('openbrain_settings_v4');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [threads, setThreads] = useState<ConversationThread[]>(() => {
    try {
      const raw = localStorage.getItem('openbrain_threads_v4');
      if (raw) {
        const parsed = JSON.parse(raw) as ConversationThread[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return [createEmptyThread()];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    return threads[0]?.id || '';
  });

  const [projects, setProjects] = useState<ConversationProject[]>(() => {
    try {
      const raw = localStorage.getItem('openbrain_projects_v4');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);

  const [memories, setMemories] = useState<MemoryItem[]>(() => loadMemories());

  const [assets, setAssets] = useState<GeneratedAssetItem[]>(() => {
    try {
      const raw = localStorage.getItem('openbrain_assets_v4');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>(() => {
    try {
      const raw = localStorage.getItem('openbrain_voice_profiles_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [skills, setSkills] = useState<BrainSkill[]>(() => loadSavedSkills());
  const [connectors, setConnectors] = useState<BrainConnector[]>(() =>
    loadSavedConnectors()
  );
  const [webhooks, setWebhooks] = useState<CustomWebhookConnector[]>(() =>
    loadCustomWebhooks()
  );

  // Composer & Live Execution State
  const [composerDraft, setComposerDraft] = useState('');
  const [deepResearchActive, setDeepResearchActive] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);
  const [attachedFileName, setAttachedFileName] = useState<string | undefined>(undefined);
  const [attachedFileText, setAttachedFileText] = useState<string | undefined>(undefined);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [liveSteps, setLiveSteps] = useState<AgentToolStep[]>([]);

  // Sheets & Modals State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Theme (Light / Dark / System) + Native Android System Bars
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark =
        settings.appearance === 'dark' ||
        (settings.appearance === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', isDark);
      const meta = document.getElementById('meta-theme-color');
      if (meta) meta.setAttribute('content', isDark ? '#0B0E14' : '#FFFFFF');
      syncNativeSystemBars(isDark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.appearance]);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem('openbrain_settings_v4', JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  // Persist Threads (stripping ephemeral blob: URLs)
  useEffect(() => {
    try {
      const serializable = threads.slice(0, 25).map((t) => ({
        ...t,
        messages: t.messages.slice(-30).map((m) => ({
          ...m,
          attachedImage: undefined,
          codeVideoArtifact: m.codeVideoArtifact?.videoUrl?.startsWith('blob:')
            ? undefined
            : m.codeVideoArtifact,
          voiceClipArtifact: m.voiceClipArtifact?.audioUrl?.startsWith('blob:')
            ? undefined
            : m.voiceClipArtifact,
        })),
      }));
      localStorage.setItem('openbrain_threads_v4', JSON.stringify(serializable));
    } catch {
      // Ignore quota
    }
  }, [threads]);

  useEffect(() => {
    try {
      localStorage.setItem('openbrain_projects_v4', JSON.stringify(projects));
    } catch {
      // Ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      const persistentAssets = assets
        .filter((a) => !a.url?.startsWith('blob:'))
        .slice(0, 30);
      localStorage.setItem('openbrain_assets_v4', JSON.stringify(persistentAssets));
    } catch {
      // Ignore
    }
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'openbrain_voice_profiles_v2',
        JSON.stringify(voiceProfiles.slice(0, 6))
      );
    } catch {
      // Ignore
    }
  }, [voiceProfiles]);

  // Android Native Hardware Back Gesture Handler
  useEffect(() => {
    (window as any).__openBrainBackHandler = () => {
      if (modelSheetOpen) {
        setModelSheetOpen(false);
        return true;
      }
      if (addSheetOpen) {
        setAddSheetOpen(false);
        return true;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (profileOpen) {
        setProfileOpen(false);
        return true;
      }
      if (assetsOpen) {
        setAssetsOpen(false);
        return true;
      }
      if (phoneModalOpen) {
        setPhoneModalOpen(false);
        return true;
      }
      if (skillsModalOpen) {
        setSkillsModalOpen(false);
        return true;
      }
      if (voiceModalOpen) {
        setVoiceModalOpen(false);
        return true;
      }
      if (memoryModalOpen) {
        setMemoryModalOpen(false);
        return true;
      }
      return false;
    };
  }, [
    modelSheetOpen,
    addSheetOpen,
    drawerOpen,
    profileOpen,
    assetsOpen,
    phoneModalOpen,
    skillsModalOpen,
    voiceModalOpen,
    memoryModalOpen,
  ]);

  const activeThread =
    threads.find((t) => t.id === activeThreadId) || threads[0];

  const activeProject = projects.find(
    (p) => p.id === (activeThread?.projectId || activeProjectId)
  );

  const activeVoiceProfile =
    voiceProfiles.find((v) => v.id === settings.activeVoiceProfileId) ||
    voiceProfiles[0];

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveMemoryFact = (
    fact: string,
    category: MemoryItem['category'] = 'preference'
  ): string | undefined => {
    let savedFact: string | undefined;
    setMemories((prev) => {
      const res = addOrUpdateMemory(prev, fact, category);
      if (res.addedItem) savedFact = res.addedItem.fact;
      return res.updated;
    });
    return savedFact || fact;
  };

  const handleNewChat = (projectId?: string) => {
    if (activeThread && activeThread.messages.length === 0) {
      if (projectId !== undefined) {
        setThreads((prev) =>
          prev.map((t) => (t.id === activeThread.id ? { ...t, projectId } : t))
        );
      }
      return;
    }
    const fresh = createEmptyThread(projectId ?? activeProjectId);
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(fresh.id);
    setComposerDraft('');
    setAttachedImage(undefined);
    setAttachedFileName(undefined);
    setAttachedFileText(undefined);
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(String(reader.result));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileOrAudioSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const first = files[0];

    if (
      files.length === 1 &&
      (first.type.startsWith('audio/') || /\.(wav|mp3|m4a|ogg|webm)$/i.test(first.name))
    ) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(first);
        });
        const { durationSec, biometrics } = await analyzeVocalBiometrics(first);
        const vp: VoiceProfile = {
          id: `vp-${Date.now()}`,
          name: first.name.replace(/\.[^.]+$/, ''),
          createdAt: Date.now(),
          audioDataUrl: dataUrl,
          durationSec,
          referenceText: 'Voice sample uploaded in Open Brain chat.',
          biometrics,
        };
        setVoiceProfiles((prev) => [vp, ...prev]);
        updateSettings({ activeVoiceProfileId: vp.id });
        setComposerDraft(
          (prev) =>
            prev || `Speak in my newly cloned voice "${vp.name}": Hello, Open Brain is live!`
        );
      } catch (err: any) {
        alert(`Could not analyze audio file: ${err?.message || String(err)}`);
      }
      e.target.value = '';
      return;
    }

    try {
      const loadedDocs: AttachedDocItem[] = [];
      for (const f of files.slice(0, 20)) {
        const text = await f.text();
        loadedDocs.push({ name: f.name, content: text.slice(0, 600000) });
      }
      setAttachedDocs(loadedDocs);
      setAttachedFileName(
        loadedDocs.length === 1
          ? loadedDocs[0].name
          : `${loadedDocs.length} files (${loadedDocs.map((d) => d.name).join(', ')})`
      );
      setAttachedFileText(loadedDocs[0]?.content.slice(0, 16000));
    } catch {
      alert('Unsupported file format.');
    }
    e.target.value = '';
  };

  const handleSend = async () => {
    const prompt =
      composerDraft.trim() ||
      (attachedImage
        ? 'Analyze this image thoroughly.'
        : attachedFileName
        ? `Analyze the attached file ${attachedFileName}.`
        : '');
    if (!prompt || isThinking || !activeThread) return;

    triggerHaptic(14);
    const threadId = activeThread.id;
    const snapImage = attachedImage;
    const snapFileName = attachedFileName;
    const snapFileText = attachedFileText;
    const snapDocs = attachedDocs;
    const snapDeepResearch = deepResearchActive;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      attachedImage: snapImage,
      attachedFileName: snapFileName,
    };

    const nextHistory = [...activeThread.messages, userMsg];
    const autoTitle =
      activeThread.messages.length === 0
        ? prompt.replace(/\s+/g, ' ').slice(0, 42)
        : activeThread.title;

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              title: autoTitle,
              updatedAt: Date.now(),
              messages: nextHistory,
            }
          : t
      )
    );

    setComposerDraft('');
    setAttachedImage(undefined);
    setAttachedFileName(undefined);
    setAttachedFileText(undefined);
    setAttachedDocs([]);
    setIsThinking(true);
    setLiveSteps([]);

    try {
      const res = await runOpenBrainAutonomousAgent({
        userPrompt: prompt,
        history: activeThread.messages,
        settings,
        skills,
        connectors,
        webhooks,
        voiceProfiles,
        memories,
        forceDeepResearch: snapDeepResearch,
        projectInstructions: activeProject?.instructions,
        attachedImage: snapImage,
        attachedFileText: snapFileText,
        attachedFileName: snapFileName,
        attachedDocs: snapDocs,
        onSaveMemoryFact: handleSaveMemoryFact,
        onStepsChange: (st) => setLiveSteps(st),
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: Date.now(),
        model: settings.selectedModel,
        routedModelLabel: res.routedModelLabel,
        thinkingTrace: res.thinkingTrace,
        sources: res.sources,
        savedMemoryFact: res.savedMemoryFact,
        activeSkillNames: res.activeSkillNames,
        generatedImages: res.generatedImages,
        codeVideoArtifact: res.codeVideoArtifact,
        voiceClipArtifact: res.voiceClipArtifact,
        showVoiceCloneRecorder: res.showVoiceCloneRecorder,
        phoneActions: res.phoneActions,
        codeArtifact: res.codeArtifact,
        svgDiagramArtifact: res.svgDiagramArtifact,
        toolSteps: res.toolSteps,
      };

      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                updatedAt: Date.now(),
                messages: [...t.messages, assistantMsg],
              }
            : t
        )
      );

      // Auto-register any generated creations into Assets Vault
      const newAssets: GeneratedAssetItem[] = [];
      if (res.codeVideoArtifact) {
        newAssets.push({
          id: `vid-${Date.now()}`,
          kind: 'video',
          title: res.codeVideoArtifact.title,
          subtitle: res.codeVideoArtifact.engineLabel || 'MP4 Video',
          url: res.codeVideoArtifact.videoUrl,
          code: res.codeVideoArtifact.code,
          mimeType: res.codeVideoArtifact.mimeType,
          createdAt: Date.now(),
        });
      }
      if (res.voiceClipArtifact) {
        newAssets.push({
          id: res.voiceClipArtifact.id,
          kind: 'voice',
          title: res.voiceClipArtifact.text.slice(0, 48),
          subtitle: res.voiceClipArtifact.voiceName,
          url: res.voiceClipArtifact.audioUrl,
          mimeType: 'audio/wav',
          createdAt: Date.now(),
        });
      }
      if (res.generatedImages.length > 0) {
        for (const imgUrl of res.generatedImages) {
          newAssets.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            kind: 'image',
            title: prompt.slice(0, 48),
            subtitle: 'Flux.1 Studio HD',
            url: imgUrl,
            mimeType: 'image/jpeg',
            createdAt: Date.now(),
          });
        }
      }
      if (res.codeArtifact) {
        newAssets.push({
          id: `app-${Date.now()}`,
          kind: 'app',
          title: res.codeArtifact.title,
          subtitle: 'Interactive HTML5 App',
          html: res.codeArtifact.html,
          mimeType: 'text/html',
          createdAt: Date.now(),
        });
      }
      if (newAssets.length > 0) {
        setAssets((prev) => [...newAssets, ...prev]);
      }

      if (settings.autoSpeak) {
        speakWithDeviceFallback(res.reply, 'en-US');
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Could not complete request right now: ${
          err?.message || String(err)
        }`,
        timestamp: Date.now(),
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, messages: [...t.messages, errMsg] } : t
        )
      );
    } finally {
      setIsThinking(false);
      setLiveSteps([]);
    }
  };

  const handleSaveVoiceProfile = (vp: VoiceProfile) => {
    setVoiceProfiles((prev) => [vp, ...prev]);
    updateSettings({ activeVoiceProfileId: vp.id });
  };

  const handleDeleteVoiceProfile = (id: string) => {
    setVoiceProfiles((prev) => prev.filter((p) => p.id !== id));
    if (settings.activeVoiceProfileId === id) {
      updateSettings({ activeVoiceProfileId: '' });
    }
  };

  const handleGeneratedVoiceClipFromLab = (clip: SynthesizedClip) => {
    setAssets((prev) => [
      {
        id: clip.id,
        kind: 'voice',
        title: clip.text.slice(0, 48),
        subtitle: clip.voiceName,
        url: clip.audioUrl,
        mimeType: 'audio/wav',
        createdAt: Date.now(),
      },
      ...prev,
    ]);
  };

  const handleUpdateVideoArtifact = (
    msgId: string,
    updated: RenderedCodeVideoArtifact
  ) => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === msgId ? { ...m, codeVideoArtifact: updated } : m
              ),
            }
          : t
      )
    );
  };

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelected}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.py,.java,.kt,.html,.css,.sql,.xml,.log,audio/*"
        onChange={handleFileOrAudioSelected}
        className="hidden"
      />

      <ChatWorkspace
        threadTitle={activeThread?.title || 'New Chat'}
        messages={activeThread?.messages || []}
        liveSteps={liveSteps}
        isThinking={isThinking}
        settings={settings}
        voiceProfiles={voiceProfiles}
        activeProjectName={activeProject?.name}
        deepResearchActive={deepResearchActive}
        composerDraft={composerDraft}
        attachedImage={attachedImage}
        attachedFileName={attachedFileName}
        onChangeDraft={setComposerDraft}
        onClearAttachments={() => {
          setAttachedImage(undefined);
          setAttachedFileName(undefined);
          setAttachedFileText(undefined);
          setAttachedDocs([]);
        }}
        onClearDeepResearch={() => setDeepResearchActive(false)}
        onSend={handleSend}
        onOpenDrawer={() => setDrawerOpen(true)}
        onNewChat={() => handleNewChat()}
        onOpenAddSheet={() => setAddSheetOpen(true)}
        onOpenModelSheet={() => setModelSheetOpen(true)}
        onOpenPhoneControl={() => setPhoneModalOpen(true)}
        onSaveVoiceProfile={handleSaveVoiceProfile}
        onSelectVoiceProfile={(id) => updateSettings({ activeVoiceProfileId: id })}
        onUpdateVideoArtifact={handleUpdateVideoArtifact}
      />

      <NavigationDrawer
        open={drawerOpen}
        userName={settings.userName}
        threads={threads.filter((t) => t.messages.length > 0)}
        activeThreadId={activeThread?.id || ''}
        projects={projects}
        activeProjectId={activeProjectId}
        assetsCount={assets.length}
        onClose={() => setDrawerOpen(false)}
        onNewChat={(projId) => handleNewChat(projId)}
        onSelectThread={(id) => setActiveThreadId(id)}
        onTogglePinThread={(id) =>
          setThreads((prev) =>
            prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))
          )
        }
        onDeleteThread={(id) => {
          const remaining = threads.filter((t) => t.id !== id);
          if (remaining.length === 0) {
            const fresh = createEmptyThread();
            setThreads([fresh]);
            setActiveThreadId(fresh.id);
          } else {
            setThreads(remaining);
            if (activeThreadId === id) setActiveThreadId(remaining[0].id);
          }
        }}
        onCreateProject={(name, instructions) => {
          const p: ConversationProject = {
            id: `proj-${Date.now()}`,
            name,
            instructions,
            createdAt: Date.now(),
          };
          setProjects((prev) => [p, ...prev]);
          setActiveProjectId(p.id);
        }}
        onSelectProject={(id) => setActiveProjectId(id)}
        onOpenPhoneControl={() => setPhoneModalOpen(true)}
        onOpenAssets={() => setAssetsOpen(true)}
        onOpenSkillsMore={() => setSkillsModalOpen(true)}
        onOpenProfileSettings={() => setProfileOpen(true)}
      />

      <AddToChatSheet
        open={addSheetOpen}
        deepResearchActive={deepResearchActive}
        memoriesCount={memories.length}
        activeSkillsCount={skills.filter((s) => s.enabled).length}
        activeConnectorsCount={connectors.filter((c) => c.enabled).length}
        activeVoiceName={activeVoiceProfile?.name}
        onClose={() => setAddSheetOpen(false)}
        onToggleDeepResearch={() => setDeepResearchActive((v) => !v)}
        onPickGalleryImage={() => galleryInputRef.current?.click()}
        onPickCameraPhoto={() => cameraInputRef.current?.click()}
        onPickFileOrAudio={() => fileInputRef.current?.click()}
        onOpenSkillsModal={() => setSkillsModalOpen(true)}
        onOpenMemoryModal={() => setMemoryModalOpen(true)}
        onOpenVoiceLabModal={() => setVoiceModalOpen(true)}
        onOpenPhoneModal={() => setPhoneModalOpen(true)}
        onQuickPrompt={(p) => setComposerDraft(p)}
      />

      <SelectModelSheet
        open={modelSheetOpen}
        selectedModel={settings.selectedModel}
        effort={settings.reasoningEffort}
        onSelectModel={(modelId) => updateSettings({ selectedModel: modelId })}
        onSelectEffort={(eff) => updateSettings({ reasoningEffort: eff })}
        onClose={() => setModelSheetOpen(false)}
      />

      <ProfileSettingsSheet
        open={profileOpen}
        settings={settings}
        memoriesCount={memories.length}
        onUpdateSettings={updateSettings}
        onOpenSkillsModal={() => setSkillsModalOpen(true)}
        onOpenMemoryModal={() => setMemoryModalOpen(true)}
        onOpenVoiceModal={() => setVoiceModalOpen(true)}
        onClearHistory={() => {
          const fresh = createEmptyThread();
          setThreads([fresh]);
          setActiveThreadId(fresh.id);
        }}
        onClose={() => setProfileOpen(false)}
      />

      <AssetsVaultModal
        open={assetsOpen}
        assets={assets}
        onDeleteAsset={(id) => setAssets((prev) => prev.filter((a) => a.id !== id))}
        onClose={() => setAssetsOpen(false)}
      />

      <PhoneControlModal
        open={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        onSendChatPrompt={(p) => setComposerDraft(p)}
      />

      <SkillsConnectorsModal
        open={skillsModalOpen}
        settings={settings}
        skills={skills}
        connectors={connectors}
        webhooks={webhooks}
        onChangeSkills={(next) => {
          setSkills(next);
          saveSkills(next);
        }}
        onChangeConnectors={(next) => {
          setConnectors(next);
          saveConnectors(next);
        }}
        onChangeWebhooks={(next) => {
          setWebhooks(next);
          saveCustomWebhooks(next);
        }}
        onClose={() => setSkillsModalOpen(false)}
      />

      <VoiceLabModal
        open={voiceModalOpen}
        settings={settings}
        profiles={voiceProfiles}
        onSaveProfile={handleSaveVoiceProfile}
        onDeleteProfile={handleDeleteVoiceProfile}
        onSelectProfile={(id) => updateSettings({ activeVoiceProfileId: id })}
        onGeneratedClip={handleGeneratedVoiceClipFromLab}
        onClose={() => setVoiceModalOpen(false)}
      />

      <MemoryModal
        open={memoryModalOpen}
        memories={memories}
        autoMemory={settings.autoMemory !== false}
        onToggleAutoMemory={(enabled) => updateSettings({ autoMemory: enabled })}
        onAddMemory={(fact, cat) => {
          handleSaveMemoryFact(fact, cat);
        }}
        onDeleteMemory={(id) => {
          const next = memories.filter((m) => m.id !== id);
          setMemories(next);
          saveMemories(next);
        }}
        onClose={() => setMemoryModalOpen(false)}
      />
    </>
  );
}

export default App;
