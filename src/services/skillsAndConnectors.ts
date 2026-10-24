import { BrainConnector, BrainSkill, CustomWebhookConnector } from '../types';

export const DEFAULT_BRAIN_SKILLS: BrainSkill[] = [
  {
    id: 'skill-code-video',
    name: 'Claude-Style Code to MP4 Animator',
    icon: 'film',
    category: 'video',
    description:
      'Writes deterministic Canvas2D and Manim-style animation code, executes it in Sandbox, and renders a real H.264 .mp4 video.',
    instructions:
      'When asked to create an explainer video, animation, motion graphic, kinetic typography, physics demo, or video clip via code, invoke the "code_video_mp4" tool so Open Brain writes executable JS animation code and renders a downloadable .mp4 right inside chat.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-phone-os',
    name: 'Android Phone OS Controller',
    icon: 'smartphone',
    category: 'phone',
    description:
      'Controls system Alarms, Timers, WhatsApp, SMS, Calls, Calendar, Google Maps, YouTube, Settings, Clipboard and Battery.',
    instructions:
      'When the user asks to perform any phone task (alarm, timer, call/dial, WhatsApp message, SMS, calendar reminder, open Maps/YouTube/Wi-Fi/Bluetooth settings, check battery, or copy text), invoke the "phone_action" tool with accurate parameters.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-deep-research',
    name: 'Deep Multi-Source Researcher',
    icon: 'microscope',
    category: 'research',
    description:
      'Cross-verifies live Web, Wikipedia, ArXiv papers, GitHub and HackerNews into structured executive briefs.',
    instructions:
      'Structure complex research answers with clear headings, bulleted findings, verified numbers, and source references.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-fullstack-architect',
    name: 'Full-Stack App and Game Architect',
    icon: 'code',
    category: 'coding',
    description:
      'Builds complete interactive single-file apps, calculators, dashboards and touch mobile games in a live sandbox.',
    instructions:
      'Write clean, modular, bug-free production code. When user wants an interactive app, tool, or game, invoke "mini_app" to deliver a live runnable preview.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-polyglot-listener',
    name: 'Universal Multilingual Listener',
    icon: 'globe',
    category: 'creator',
    description:
      'Understands user messages written in any language or transliteration (English, Banglish, Bengali, Hindi, Spanish, etc.) seamlessly.',
    instructions:
      'Comprehend messages written in any world language or Romanized script effortlessly, and respond clearly in English unless the user explicitly asks for another output language.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-quant-finance',
    name: 'Live Market and Crypto Quant',
    icon: 'trending-up',
    category: 'research',
    description:
      'Combines live CoinGecko USD/INR feeds with exact JS math sandbox calculations (SIP, ROI, CAGR, EMI).',
    instructions:
      'Always compute financial formulas (EMI, CAGR, SIP, profit/loss) inside "js_sandbox" for 100% mathematical precision.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-viral-director',
    name: 'Video Script and Storyboard Director',
    icon: 'clapperboard',
    category: 'creator',
    description:
      'Crafts high-retention opening hooks, scene-by-scene visual storyboards, voiceover scripts and metadata.',
    instructions:
      'Include an opening hook, visual cues, spoken voiceover script, and clear structure when creating video content.',
    enabled: false,
    builtIn: true,
  },
];

export const DEFAULT_BRAIN_CONNECTORS: BrainConnector[] = [
  {
    id: 'conn-android-os',
    name: 'Android Native Phone OS',
    slug: 'android_os',
    icon: 'smartphone',
    description: 'Alarms, Timers, WhatsApp, SMS, Dialer, Maps, Calendar, YouTube, Settings and Downloads.',
    enabled: true,
  },
  {
    id: 'conn-web-wiki',
    name: 'Live Web, Wikipedia and DuckDuckGo',
    slug: 'web_search',
    icon: 'globe',
    description: 'Zero-key real-time knowledge, encyclopedia and instant answer search.',
    enabled: true,
  },
  {
    id: 'conn-github',
    name: 'GitHub Open-Source Explorer',
    slug: 'github',
    icon: 'github',
    description: 'Search repositories, stars, codebases and trending open-source AI tools.',
    enabled: true,
    authOptional: true,
    configLabel: 'Optional GitHub Token (for higher rate limits or private repos)',
  },
  {
    id: 'conn-weather',
    name: 'Open-Meteo Hyperlocal Weather',
    slug: 'weather',
    icon: 'cloud-sun',
    description: 'Live temperature, humidity, wind and 3-day forecast for any city worldwide.',
    enabled: true,
  },
  {
    id: 'conn-coingecko',
    name: 'CoinGecko Global Crypto and Markets',
    slug: 'crypto',
    icon: 'coins',
    description: 'Real-time cryptocurrency prices in USD and INR with 24h percentage change.',
    enabled: true,
  },
  {
    id: 'conn-arxiv',
    name: 'CrossRef and ArXiv Research Papers',
    slug: 'arxiv',
    icon: 'book-open',
    description: 'Search peer-reviewed scientific and AI research publications.',
    enabled: true,
  },
  {
    id: 'conn-pulse',
    name: 'Reddit and HackerNews Live Pulse',
    slug: 'pulse',
    icon: 'radio',
    description: 'Live developer discussions, breaking tech stories and community insights.',
    enabled: true,
  },
  {
    id: 'conn-hf-zerogpu',
    name: 'HuggingFace ZeroGPU Hub',
    slug: 'huggingface',
    icon: 'cpu',
    description: 'Auto-discovers live F5-TTS Voice Cloning and Wan2.1 / LTX-Video GPU Spaces.',
    enabled: true,
  },
];

export function loadSavedSkills(): BrainSkill[] {
  try {
    const raw = localStorage.getItem('openbrain_skills_v3');
    if (!raw) return DEFAULT_BRAIN_SKILLS;
    const saved = JSON.parse(raw) as BrainSkill[];
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // Ignore
  }
  return DEFAULT_BRAIN_SKILLS;
}

export function saveSkills(skills: BrainSkill[]): void {
  try {
    localStorage.setItem('openbrain_skills_v3', JSON.stringify(skills));
  } catch {
    // Ignore
  }
}

export function loadSavedConnectors(): BrainConnector[] {
  try {
    const raw = localStorage.getItem('openbrain_connectors_v3');
    if (!raw) return DEFAULT_BRAIN_CONNECTORS;
    const saved = JSON.parse(raw) as BrainConnector[];
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // Ignore
  }
  return DEFAULT_BRAIN_CONNECTORS;
}

export function saveConnectors(connectors: BrainConnector[]): void {
  try {
    localStorage.setItem('openbrain_connectors_v3', JSON.stringify(connectors));
  } catch {
    // Ignore
  }
}

export function loadCustomWebhooks(): CustomWebhookConnector[] {
  try {
    const raw = localStorage.getItem('openbrain_webhooks_v3');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomWebhooks(items: CustomWebhookConnector[]): void {
  try {
    localStorage.setItem('openbrain_webhooks_v3', JSON.stringify(items));
  } catch {
    // Ignore
  }
}
