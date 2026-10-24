import { CompiledFilmProject } from '../types/film';
import { fetchBinaryBridge, synthesizeNativeSpeechWav } from './nativeBridge';

export interface VoiceCue {
  startSample: number;
  pcm: Float32Array;
}

function detectLang(text: string): { code: string; tag: string } {
  if (/[\u0980-\u09FF]/.test(text)) return { code: 'bn', tag: 'bn-IN' };
  if (/[\u0900-\u097F]/.test(text)) return { code: 'hi', tag: 'hi-IN' };
  if (/[\u3040-\u30FF]/.test(text)) return { code: 'ja', tag: 'ja-JP' };
  return { code: 'en', tag: 'en-IN' };
}

async function decodeAndResampleAudio(
  rawAudio: ArrayBuffer,
  ctx: AudioContext,
  targetSampleRate: number
): Promise<Float32Array | null> {
  if (!rawAudio || rawAudio.byteLength < 256) return null;
  try {
    const decoded = await ctx.decodeAudioData(rawAudio.slice(0));
    const outLen = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offline = new OfflineAudioContext(1, outLen, targetSampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } catch {
    return null;
  }
}

async function synthesizeCaptionToPcm(
  caption: string,
  ctx: AudioContext,
  targetSampleRate: number
): Promise<Float32Array | null> {
  const clean = caption.trim();
  if (!clean) return null;
  const lang = detectLang(clean);

  let rawAudio: ArrayBuffer | null = null;
  if (lang.code === 'en') {
    const seUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(
      clean.slice(0, 260)
    )}`;
    rawAudio = await fetchBinaryBridge(seUrl, 6500);
  }

  if (!rawAudio) {
    const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      lang.code
    )}&q=${encodeURIComponent(clean.slice(0, 180))}`;
    rawAudio = await fetchBinaryBridge(gUrl, 6500);
  }

  if (!rawAudio) {
    rawAudio = await synthesizeNativeSpeechWav(clean.slice(0, 260), lang.tag);
  }

  if (!rawAudio) return null;
  return decodeAndResampleAudio(rawAudio, ctx, targetSampleRate);
}

/**
 * Prepares per-shot synchronized mono PCM voiceover cues when Voiceover is toggled ON.
 * Never throws — gracefully returns empty array if offline.
 */
export async function prepareOptionalVoiceoverCues(
  project: CompiledFilmProject,
  targetSampleRate: number
): Promise<VoiceCue[]> {
  if (!project.includeVoiceover) return [];

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return [];

  const ctx = new AudioCtx();
  const cues: VoiceCue[] = [];
  let minNextStartSample = Math.floor(targetSampleRate * 0.25);
  let lastCaption = '';

  try {
    // Cap to 14 distinct spoken beats so multi-minute renders stay fast
    const eligibleShots = project.shots.slice(0, 14);
    for (const shot of eligibleShots) {
      const cap = shot.caption.trim();
      if (!cap || cap === lastCaption) continue;
      lastCaption = cap;

      const pcm = await synthesizeCaptionToPcm(cap, ctx, targetSampleRate);
      if (pcm && pcm.length > 0) {
        const desiredStart = Math.floor((shot.startSec + 0.18) * targetSampleRate);
        const actualStart = Math.max(minNextStartSample, desiredStart);
        const maxAllowedEnd = Math.floor((project.totalSeconds - 0.15) * targetSampleRate);
        if (actualStart < maxAllowedEnd) {
          const clipped =
            actualStart + pcm.length > maxAllowedEnd
              ? pcm.subarray(0, maxAllowedEnd - actualStart)
              : pcm;
          cues.push({ startSample: actualStart, pcm: clipped });
          minNextStartSample = actualStart + clipped.length + Math.floor(targetSampleRate * 0.18);
        }
      }
    }
  } catch {
    // Ignore
  } finally {
    await ctx.close().catch(() => {});
  }

  return cues;
}

function deterministicWhiteNoise(sampleIndex: number): number {
  let x = (sampleIndex + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x / 2147483648) - 1;
}

function chordWeightsAtTime(t: number): [number, number, number] {
  const barDur = 8.0;
  const xfade = 1.4;
  const cyclePos = ((t % (barDur * 3)) + barDur * 3) % (barDur * 3);
  const idx = Math.floor(cyclePos / barDur); // 0, 1, or 2
  const local = cyclePos - idx * barDur;

  const w: [number, number, number] = [0, 0, 0];
  if (local < barDur - xfade) {
    w[idx] = 1;
  } else {
    const u = (local - (barDur - xfade)) / xfade;
    const nextIdx = (idx + 1) % 3;
    w[idx] = 0.5 * (1 + Math.cos(Math.PI * u));
    w[nextIdx] = 1 - w[idx];
  }
  return w;
}

