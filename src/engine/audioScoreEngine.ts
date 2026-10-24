import { CompiledFilmProject } from '../types/film';
import { fetchBinaryBridge, synthesizeNativeSpeechWav } from './nativeBridge';

function detectLang(text: string): { code: string; tag: string } {
  if (/[\u0980-\u09FF]/.test(text)) return { code: 'bn', tag: 'bn-IN' };
  if (/[\u0900-\u097F]/.test(text)) return { code: 'hi', tag: 'hi-IN' };
  if (/[\u3040-\u30FF]/.test(text)) return { code: 'ja', tag: 'ja-JP' };
  return { code: 'en', tag: 'en-IN' };
}

/**
 * Optionally prepares resampled mono PCM Float32Array narration when Voiceover is toggled ON.
 * Never throws — gracefully returns null if offline.
 */
export async function prepareOptionalVoiceoverPcm(
  project: CompiledFilmProject,
  targetSampleRate: number
): Promise<Float32Array | null> {
  if (!project.includeVoiceover) return null;

  const fullScript = project.shots
    .map((s) => s.caption.trim())
    .filter(Boolean)
    .filter((v, idx, arr) => idx === 0 || v !== arr[idx - 1])
    .join('. ')
    .slice(0, 480);

  if (!fullScript) return null;
  const lang = detectLang(fullScript);

  let rawAudio: ArrayBuffer | null = null;

  if (lang.code === 'en') {
    const seUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(
      fullScript
    )}`;
    rawAudio = await fetchBinaryBridge(seUrl, 7500);
  }

  if (!rawAudio) {
    const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      lang.code
    )}&q=${encodeURIComponent(fullScript.slice(0, 185))}`;
    rawAudio = await fetchBinaryBridge(gUrl, 7500);
  }

  if (!rawAudio) {
    rawAudio = await synthesizeNativeSpeechWav(fullScript, lang.tag);
  }

  if (!rawAudio || rawAudio.byteLength < 256) return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
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
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Generates a 100% deterministic, zero-RAM-bloat streaming audio chunk (Float32Array)
 * containing the Anime Cinema Pad Score + Rain/Wind Foley + Sakuga Impact SFX + Optional Voiceover!
 */
export function renderCinemaAudioChunk(
  project: CompiledFilmProject,
  startSample: number,
  numSamples: number,
  sampleRate: number,
  voicePcm: Float32Array | null
): Float32Array {
  const out = new Float32Array(numSamples);
  if (!project.includeScore && !voicePcm) {
    return out;
  }

  const baseChord = project.colorScript.chordHz;
  const totalSec = project.totalSeconds;
  const sakugaTimes = project.shots
    .filter((s) => s.sakuga)
    .map((s) => s.startSec + s.durationSec * 0.35);
  const cutTimes = project.shots.slice(1).map((s) => s.startSec);
  const hasRainFoley = project.shots[0]?.weather === 'rain';

  const voiceStartSample = Math.floor(sampleRate * 0.65);
  let noiseState = (startSample + 1234567) >>> 0;
  let lpRain = 0;

  for (let i = 0; i < numSamples; i++) {
    const globalSample = startSample + i;
    const t = globalSample / sampleRate;
    let sample = 0;

    if (project.includeScore) {
      // Evolving chord progression shift every 8 seconds
      const bar = Math.floor(t / 8) % 3;
      const rootMult = bar === 1 ? 0.8909 : bar === 2 ? 1.1225 : 1.0;

      // Warm 4-note analog cinema pad + gentle LFO swell
      const lfo = 0.72 + 0.28 * Math.sin(t * 0.85);
      let pad = 0;
      for (let n = 0; n < 4; n++) {
        const freq = baseChord[n] * rootMult;
        pad += Math.sin(2 * Math.PI * freq * t + n * 0.7) * (n === 0 ? 0.34 : 0.2);
        pad += Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.1;
      }
      // Sub-bass heartbeat
      const sub = Math.sin(2 * Math.PI * (baseChord[0] * 0.5 * rootMult) * t) * 0.26;
      sample += (pad * lfo + sub) * 0.22;

      // Soft filtered rain ambiance
      if (hasRainFoley) {
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        const white = (noiseState / 4294967296) * 2 - 1;
        lpRain = lpRain * 0.86 + white * 0.14;
        sample += lpRain * 0.045;
      }

      // Synchronized Sakuga Impact Sub-Drop & Blade Shimmer!
      for (const st of sakugaTimes) {
        const dt = t - st;
        if (dt >= 0 && dt < 1.35) {
          const env = Math.exp(-dt * 4.2);
          const boomFreq = 115 * Math.exp(-dt * 3.1) + 38;
          const boom = Math.sin(2 * Math.PI * boomFreq * t) * env * 0.48;
          const shimmer =
            Math.sin(2 * Math.PI * (1480 + dt * 620) * t) *
            Math.exp(-dt * 7.5) *
            0.18;
          sample += boom + shimmer;
        }
      }

      // Gentle transition chime on Color-Dip cuts
      for (const ct of cutTimes) {
        const dt = t - ct;
        if (dt >= 0 && dt < 0.55) {
          sample +=
            Math.sin(2 * Math.PI * (baseChord[3] * 2) * t) *
            Math.exp(-dt * 6.5) *
            0.09;
        }
      }
    }

    // Mix optional Voiceover PCM cleanly with automatic music ducking
    if (voicePcm) {
      const vIdx = globalSample - voiceStartSample;
      if (vIdx >= 0 && vIdx < voicePcm.length) {
        const vVal = voicePcm[vIdx];
        sample = sample * 0.42 + vVal * 0.88;
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
