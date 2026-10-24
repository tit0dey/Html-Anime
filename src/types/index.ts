export type ReasoningEffort = 'fast' | 'default' | 'high' | 'max';

export type AppearanceMode = 'light' | 'dark' | 'system';

export type ResponseLanguageMode = 'auto' | 'en';

export interface LLMModelInfo {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  badge: string;
  description: string;
  supportsVision?: boolean;
}

export interface MemoryItem {
  id: string;
  fact: string;
  category: 'profile' | 'preference' | 'project' | 'instruction';
  createdAt: number;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface BrainSkill {
  id: string;
  name: string;
  icon: string;
  category: 'video' | 'phone' | 'research' | 'coding' | 'voice' | 'creator' | 'custom';
  description: string;
  instructions: string;
  enabled: boolean;
  builtIn?: boolean;
}

export interface BrainConnector {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  enabled: boolean;
  authOptional?: boolean;
  configLabel?: string;
  configValue?: string;
}

export interface CustomWebhookConnector {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  description: string;
  enabled: boolean;
}

export interface PhoneActionPayload {
  action:
    | 'set_alarm'
    | 'set_timer'
    | 'dial_number'
    | 'send_whatsapp'
    | 'send_sms'
    | 'add_calendar'
    | 'open_maps'
    | 'open_youtube'
    | 'open_settings'
    | 'send_email'
    | 'battery_status'
    | 'copy_clipboard';
  label: string;
  params: Record<string, string | number>;
  executedResult?: string;
}

export interface AgentToolStep {
  id: string;
  tool:
    | 'smart_router'
    | 'moa_council'
    | 'self_critic'
    | 'deep_research'
    | 'rag_retriever'
    | 'read_url'
    | 'code_interpreter'
    | 'svg_diagram'
    | 'save_memory'
    | 'web_search'
    | 'github_search'
    | 'weather_live'
    | 'crypto_market'
    | 'js_sandbox'
    | 'generate_image'
    | 'arxiv_research'
    | 'reddit_hn_pulse'
    | 'mini_app'
    | 'code_video_mp4'
    | 'cinema_video_mp4'
    | 'voice_clone_tts'
    | 'phone_action'
    | 'custom_webhook';
  title: string;
  query: string;
  status: 'running' | 'done' | 'error';
  resultSummary?: string;
  durationMs?: number;
}

export interface RenderedCodeVideoArtifact {
  title: string;
  videoUrl: string;
  mimeType: string;
  code?: string;
  engineLabel?: string;
  durationSec: number;
  width: number;
  height: number;
}

export interface VocalBiometrics {
  pitchHz: number;
  warmth: number;
  brightness: number;
  paceFactor: number;
  timbreLabel: string;
  recommendedBaseVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}

export interface VoiceProfile {
  id: string;
  name: string;
  createdAt: number;
  audioDataUrl: string;
  durationSec: number;
  referenceText: string;
  biometrics: VocalBiometrics;
}

export interface SynthesizedClip {
  id: string;
  text: string;
  voiceName: string;
  engineUsed: string;
  audioUrl: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  routedModelLabel?: string;
  thinkingTrace?: string;
  sources?: ResearchSource[];
  savedMemoryFact?: string;
  activeSkillNames?: string[];
  attachedImage?: string;
  attachedFileName?: string;
  generatedImages?: string[];
  codeVideoArtifact?: RenderedCodeVideoArtifact;
  voiceClipArtifact?: SynthesizedClip;
  showVoiceCloneRecorder?: boolean;
  phoneActions?: PhoneActionPayload[];
  codeArtifact?: {
    title: string;
    html: string;
  };
  svgDiagramArtifact?: {
    title: string;
    svg: string;
  };
  toolSteps?: AgentToolStep[];
}

export interface ConversationProject {
  id: string;
  name: string;
  instructions: string;
  createdAt: number;
}

export interface ConversationThread {
  id: string;
  title: string;
  pinned?: boolean;
  projectId?: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface GeneratedAssetItem {
  id: string;
  kind: 'video' | 'voice' | 'image' | 'app';
  title: string;
  subtitle?: string;
  url?: string;
  html?: string;
  code?: string;
  mimeType?: string;
  createdAt: number;
}

export type VideoEngineType = 'claude-code-mp4' | 'cinema-director' | 'hf-wan-diffusion';

export interface VideoScene {
  index: number;
  visualPrompt: string;
  narration: string;
  subtitle: string;
  imageUrl?: string;
  motion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
}

export interface VideoGenerationItem {
  id: string;
  prompt: string;
  engine: VideoEngineType;
  aspectRatio: '9:16' | '16:9' | '1:1';
  durationSec: number;
  status: 'generating' | 'ready' | 'error';
  progress: number;
  statusMessage: string;
  videoUrl?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  generatedCode?: string;
  scenes?: VideoScene[];
  spaceUsed?: string;
  createdAt: number;
}

export interface GeneratedImageItem {
  id: string;
  prompt: string;
  model: 'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo';
  aspectRatio: '1:1' | '9:16' | '16:9';
  width: number;
  height: number;
  seed: number;
  url: string;
  createdAt: number;
}

export interface AppSettings {
  userName: string;
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  appearance: AppearanceMode;
  responseLanguage: ResponseLanguageMode;
  autonomousAgent: boolean;
  selfVerification: boolean;
  autoMemory: boolean;
  autoSpeak: boolean;
  featherlightEcoMode: boolean;
  activeVoiceProfileId: string;
  openrouterApiKey: string;
  groqApiKey: string;
  geminiApiKey: string;
  hfToken: string;
  githubToken: string;
  ollamaUrl: string;
}
