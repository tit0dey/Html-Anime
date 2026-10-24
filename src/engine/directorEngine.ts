import {
  CameraMove,
  ColorScriptChoice,
  ColorScriptId,
  CompiledFilmProject,
  ConcreteWeather,
  ConcreteWorld,
  FilmShot,
  ShotCutType,
  ShotKind,
  StudioFormConfig,
  WeatherType,
  WorldArchetype,
} from '../types/film';
import {
  COLOR_SCRIPTS,
  FPS,
  getDimensions,
  hashString,
  mulberry32,
} from './colorScripts';

const STOP_WORDS = new Set(
  'a,an,the,of,to,and,in,on,for,with,as,at,from,by,into,over,about,make,create,video,film,anime'.split(
    ','
  )
);

export const SHOT_DIRECTIONS: Record<ShotKind, string> = {
  establish:
    'Wide establishing frame. The world dominates the composition. Camera push 100% -> 106% (power1.inOut). Acting on twos.',
  approach:
    'Medium cut closer into the environment. Silhouette & garment follow-through on twos; atmospheric particles on ones.',
  turn:
    'Pre-action tension beat. Asymmetric framing on thirds, dramatic rim flare, four frames of coil anticipation then hold.',
  close_eyes:
    'Tight anime close-up on the upper third. Sclera, iris rim, dual window catchlights, subtle brow tension & 2-frame blink.',
  sakuga:
    'The Expensive Shot (8 unique drawings). Anticipation crouch -> high-speed smear frame -> 2-frame stark impact flash -> sweeping crescent slash & flying sparks on ones -> 12-frame landed hold.',
  panoramic:
    'Sweeping horizon & celestial vista. Parallax cloud/architecture drift with practical light reflections.',
  aftermath:
    'Settled post-climax hold (12+ frames). Wind and garment settle on twos while embers/rain drift across foreground.',
  button:
    'Closing portrait / horizon return. Verbatim dialogue or closing beat set cleanly in the lower third, ending with an 8-frame fade to ink.',
};

export const SHOT_LABELS: Record<ShotKind, string> = {
  establish: 'Establish',
  approach: 'Approach',
  turn: 'Anticipation Turn',
  close_eyes: 'Close-Up Gaze',
  sakuga: 'Sakuga Climax',
  panoramic: 'Horizon Vista',
  aftermath: 'Aftermath Hold',
  button: 'Button & Resolve',
};

export function slugFromPrompt(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  return words.slice(0, 4).join('-') || 'html-anime-film';
}

export function inferColorScriptFromPrompt(
  prompt: string,
  requested: ColorScriptChoice
): ColorScriptId {
  if (requested !== 'auto') return requested;
  const p = prompt.toLowerCase();
  if (/\b(cyber|neon|hacker|matrix|ai|robot|2099|grid|synth)\b/.test(p)) {
    return 'cyberpunk';
  }
  if (/\b(eclipse|blood|crimson|demon|war|fire|red|battle|revenge|রাগ|যুদ্ধ|রক্ত)\b/.test(p)) {
    return 'eclipse';
  }
  if (/\b(sakura|blossom|cherry|petal|spring|pink|love|ভালোবাসা|বসন্ত|ফুল)\b/.test(p)) {
    return 'sakura';
  }
  if (/\b(space|cosmos|comet|galaxy|black hole|orbit|twilight|star|মহাকাশ|তারা)\b/.test(p)) {
    return 'shinkai';
  }
  if (/\b(lantern|festival|shrine|spirit|temple|gold|উৎসব|প্রদীপ)\b/.test(p)) {
    return 'festival';
  }
  if (/\b(noon|sunlit|desert|paper|scroll|ancient|daylight|দুপুর|রোদ)\b/.test(p)) {
    return 'noon';
  }
  if (/\b(emerald|forest|meadow|mountain|green|valley|nature|পাহাড়|সবুজ|বন)\b/.test(p)) {
    return 'emerald';
  }
  return 'indigo';
}