function evalChordPad(
  baseChord: [number, number, number, number],
  mult: number,
  t: number
): number {
  let pad = 0;
  for (let n = 0; n < 4; n++) {
    const freq = baseChord[n] * mult;
    pad += Math.sin(2 * Math.PI * freq * t + n * 0.7) * (n === 0 ? 0.34 : 0.2);
    pad += Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.1;
  }
  const sub = Math.sin(2 * Math.PI * (baseChord[0] * 0.5 * mult) * t) * 0.26;
  return pad + sub;
}

/**
 * Generates a 100% click-free, phase-continuous streaming audio chunk (Float32Array)
 * containing the Anime Cinema Pad Score + Rain Foley + Sakuga Impact SFX + Synced Voiceover!
 */
export function renderCinemaAudioChunk(
  project: CompiledFilmProject,
  startSample: number,
  numSamples: number,
  sampleRate: number,
  voiceCues: VoiceCue[] = []
): Float32Array {
  const out = new Float32Array(numSamples);
  if (!project.includeScore && voiceCues.length === 0) {
    return out;
  }

  const baseChord = project.colorScript.chordHz;
  const chordMults: [number, number, number] = [1.0, 0.8908987, 1.122462];
  const totalSec = project.totalSeconds;
  const sakugaTimes = project.shots
    .filter((s) => s.sakuga || s.kind === 'sakuga')
    .map((s) => s.startSec + s.durationSec * 0.35);
  const cutTimes = project.shots.slice(1).map((s) => s.startSec);
  const hasRainFoley = project.shots.some((s) => s.weather === 'rain');

  // Pre-warm rain low-pass filter so 1-second chunk seams are 100% seamless
  let lpRain = 0;
  if (project.includeScore && hasRainFoley) {
    const warmStart = Math.max(0, startSample - 20);
    for (let k = warmStart; k < startSample; k++) {
      lpRain = lpRain * 0.86 + deterministicWhiteNoise(k) * 0.14;
    }
  }

  for (let i = 0; i < numSamples; i++) {
    const globalSample = startSample + i;
    const t = globalSample / sampleRate;
    let sample = 0;

    if (project.includeScore) {
      const [w0, w1, w2] = chordWeightsAtTime(t);
      const lfo = 0.74 + 0.26 * Math.sin(t * 0.85);
      let harmonic = 0;
      if (w0 > 0.001) harmonic += w0 * evalChordPad(baseChord, chordMults[0], t);
      if (w1 > 0.001) harmonic += w1 * evalChordPad(baseChord, chordMults[1], t);
      if (w2 > 0.001) harmonic += w2 * evalChordPad(baseChord, chordMults[2], t);
      sample += harmonic * lfo * 0.22;

      if (hasRainFoley) {
        const white = deterministicWhiteNoise(globalSample);
        lpRain = lpRain * 0.86 + white * 0.14;
        sample += lpRain * 0.042;
      }

      // Phase-integrated Sakuga Impact Sub-Boom & Rising Blade Shimmer (perfect at any timestamp!)
      for (const st of sakugaTimes) {
        const dt = t - st;
        if (dt >= 0 && dt < 1.35) {
          const env = Math.exp(-dt * 4.2);
          const boomPhase =
            2 * Math.PI * (38 * dt + (115 / 3.1) * (1 - Math.exp(-3.1 * dt)));
          const boom = Math.sin(boomPhase) * env * 0.46;

          const shimmerPhase = 2 * Math.PI * (1480 * dt + 310 * dt * dt);
          const shimmer = Math.sin(shimmerPhase) * Math.exp(-dt * 7.5) * 0.16;
          sample += boom + shimmer;
        }
      }

      // Zero-click bell chime on Color-Dip cuts
      for (const ct of cutTimes) {
        const dt = t - ct;
        if (dt >= 0 && dt < 0.55) {
          sample +=
            Math.sin(2 * Math.PI * (baseChord[3] * 2) * dt) *
            Math.exp(-dt * 6.5) *
            0.085;
        }
      }
    }

    // Mix synchronized per-shot Voiceover cues with smooth music ducking
    for (let c = 0; c < voiceCues.length; c++) {
      const cue = voiceCues[c];
      const vIdx = globalSample - cue.startSample;
      if (vIdx >= 0 && vIdx < cue.pcm.length) {
        sample = sample * 0.38 + cue.pcm[vIdx] * 0.88;
        break;
      }
    }

    // Master cinema fade-in (0.35s) & fade-out (0.45s)
    let masterEnv = 1;
    if (t < 0.35) masterEnv = t / 0.35;
    else if (totalSec - t < 0.45) masterEnv = Math.max(0, (totalSec - t) / 0.45);

    const finalVal = sample * masterEnv;
    out[i] = finalVal > 0.96 ? 0.96 : finalVal < -0.96 ? -0.96 : finalVal;
  }

  return out;
}
