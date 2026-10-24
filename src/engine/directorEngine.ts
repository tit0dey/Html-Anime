import {
  CameraMove,
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

const SHOT_DIRECTIONS: Record<ShotKind, string> = {
  establish:
    'Wide establishing frame. The world dominates the composition. Camera push 100% -> 106% (power1.inOut). Acting on twos.',
  approach:
    'Medium cut closer into the environment. Silhouette & garment follow-through on twos; atmospheric particles on ones.',
  turn:
    'Pre-action tension beat. Asymmetric framing on thirds, dramatic rim flare, four frames of coil anticipation then hold.',
  close_eyes:
    'Tight anime close-up on the upper third. Sclera, iris rim, dual window catchlights, subtle brow tension & 2-frame blink.',
  sakuga:
    'The Expensive Shot (8 unique drawings). Anticipation crouch -> high-speed smear frame -> 1-frame stark impact flash -> sweeping crescent slash & flying sparks on ones -> 12-frame landed hold.',
  panoramic:
    'Sweeping horizon & celestial vista. Parallax cloud/architecture drift with practical light reflections.',
  aftermath:
    'Settled post-climax hold (12+ frames). Wind and garment settle on twos while embers/rain drift across foreground.',
  button:
    'Closing portrait / horizon return. Verbatim dialogue or closing beat set cleanly in the lower third, ending with an 8-frame fade to ink.',
};

const SHOT_LABELS: Record<ShotKind, string> = {
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

export function inferWorldFromPrompt(
  prompt: string,
  requested: WorldArchetype
): ConcreteWorld {
  if (requested !== 'auto') return requested;
  const p = prompt.toLowerCase();
  if (
    /\b(space|planet|star|galaxy|cosmos|black hole|nebula|universe|astronaut|orbit|moonfall|supernova|comet|quantum)\b/.test(
      p
    )
  ) {
    return 'cosmos_nebula';
  }
  if (
    /\b(samurai|ronin|shrine|torii|temple|mountain|forest|bamboo|sword|katana|blade|warrior|myth|demon|ancient|dragon|ninja)\b/.test(
      p
    )
  ) {
    return 'shrine_mountains';
  }
  if (
    /\b(ocean|sea|water|wave|beach|train|sunset|horizon|island|ship|summer|memory|love|journey|coast)\b/.test(
      p
    )
  ) {
    return 'ocean_horizon';
  }
  if (
    /\b(ai|code|cyber|matrix|tech|robot|future|hacker|data|system|science|math|algorithm|engine|circuit)\b/.test(
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
  if (/\b(rain|storm|thunder|wet|downpour|monsoon|drizzle)\b/.test(p)) return 'rain';
  if (/\b(fire|flame|ember|ash|burn|battle|war|lava|eclipse|blood)\b/.test(p)) return 'embers';
  if (/\b(sakura|petal|cherry|blossom|spring|flower|wind)\b/.test(p)) return 'petals';
  if (/\b(snow|winter|ice|frost|blizzard|cold)\b/.test(p)) return 'snow';
  if (/\b(star|space|galaxy|comet|cosmos|nebula|magic|cyber)\b/.test(p)) return 'stardust';

  if (scriptId === 'eclipse') return 'embers';
  if (scriptId === 'sakura') return 'petals';
  if (scriptId === 'shinkai' || world === 'cosmos_nebula') return 'stardust';
  if (scriptId === 'indigo' || world === 'rooftop_city') return 'rain';
  return 'stardust';
}

export function formatDurationClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  if (m === 0) return `${s.toFixed(1)}s`;
  return `${m}m ${s < 10 ? '0' : ''}${s.toFixed(0)}s`;
}

/**
 * Extracts narrative sentences/beats from any prompt (2-word topic OR 5,000-word detailed script),
 * and gracefully expands short topics to fill multi-shot or multi-minute timelines without repetition.
 */
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
    // Group segments evenly across shots so the entire detailed story is covered!
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

  // Short topic or concise logline -> craft cinematic narrative arc beats around the core subject!
  const subject =
    rawSegments[0]?.slice(0, 95) || cleaned.slice(0, 95) || 'A lone figure beneath the crimson sky';

  const arcTemplates = [
    subject,
    rawSegments[1] || `Shadows lengthen across the horizon as the atmosphere shifts.`,
    rawSegments[2] || `Every breath slows in the stillness before the decisive moment.`,
    `Eyes lock onto the light — no turning back now.`,
    `In a single blinding instant, energy tears across the frame!`,
    `Echoes ripple outward through the silence left behind.`,
    `High above the world, light and shadow find a new balance.`,
    `Step by step, the journey presses deeper into the unknown.`,
    `Memory and resolve converge at the edge of the storm.`,
    `A sudden spark ignites the dark skyline once again!`,
    `Calm returns as drifting light settles across the ground.`,
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

/**
 * Generates the exact sequence of ShotKinds & durations for ANY custom duration (4s to 600s).
 */
function buildShotBlueprints(
  totalSeconds: number
): Array<{ kind: ShotKind; weight: number; sakuga: boolean }> {
  if (totalSeconds <= 9) {
    // Classic 3-shot html-anime 8s arc
    return [
      { kind: 'establish', weight: 2.4, sakuga: false },
      { kind: 'sakuga', weight: 3.6, sakuga: true },
      { kind: 'button', weight: 2.0, sakuga: false },
    ];
  }

  if (totalSeconds <= 14) {
    // Classic 4-shot html-anime 12s arc
    return [
      { kind: 'establish', weight: 2.5, sakuga: false },
      { kind: 'approach', weight: 2.5, sakuga: false },
      { kind: 'sakuga', weight: 4.0, sakuga: true },
      { kind: 'button', weight: 3.0, sakuga: false },
    ];
  }

  if (totalSeconds <= 24) {
    // Classic 6-shot html-anime 20s arc
    return [
      { kind: 'establish', weight: 3.0, sakuga: false },
      { kind: 'approach', weight: 3.0, sakuga: false },
      { kind: 'close_eyes', weight: 2.8, sakuga: false },
      { kind: 'sakuga', weight: 5.0, sakuga: true },
      { kind: 'aftermath', weight: 3.4, sakuga: false },
      { kind: 'button', weight: 2.8, sakuga: false },
    ];
  }

  // Custom longer durations (25s up to 10 minutes!): dynamic multi-act anime cinema rhythm (~4.2s avg per shot)
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
 * Optional ultra-fast Wikipedia open fact fetcher (2.4s max timeout, 100% free & zero API key)
 * so short factual/historical/science topics automatically gain rich real-world story captions!
 */
export async function fetchOptionalTopicContext(prompt: string): Promise<string[]> {
  const trimmed = prompt.trim();
  // If user already wrote a detailed multi-sentence story (>180 chars), use their exact story directly!
  if (trimmed.length > 180 || trimmed.includes('\n')) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2400);
  try {
    const q = trimmed.slice(0, 80);
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q
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

/**
 * Compiles any StudioFormConfig into a complete, deterministic, frame-accurate CompiledFilmProject!
 */
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
  const colorScript = COLOR_SCRIPTS[config.scriptId] || COLOR_SCRIPTS.indigo;
  const baseSeed = hashString(`${cleanPrompt}|${config.aspect}|${config.scriptId}|${totalSeconds}`);
  const rng = mulberry32(baseSeed);

  const primaryWorld = inferWorldFromPrompt(cleanPrompt, config.world);
  const primaryWeather = inferWeatherFromPrompt(
    cleanPrompt,
    config.weather,
    config.scriptId,
    primaryWorld
  );

  const blueprints = buildShotBlueprints(totalSeconds);
  const beats = buildStoryBeats(cleanPrompt, config.dialogue, blueprints.length, extraFacts);

  const weightSum = blueprints.reduce((acc, b) => acc + b.weight, 0);
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
    const isLast = i === blueprints.length - 1;
    const allocatedFrames = isLast
      ? totalFrames - cursorFrame
      : Math.max(FPS * 2, Math.round((bp.weight / weightSum) * totalFrames));

    const startFrame = cursorFrame;
    const endFrame = Math.min(totalFrames, startFrame + allocatedFrames);
    cursorFrame = endFrame;

    const startSec = Number((startFrame / FPS).toFixed(3));
    const endSec = Number((endFrame / FPS).toFixed(3));
    const durationSec = Number(((endFrame - startFrame) / FPS).toFixed(3));

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

  const frameNote =
    config.aspect === '9:16'
      ? 'Compose the tall frame (9:16). Character eyes in the upper half; captions in the lower fifth.'
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

  const shotSheetMarkdown = [
    '# html-anime · Self-Rendering Studio Sheet',
    '',
    cleanPrompt,
    '',
    `${totalSeconds}s (${formatDurationClock(totalSeconds)}) · ${FPS}fps · ${totalFrames} frames · ${width}×${height} (${config.aspect})`,
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

  return {
    id: `film-${Date.now()}`,
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