export function inferWorldFromPrompt(
  prompt: string,
  requested: WorldArchetype
): ConcreteWorld {
  if (requested !== 'auto') return requested;
  const p = prompt.toLowerCase();
  if (
    /\b(space|planet|star|galaxy|cosmos|black hole|nebula|universe|astronaut|orbit|moonfall|supernova|comet|quantum|মহাকাশ)\b/.test(
      p
    )
  ) {
    return 'cosmos_nebula';
  }
  if (
    /\b(samurai|ronin|shrine|torii|temple|mountain|forest|bamboo|sword|katana|blade|warrior|myth|demon|ancient|dragon|ninja|পাহাড়|মন্দির)\b/.test(
      p
    )
  ) {
    return 'shrine_mountains';
  }
  if (
    /\b(ocean|sea|water|wave|beach|sunset|horizon|island|ship|summer|memory|coast|সমুদ্র|সাগর|নদী)\b/.test(
      p
    )
  ) {
    return 'ocean_horizon';
  }
  if (
    /\b(ai|code|cyber|matrix|tech|robot|future|hacker|data|system|2099|algorithm|engine|circuit)\b/.test(
      p
    )
  ) {
    return 'cyber_arena';
  }
  return 'rooftop_city';
}

export function inferWeatherFromPrompt(
  prompt: string,
  requested: WeatherType,
  scriptId: ColorScriptId,
  world: ConcreteWorld
): ConcreteWeather {
  if (requested !== 'auto') return requested;
  const p = prompt.toLowerCase();
  if (/\b(rain|storm|thunder|wet|downpour|monsoon|drizzle|বৃষ্টি|ঝড়)\b/.test(p)) return 'rain';
  if (/\b(fire|flame|ember|ash|burn|battle|war|lava|eclipse|blood|আগুন)\b/.test(p)) return 'embers';
  if (/\b(sakura|petal|cherry|blossom|spring|flower|ফুল)\b/.test(p)) return 'petals';
  if (/\b(snow|winter|ice|frost|blizzard|cold|বরফ|শীত)\b/.test(p)) return 'snow';
  if (/\b(star|space|galaxy|comet|cosmos|nebula|magic|cyber|তারা)\b/.test(p)) return 'stardust';

  if (scriptId === 'eclipse') return 'embers';
  if (scriptId === 'sakura') return 'petals';
  if (scriptId === 'shinkai' || world === 'cosmos_nebula') return 'stardust';
  if (scriptId === 'indigo' || world === 'rooftop_city') return 'rain';
  return 'stardust';
}

