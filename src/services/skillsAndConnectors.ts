import { BrainConnector, BrainSkill, CustomWebhookConnector } from '../types';

export const DEFAULT_BRAIN_SKILLS: BrainSkill[] = [
  {
    id: 'skill-code-video',
    name: 'Claude-Style Code -> MP4 Animator',
    icon: '🎬',
    category: 'video',
    description:
      'Writes deterministic Canvas2D/Manim-style animation code, runs it in Sandbox, and renders a real H.264 .mp4 video!',
    instructions:
      'When asked to create an explainer video, animation, motion graphic, kinetic typography, physics demo, or video clip via code, invoke the "code_video_mp4" tool so Open Brain writes executable JS animation code and renders a downloadable .mp4 right inside chat.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-phone-os',
    name: 'Android Phone OS Controller',
    icon: '📱',
    category: 'phone',
    description:
      'Controls Alarms, Timers, WhatsApp, SMS, Calls, Calendar, Google Maps, YouTube, Settings, Clipboard & Battery!',
    instructions:
      'When the user asks to perform any phone task (alarm, timer, call/dial, WhatsApp message, SMS, calendar reminder, open Maps/YouTube/Wi-Fi/Bluetooth settings, check battery, or copy text), invoke the "phone_action" tool with accurate parameters.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-deep-research',
    name: 'Deep Multi-Source Researcher',
    icon: '🔬',
    category: 'research',
    description:
      'Cross-verifies live Web, Wikipedia, ArXiv papers, GitHub & HackerNews into structured executive briefs.',
    instructions:
      'Structure complex research answers with clear headings, bulleted findings, verified numbers, and source references.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-fullstack-architect',
    name: 'Full-Stack App & Game Architect',
    icon: '💻',
    category: 'coding',
    description:
      'Builds complete interactive single-file apps, calculators, dashboards & touch mobile games in live sandbox.',
    instructions:
      'Write clean, modular, bug-free production code. When user wants an interactive app/tool/game, invoke "mini_app" to deliver a live runnable preview.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-banglish-pro',
    name: 'Banglish & বাংলা Native Fluency',
    icon: '🇮🇳',
    category: 'creator',
    description:
      'Natural conversational fluency in Kolkata Banglish, শুদ্ধ বাংলা, Hindi & English with local context.',
    instructions:
      'Understand Banglish (Bengali written in Latin script) effortlessly and reply warmly in the exact language/style the user prefers.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-quant-finance',
    name: 'Live Market & ₹ INR Quant',
    icon: '📈',
    category: 'research',
    description:
      'Combines live CoinGecko USD/₹ INR feeds with exact JS math sandbox calculations (SIP, ROI, CAGR, EMI).',
    instructions:
      'Always compute financial formulas (EMI, CAGR, SIP, profit/loss) inside "js_sandbox" for 100% mathematical precision.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-viral-director',
    name: 'Viral Reels & YouTube Scriptwriter',
    icon: '🔥',
    category: 'creator',
    description:
      'Crafts high-retention 3-second hooks, scene-by-scene visual storyboards, voiceover scripts & SEO tags.',
    instructions:
      'Include a 0-3s Hook, visual cues, spoken voiceover script, and viral hashtags when creating social content.',
    enabled: false,
    builtIn: true,
  },
];

export const DEFAULT_BRAIN_CONNECTORS: BrainConnector[] = [
  {
    id: 'conn-android-os',
    name: 'Android Native Phone OS',
    slug: 'android_os',
    icon: '📱',
    description: 'Alarms, Timers, WhatsApp, SMS, Dialer, Maps, Calendar, YouTube, Settings & Downloads.',
    enabled: true,
  },
  {
    id: 'conn-web-wiki',
    name: 'Live Web, Wikipedia & DuckDuckGo',
    slug: 'web_search',
    icon: '🌐',
    description: 'Zero-key real-time knowledge, encyclopedia & instant answer search.',
    enabled: true,
  },
  {
    id: 'conn-github',
    name: 'GitHub Open-Source Explorer',
    slug: 'github',
    icon: '🐙',
    description: 'Search repositories, stars, codebases & trending open-source AI tools.',
    enabled: true,
    authOptional: true,
    configLabel: 'Optional GitHub Token (for higher rate limits / private repos)',
  },
  {
    id: 'conn-weather',
    name: 'Open-Meteo Hyperlocal Weather',
    slug: 'weather',
    icon: '🌦️',
    description: 'Live temperature, humidity, wind & 3-day forecast for any city worldwide.',
    enabled: true,
  },
  {
    id: 'conn-coingecko',
    name: 'CoinGecko ₹ INR & Global Crypto',
    slug: 'crypto',
    icon: '💰',
    description: 'Real-time cryptocurrency prices in ₹ INR & $ USD with 24h % change.',
    enabled: true,
  },
  {
    id: 'conn-arxiv',
    name: 'CrossRef & ArXiv Research Papers',
    slug: 'arxiv',
    icon: '📚',
    description: 'Search peer-reviewed scientific & AI research publications.',
    enabled: true,
  },
  {
    id: 'conn-pulse',
    name: 'Reddit & HackerNews Live Pulse',
    slug: 'pulse',
    icon: '📰',
    description: 'Live developer discussions, breaking tech stories & community insights.',
    enabled: true,
  },
  {
    id: 'conn-hf-zerogpu',
    name: 'HuggingFace ZeroGPU Hub',
    slug: 'huggingface',
    icon: '🤗',
    description: 'Auto-discovers live F5-TTS Voice Cloning & Wan2.1 / LTX-Video GPU Spaces.',
    enabled: true,
  },
];

export function loadSavedSkills(): BrainSkill[] {
  try {
    const raw = localStorage.getItem('openbrain_skills_v2');
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
    localStorage.setItem('openbrain_skills_v2', JSON.stringify(skills));
  } catch {
    // Ignore
  }
}

export function loadSavedConnectors(): BrainConnector[] {
  try {
    const raw = localStorage.getItem('openbrain_connectors_v2');
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
    localStorage.setItem('openbrain_connectors_v2', JSON.stringify(connectors));
  } catch {
    // Ignore
  }
}

export function loadCustomWebhooks(): CustomWebhookConnector[] {
  try {
    const raw = localStorage.getItem('openbrain_webhooks_v2');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomWebhooks(items: CustomWebhookConnector[]): void {
  try {
    localStorage.setItem('openbrain_webhooks_v2', JSON.stringify(items));
  } catch {
    // Ignore
  }
}
