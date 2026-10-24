import { AspectRatio, ColorScriptId, ColorScriptSpec, QualityPreset } from '../types/film';

export const FPS = 24;

export const COLOR_SCRIPTS: Record<ColorScriptId, ColorScriptSpec> = {
  indigo: {
    id: 'indigo',
    name: 'Indigo Moon',
    subtitle: 'Midnight rooftop & crimson rim',
    colors: {
      sky: '#1b2d6b',
      ink: '#101628',
      moon: '#d5e2ff',
      accent: '#e23b4a',
      practical: '#f0c36a',
      iris: '#e7a04a',
      skin: '#f0c2ae',
      hair: '#16141c',
      sclera: '#f6f3ee',
      line: '#e7eefc',
    },
    chordHz: [146.83, 220.0, 261.63, 329.63], // Dm9 atmospheric
  },
  eclipse: {
    id: 'eclipse',
    name: 'Vermilion Eclipse',
    subtitle: 'Crimson blood-moon & obsidian ink',
    colors: {
      sky: '#2a1016',
      ink: '#14080c',
      moon: '#ffccd5',
      accent: '#ff3b3b',
      practical: '#f3f6ff',
      iris: '#ff5a4a',
      skin: '#e8b8a8',
      hair: '#1a1014',
      sclera: '#f6f3ee',
      line: '#f6e4e4',
    },
    chordHz: [130.81, 196.0, 233.08, 311.13], // Cm7 dark tension
  },
  noon: {
    id: 'noon',
    name: 'Paper Noon',
    subtitle: 'Sunlit parchment & vermilion brush',
    colors: {
      sky: '#f2d7ae',
      ink: '#2c261f',
      moon: '#fff6e4',
      accent: '#c4452d',
      practical: '#e07a2b',
      iris: '#5c3d32',
      skin: '#f0c2ae',
      hair: '#241c16',
      sclera: '#f6f3ee',
      line: '#241c16',
    },
    chordHz: [174.61, 220.0, 261.63, 329.63], // Fmaj7 warm
  },
  festival: {
    id: 'festival',
    name: 'Lantern Festival',
    subtitle: 'Violet dusk & warm gold lanterns',
    colors: {
      sky: '#24143a',
      ink: '#140c1c',
      moon: '#ffd7a1',
      accent: '#ff4d6d',
      practical: '#ffb020',
      iris: '#ffd0a1',
      skin: '#f0c2ae',
      hair: '#1a1020',
      sclera: '#f6f3ee',
      line: '#fff1ea',
    },
    chordHz: [164.81, 246.94, 293.66, 369.99], // Em9 wistful
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Neo-Tokyo Cyber',
    subtitle: 'Abyssal blue, cyan & magenta neon',
    colors: {
      sky: '#0c1d36',
      ink: '#070b14',
      moon: '#b8f7ff',
      accent: '#ff2a85',
      practical: '#00f0ff',
      iris: '#00e5ff',
      skin: '#ecc5b4',
      hair: '#101422',
      sclera: '#f2f7fa',
      line: '#d6f8ff',
    },
    chordHz: [138.59, 207.65, 246.94, 311.13], // C#m9 synthwave
  },
  shinkai: {
    id: 'shinkai',
    name: 'Comet Twilight',
    subtitle: 'Magic-hour horizon & starlight cyan',
    colors: {
      sky: '#1e3570',
      ink: '#0d152e',
      moon: '#e8fbff',
      accent: '#ff758f',
      practical: '#ffb86c',
      iris: '#56cfe1',
      skin: '#f2c6b4',
      hair: '#181a28',
      sclera: '#f8f9fa',
      line: '#eef7ff',
    },
    chordHz: [196.0, 246.94, 293.66, 369.99], // Gmaj7 soaring
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Wind',
    subtitle: 'Plum twilight & drifting blossom pink',
    colors: {
      sky: '#312042',
      ink: '#160f21',
      moon: '#ffe8d6',
      accent: '#ff85a1',
      practical: '#ffd166',
      iris: '#f4978e',
      skin: '#f3c8b6',
      hair: '#1f1626',
      sclera: '#fbf8f6',
      line: '#fff0f5',
    },
    chordHz: [174.61, 261.63, 329.63, 392.0], // Fmaj9 gentle
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Horizon',
    subtitle: 'Summer sky & sunlit teal hills',
    colors: {
      sky: '#1d5c78',
      ink: '#0e2430',
      moon: '#f6f4d2',
      accent: '#e76f51',
      practical: '#e9c46a',
      iris: '#2a9d8f',
      skin: '#f0c4b0',
      hair: '#1b2021',
      sclera: '#f8f9f5',
      line: '#eef6f7',
    },
    chordHz: [146.83, 220.0, 293.66, 369.99], // Dadd9 pastoral
  },
};

export const COLOR_SCRIPT_LIST: ColorScriptSpec[] = Object.values(COLOR_SCRIPTS);

export function getDimensions(
  aspect: AspectRatio,
  quality: QualityPreset
): { width: number; height: number } {
  // Always divisible by 4 for universal hardware H.264 MediaCodec compatibility
  if (quality === '1080p') {
    if (aspect === '9:16') return { width: 1080, height: 1920 };
    if (aspect === '1:1') return { width: 1080, height: 1080 };
    return { width: 1920, height: 1080 };
  }
  if (aspect === '9:16') return { width: 720, height: 1280 };
  if (aspect === '1:1') return { width: 720, height: 720 };
  return { width: 1280, height: 720 };
}

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic seeded PRNG (Zero Math.random(), matching html-anime deterministic frame law).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const power1InOut = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

export const power2In = (t: number): number => {
  const x = clamp01(t);
  return x * x;
};

export const power2Out = (t: number): number => {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
};

export const power3Out = (t: number): number => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