export function formatDurationClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  if (m === 0) return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)}s`;
  return `${m}m ${s < 10 ? '0' : ''}${s.toFixed(0)}s`;
}

function buildStoryBeats(
  rawPrompt: string,
  dialogueLine: string,
  shotCount: number,
  extraFacts: string[] = []
): string[] {
  const cleaned = rawPrompt.trim();
  const rawSegments = cleaned
    .split(/\n+|(?<=[.!?।|])\s+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length > 2);

  const combinedInput = [...rawSegments, ...extraFacts.filter((f) => f.length > 8)];

  if (combinedInput.length >= shotCount) {
    const beats: string[] = [];
    for (let i = 0; i < shotCount; i++) {
      const startIdx = Math.floor((i * combinedInput.length) / shotCount);
      const endIdx = Math.max(
        startIdx + 1,
        Math.floor(((i + 1) * combinedInput.length) / shotCount)
      );
      const merged = combinedInput
        .slice(startIdx, endIdx)
        .join(' ')
        .slice(0, 145);
      beats.push(merged);
    }
    if (dialogueLine.trim()) {
      beats[beats.length - 1] = dialogueLine.trim();
    }
    return beats;
  }

  const subject =
    rawSegments[0]?.slice(0, 95) ||
    cleaned.slice(0, 95) ||
    'A lone figure beneath the crimson sky';

  const arcTemplates = [
    subject,
    rawSegments[1] || 'Shadows lengthen across the horizon as the atmosphere shifts.',
    rawSegments[2] || 'Every breath slows in the stillness before the decisive moment.',
    'Eyes lock onto the light — no turning back now.',
    'In a single blinding instant, energy tears across the frame.',
    'Echoes ripple outward through the silence left behind.',
    'High above the world, light and shadow find a new balance.',
    'Step by step, the journey presses deeper into the unknown.',
    'Memory and resolve converge at the edge of the storm.',
    'A sudden spark ignites the dark skyline once again.',
    'Calm returns as drifting light settles across the ground.',
    dialogueLine.trim() || rawSegments[rawSegments.length - 1] || subject,
  ];

  const beats: string[] = [];
  for (let i = 0; i < shotCount; i++) {
    if (i === 0) {
      beats.push(subject);
    } else if (i === shotCount - 1) {
      beats.push(dialogueLine.trim() || rawSegments[rawSegments.length - 1] || subject);
    } else if (i < combinedInput.length) {
      beats.push(combinedInput[i].slice(0, 140));
    } else {
      beats.push(arcTemplates[(i % (arcTemplates.length - 2)) + 1]);
    }
  }
  return beats;
}

function buildShotBlueprints(
  totalSeconds: number
): Array<{ kind: ShotKind; weight: number; sakuga: boolean }> {
  if (totalSeconds <= 9) {
    return [
      { kind: 'establish', weight: 2.4, sakuga: false },
      { kind: 'sakuga', weight: 3.4, sakuga: true },
      { kind: 'button', weight: 2.2, sakuga: false },
    ];
  }

  if (totalSeconds <= 14) {
    return [
      { kind: 'establish', weight: 2.5, sakuga: false },
      { kind: 'approach', weight: 2.5, sakuga: false },
      { kind: 'sakuga', weight: 4.0, sakuga: true },
      { kind: 'button', weight: 3.0, sakuga: false },
    ];
  }

  if (totalSeconds <= 24) {
    return [
      { kind: 'establish', weight: 3.0, sakuga: false },
      { kind: 'approach', weight: 3.0, sakuga: false },
      { kind: 'close_eyes', weight: 2.8, sakuga: false },
      { kind: 'sakuga', weight: 5.0, sakuga: true },
      { kind: 'aftermath', weight: 3.4, sakuga: false },
      { kind: 'button', weight: 2.8, sakuga: false },
    ];
  }

  const targetCount = Math.max(7, Math.min(90, Math.round(totalSeconds / 4.2)));
  const cycle: ShotKind[] = [
    'approach',
    'close_eyes',
    'panoramic',
    'turn',
    'sakuga',
    'aftermath',
  ];

  const list: Array<{ kind: ShotKind; weight: number; sakuga: boolean }> = [];
  const mainSakugaIdx = Math.max(2, Math.floor(targetCount * 0.68));

  for (let i = 0; i < targetCount; i++) {
    if (i === 0) {
      list.push({ kind: 'establish', weight: 1.05, sakuga: false });
    } else if (i === targetCount - 1) {
      list.push({ kind: 'button', weight: 1.0, sakuga: false });
    } else if (i === mainSakugaIdx) {
      list.push({ kind: 'sakuga', weight: 1.35, sakuga: true });
    } else {
      const picked = cycle[(i - 1) % cycle.length];
      list.push({
        kind: picked,
        weight: picked === 'sakuga' ? 1.25 : picked === 'close_eyes' ? 0.9 : 1.0,
        sakuga: picked === 'sakuga',
      });
    }
  }
  return list;
}

/**
 * Guaranteed non-zero frame distributor: every shot gets >= minFrames (>= 24f = 1.0s)
 * and total sum equals totalFrames with zero rounding overflow!
 */
function allocateExactShotFrames(weights: number[], totalFrames: number): number[] {
  const count = weights.length;
  const minFrames = Math.max(12, Math.min(FPS, Math.floor(totalFrames / count)));
  const reservable = totalFrames - minFrames * count;

  if (reservable <= 0) {
    const base = Math.floor(totalFrames / count);
    const out = new Array(count).fill(base);
    out[count - 1] += totalFrames - base * count;
    return out;
  }

  const weightSum = weights.reduce((a, b) => a + b, 0) || count;
  const out: number[] = [];
  let distributedExtra = 0;
  let cumWeight = 0;

  for (let i = 0; i < count; i++) {
    cumWeight += weights[i];
    const targetExtra =
      i === count - 1
        ? reservable
        : Math.round((cumWeight / weightSum) * reservable);
    const extraForShot = Math.max(0, targetExtra - distributedExtra);
    distributedExtra += extraForShot;
    out.push(minFrames + extraForShot);
  }

  return out;
}

/**
 * Optional ultra-fast Wikipedia open fact fetcher (only runs on concise Latin/English topic queries).
 */
export async function fetchOptionalTopicContext(prompt: string): Promise<string[]> {
  const trimmed = prompt.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (
    !trimmed ||
    trimmed.length > 90 ||
    wordCount > 9 ||
    trimmed.includes('\n') ||
    !/^[a-zA-Z0-9\s,.'"-]+$/.test(trimmed)
  ) {
    return [];
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      trimmed
    )}&utf8=&format=json&origin=*&srlimit=3`;
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    const snippets: string[] = [];
    for (const item of data?.query?.search || []) {
      const raw = String(item?.snippet || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
      for (const s of raw.split(/(?<=[.!?])\s+/)) {
        if (s.length > 24 && s.length < 140) {
          snippets.push(s);
        }
      }
    }
    return snippets.slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function buildShotSheetMarkdown(params: {
  cleanPrompt: string;
  totalSeconds: number;
  totalFrames: number;
  width: number;
  height: number;
  aspect: StudioFormConfig['aspect'];
  colorScript: CompiledFilmProject['colorScript'];
  shots: FilmShot[];
}): string {
  const {
    cleanPrompt,
    totalSeconds,
    totalFrames,
    width,
    height,
    aspect,
    colorScript,
    shots,
  } = params;

  const frameNote =
    aspect === '9:16'
      ? 'Compose the tall frame (9:16). Character eyes in the upper half; captions in the lower fifth.'
      : aspect === '1:1'
      ? 'Compose the balanced square frame (1:1). Center-weighted focal action with clean lower-fifth captions.'
      : 'Compose the wide frame (16:9). Place eyes on a third with look-room in front of the gaze.';

  const paintLines = Object.entries(colorScript.colors)
    .map(([k, hex]) => `- ${k} ${hex}`)
    .join('\n');

  const shotMdBlocks = shots
    .map((s) => {
      const tag = s.sakuga ? `${s.label} — the expensive shot` : s.label;
      return `### ${s.index + 1} · ${tag} · ${s.startSec.toFixed(2)}s–${s.endSec.toFixed(2)}s\n${
        s.directionNote
      }\n> Caption: "${s.caption}"`;
    })
    .join('\n\n');

  return [
    '# html-anime · Self-Rendering Studio Sheet',
    '',
    cleanPrompt,
    '',
    `${totalSeconds}s (${formatDurationClock(totalSeconds)}) · ${FPS}fps · ${totalFrames} frames · ${width}×${height} (${aspect})`,
    `Color script: ${colorScript.name}`,
    paintLines,
    '',
    frameNote,
    '',
    '## Drawing & Timing Law',
    '- Character acting and cloth follow-through on twos (12fps holds inside 24fps timeline).',
    '- Rain, embers, petals, sparks, and blade trails on ones (24fps).',
    '- Color-dip cuts straddle act transitions; final 8 frames fade cleanly to ink.',
    '',
    '## Compiled Shots',
    shotMdBlocks,
    '',
  ].join('\n');
}

export function compileAnimeFilmProject(
  config: StudioFormConfig,
  extraFacts: string[] = []
): CompiledFilmProject {
  const cleanPrompt =
    config.prompt.trim() ||
    'On a rain-swept rooftop beneath an indigo moon, a lone blade flashes through the dark.';
  const totalSeconds = Math.max(
    4,
    Math.min(600, Math.round(config.minutes * 60 + config.seconds))
  );
  const totalFrames = Math.max(FPS * 4, Math.round(totalSeconds * FPS));
  const { width, height } = getDimensions(config.aspect, config.quality);

  const resolvedScriptId = inferColorScriptFromPrompt(cleanPrompt, config.scriptId);
  const colorScript = COLOR_SCRIPTS[resolvedScriptId] || COLOR_SCRIPTS.indigo;
  const baseSeed = hashString(
    `${cleanPrompt}|${config.aspect}|${resolvedScriptId}|${totalSeconds}`
  );
  const rng = mulberry32(baseSeed);

  const primaryWorld = inferWorldFromPrompt(cleanPrompt, config.world);
  const primaryWeather = inferWeatherFromPrompt(
    cleanPrompt,
    config.weather,
    resolvedScriptId,
    primaryWorld
  );

  const blueprints = buildShotBlueprints(totalSeconds);
  const beats = buildStoryBeats(
    cleanPrompt,
    config.dialogue,
    blueprints.length,
    extraFacts
  );
  const frameCounts = allocateExactShotFrames(
    blueprints.map((b) => b.weight),
    totalFrames
  );

  const worldCycle: ConcreteWorld[] = [
    primaryWorld,
    primaryWorld,
    primaryWorld === 'rooftop_city' ? 'ocean_horizon' : primaryWorld,
    primaryWorld,
  ];

  const cameraCycle: CameraMove[] = ['push_in', 'pan_right', 'pull_back', 'pan_left'];
  const shots: FilmShot[] = [];
  let cursorFrame = 0;

  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i];
    const startFrame = cursorFrame;
    const endFrame = startFrame + frameCounts[i];
    cursorFrame = endFrame;

    const startSec = Number((startFrame / FPS).toFixed(3));
    const endSec = Number((endFrame / FPS).toFixed(3));
    const durationSec = Number(((endFrame - startFrame) / FPS).toFixed(2));

    const cameraMove: CameraMove =
      bp.kind === 'sakuga' || bp.kind === 'turn'
        ? 'locked'
        : bp.kind === 'establish'
        ? 'push_in'
        : cameraCycle[i % cameraCycle.length];

    const cutIn: ShotCutType =
      i === 0
        ? 'color_dip_ink'
        : bp.kind === 'sakuga'
        ? 'flash_cut'
        : i % 2 === 1
        ? 'color_dip_accent'
        : 'hard_cut';

    const shotWorld =
      config.world !== 'auto'
        ? primaryWorld
        : bp.kind === 'panoramic'
        ? worldCycle[(i + 2) % worldCycle.length]
        : primaryWorld;

    shots.push({
      id: `shot-${i + 1}`,
      index: i,
      kind: bp.kind,
      label: SHOT_LABELS[bp.kind],
      directionNote: SHOT_DIRECTIONS[bp.kind],
      caption: beats[i] || '',
      startSec,
      durationSec,
      endSec,
      startFrame,
      endFrame,
      world: shotWorld,
      weather: primaryWeather,
      cameraMove,
      cutIn,
      sakuga: bp.sakuga,
      seed: Math.floor(rng() * 0xffffffff) >>> 0,
    });
  }

  const slug = slugFromPrompt(cleanPrompt);
  const titleWords = cleanPrompt
    .replace(/\n+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');

  const shotSheetMarkdown = buildShotSheetMarkdown({
    cleanPrompt,
    totalSeconds,
    totalFrames,
    width,
    height,
    aspect: config.aspect,
    colorScript,
    shots,
  });

  return {
    id: `film-${Date.now()}-${Math.floor(rng() * 10000)}`,
    title: titleWords || 'Untitled Anime Film',
    slug,
    rawPrompt: cleanPrompt,
    dialogueLine: config.dialogue.trim(),
    aspect: config.aspect,
    quality: config.quality,
    width,
    height,
    fps: FPS,
    totalSeconds,
    totalFrames,
    colorScript,
    includeScore: config.includeScore,
    includeVoiceover: config.includeVoiceover,
    showSubtitles: config.showSubtitles,
    letterbox: config.letterbox,
    shots,
    shotSheetMarkdown,
    createdAt: Date.now(),
  };
}
