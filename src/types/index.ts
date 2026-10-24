export type AppTab =
  | 'agent'
  | 'skills'
  | 'video'
  | 'voice'
  | 'image'
  | 'code'
  | 'apk';

export type LanguageMode = 'banglish' | 'en' | 'bn';

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: string;
  badge: string;
  description: string;
  supportsVision?: boolean;
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
  code: string;
  durationSec: number;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  activeSkillNames?: string[];
  attachedImage?: string;
  generatedImages?: string[];
  codeVideoArtifact?: RenderedCodeVideoArtifact;
  phoneActions?: PhoneActionPayload[];
  codeArtifact?: {
    title: string;
    html: string;
  };
  toolSteps?: AgentToolStep[];
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
  selectedModel: string;
  autonomousAgent: boolean;
  autoSpeak: boolean;
  featherlightEcoMode: boolean;
  language: LanguageMode;
  groqApiKey: string;
  geminiApiKey: string;
  hfToken: string;
  githubToken: string;
  ollamaUrl: string;
}
