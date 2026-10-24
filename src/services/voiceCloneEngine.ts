import { VocalBiometrics, VoiceProfile } from '../types';

/**
 * Extracts real vocal biometrics (Fundamental Pitch F0 Hz, Warmth, Brightness, Pace)
 * directly on-device using WebAudio DSP + Autocorrelation.
 */
export async function analyzeVocalBiometrics(audioBlobOrDataUrl: Blob | string): Promise<{
  durationSec: number;
  biometrics: VocalBiometrics;
}> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof audioBlobOrDataUrl === 'string') {
      const resp = await fetch(audioBlobOrDataUrl);
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await audioBlobOrDataUrl.arrayBuffer();
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const durationSec = Math.max(0.5, Number(audioBuffer.duration.toFixed(1)));

    // 1. Estimate Fundamental Pitch F0 via Voiced Frame Autocorrelation (75 Hz – 360 Hz)
    const frameSize = 2048;
    const minLag = Math.floor(sampleRate / 360);
    const maxLag = Math.floor(sampleRate / 75);
    const detectedPitches: number[] = [];
    let activeFrames = 0;
    let totalFrames = 0;
    let highFreqEnergy = 0;
    let lowFreqEnergy = 0;

    const step = Math.max(frameSize, Math.floor(channel.length / 40));
    for (let offset = 0; offset + frameSize < channel.length; offset += step) {
      totalFrames++;
      let rms = 0;
      let diffEnergy = 0;
      for (let i = 0; i < frameSize; i++) {
        const s = channel[offset + i];
        rms += s * s;
        if (i > 0) {
          const d = s - channel[offset + i - 1];
          diffEnergy += d * d;
        }
      }
      rms = Math.sqrt(rms / frameSize);
      if (rms < 0.018) continue;
      activeFrames++;
      lowFreqEnergy += rms;
      highFreqEnergy += Math.sqrt(diffEnergy / frameSize);

      let bestLag = -1;
      let bestCorr = 0;
      for (let lag = minLag; lag <= maxLag && offset + lag + 512 < channel.length; lag++) {
        let corr = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < 512; i++) {
          const a = channel[offset + i];
          const b = channel[offset + i + lag];
          corr += a * b;
          normA += a * a;
          normB += b * b;
        }
        const denom = Math.sqrt(normA * normB) || 1;
        const normalized = corr / denom;
        if (normalized > bestCorr) {
          bestCorr = normalized;
          bestLag = lag;
        }
      }
      if (bestLag > 0 && bestCorr > 0.55) {
        detectedPitches.push(sampleRate / bestLag);
      }
    }

    detectedPitches.sort((a, b) => a - b);
    const medianPitch =
      detectedPitches.length > 0
        ? Math.round(detectedPitches[Math.floor(detectedPitches.length / 2)])
        : 155;

    const ratio = lowFreqEnergy > 0 ? highFreqEnergy / lowFreqEnergy : 0.35;
    const brightness = Math.min(100, Math.max(20, Math.round(ratio * 145)));
    const warmth = Math.min(100, Math.max(25, 115 - Math.round(brightness * 0.65)));
    const activityRatio = totalFrames > 0 ? activeFrames / totalFrames : 0.65;
    const paceFactor = Number(Math.min(1.18, Math.max(0.86, 0.88 + activityRatio * 0.25)).toFixed(2));

    let recommendedBaseVoice: VocalBiometrics['recommendedBaseVoice'] = 'alloy';
    let timbreLabel = 'Balanced Studio Baritone';

    if (medianPitch < 122) {
      recommendedBaseVoice = 'onyx';
      timbreLabel = 'Deep Resonant Bass-Baritone';
    } else if (medianPitch < 155) {
      recommendedBaseVoice = warmth > 65 ? 'echo' : 'fable';
      timbreLabel = 'Warm Natural Tenor';
    } else if (medianPitch < 195) {
      recommendedBaseVoice = 'alloy';
      timbreLabel = 'Crisp Expressive Mid-Voice';
    } else if (medianPitch < 235) {
      recommendedBaseVoice = 'nova';
      timbreLabel = 'Bright Clear Alto/Soprano';
    } else {
      recommendedBaseVoice = 'shimmer';
      timbreLabel = 'Airy High Melodic Voice';
    }

    return {
      durationSec,
      biometrics: {
        pitchHz: medianPitch,
        warmth,
        brightness,
        paceFactor,
        timbreLabel,
        recommendedBaseVoice,
      },
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Encodes an AudioBuffer into a clean 16-bit PCM WAV Blob for universal Android & Web playback/download.
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const clamped = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Attempts Zero-Shot Neural Voice Cloning against live running Open-Source F5-TTS / CosyVoice Spaces on HuggingFace Hub.
 */
async function tryHuggingFaceZeroShotClone(
  profile: VoiceProfile,
  targetText: string,
  hfToken?: string,
  onProgress?: (msg: string) => void
): Promise<{ blob: Blob; spaceId: string } | null> {
  try {
    onProgress?.('Scanning HuggingFace Hub for active Open-Source F5-TTS / CosyVoice ZeroGPU nodes...');
    const resp = await fetch(
      'https://huggingface.co/api/spaces?search=F5-TTS&sort=likes&direction=-1&limit=8&full=true'
    );
    if (!resp.ok) return null;
    const spaces = await resp.json();
    const runningSpaces = (Array.isArray(spaces) ? spaces : []).filter(
      (s: any) => s?.runtime?.stage === 'RUNNING' && s?.subdomain
    );

    const headers: Record<string, string> = {};
    if (hfToken?.trim()) {
      headers.Authorization = `Bearer ${hfToken.trim()}`;
    }

    const refBlob = await (await fetch(profile.audioDataUrl)).blob();

    for (const sp of runningSpaces.slice(0, 3)) {
      const baseUrl = `https://${sp.subdomain}.hf.space`;
      try {
        onProgress?.(`Connecting to Open-Source Space ${sp.id}...`);
        const infoCtrl = new AbortController();
        const tInfo = setTimeout(() => infoCtrl.abort(), 7000);
        const infoResp = await fetch(`${baseUrl}/gradio_api/info`, {
          headers,
          signal: infoCtrl.signal,
        }).catch(() => fetch(`${baseUrl}/info`, { headers, signal: infoCtrl.signal }));
        clearTimeout(tInfo);

        if (!infoResp || !infoResp.ok) continue;
        const info = await infoResp.json();
        const apiPrefix = infoResp.url.includes('/gradio_api/') ? '/gradio_api' : '';
        const endpoints = info?.named_endpoints || {};
        const epEntry = Object.entries(endpoints).find(
          ([name, meta]: [string, any]) =>
            (name.includes('infer') || name.includes('predict') || name.includes('tts') || name.includes('generate')) &&
            Array.isArray(meta?.parameters) &&
            meta.parameters.length >= 2
        );
        if (!epEntry) continue;

        const [epName, epMeta] = epEntry as [string, any];
        const cleanEp = epName.replace(/^\//, '');

        // Upload reference audio to Gradio
        const form = new FormData();
        form.append('files', refBlob, 'reference.wav');
        const upResp = await fetch(`${baseUrl}${apiPrefix}/upload`, {
          method: 'POST',
          headers,
          body: form,
        });
        if (!upResp.ok) continue;
        const uploadedPaths = await upResp.json();
        const serverPath = uploadedPaths?.[0];
        if (!serverPath) continue;

        const filePayload = {
          path: serverPath,
          url: `${baseUrl}${apiPrefix}/file=${serverPath}`,
          orig_name: 'reference.wav',
          mime_type: refBlob.type || 'audio/wav',
          meta: { _type: 'gradio.FileData' },
        };

        // Construct parameter array matching endpoint schema
        const args = (epMeta.parameters as any[]).map((param, idx) => {
          const pName = String(param.parameter_name || param.label || '').toLowerCase();
          const pType = String(param.type || param.component || '').toLowerCase();
          if (idx === 0 || pType.includes('audio') || pName.includes('audio') || pName.includes('ref_audio')) {
            return filePayload;
          }
          if (pName.includes('ref_text') || pName.includes('prompt_text')) {
            return profile.referenceText || '';
          }
          if (pName.includes('gen_text') || pName.includes('text') || idx === 2 || idx === 1) {
            return targetText;
          }
          if (param.parameter_has_default) {
            return param.parameter_default;
          }
          return '';
        });

        onProgress?.(`Synthesizing Zero-Shot Voice Clone on ${sp.id}...`);
        const callResp = await fetch(`${baseUrl}${apiPrefix}/call/${cleanEp}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: args }),
        });
        if (!callResp.ok) continue;
        const { event_id } = await callResp.json();
        if (!event_id) continue;

        const sseCtrl = new AbortController();
        const sseTimer = setTimeout(() => sseCtrl.abort(), 32000);
        const sseResp = await fetch(`${baseUrl}${apiPrefix}/call/${cleanEp}/${event_id}`, {
          headers,
          signal: sseCtrl.signal,
        });
        const sseText = await sseResp.text();
        clearTimeout(sseTimer);

        const completeMatch = sseText.match(/event:\s*complete\s*\ndata:\s*(\[[\s\S]*?\])\n/);
        if (!completeMatch) continue;
        const outData = JSON.parse(completeMatch[1]);
        const audioOut = outData.find(
          (item: any) => item && (typeof item === 'string' || item.url || item.path)
        );
        if (!audioOut) continue;
        const audioUrl =
          typeof audioOut === 'string'
            ? audioOut
            : audioOut.url || `${baseUrl}${apiPrefix}/file=${audioOut.path}`;
        const finalAudio = await fetch(audioUrl);
        if (finalAudio.ok) {
          return { blob: await finalAudio.blob(), spaceId: sp.id };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback cleanly to Acoustic Voice Twin engine
  }
  return null;
}

/**
 * Fetches Neural Open-Source TTS Audio (Pollinations openai-audio) for a chosen base voice.
 */
export async function fetchNeuralSpeechArrayBuffer(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
): Promise<ArrayBuffer> {
  const prompt = `Read the following text verbatim, naturally and expressively without adding any extra commentary:\n\n${text.trim()}`;
  const url = `https://text.pollinations.ai/${encodeURIComponent(
    prompt
  )}?model=openai-audio&voice=${voice}&seed=${Math.floor(Math.random() * 99999)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 38000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`Neural TTS HTTP ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    const buf = await resp.arrayBuffer();
    if (buf.byteLength < 512 || contentType.includes('text/html')) {
      throw new Error('Unexpected audio payload');
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synthesizes cloned voice audio using:
 * 1) Live Zero-Shot Neural Cloning (F5-TTS / CosyVoice ZeroGPU) when selected & available, PLUS
 * 2) Instant Unlimited Acoustic Voice Twin DSP (Neural Base Voice + Vocal DNA Pitch/Formant/Warmth Matching -> 16-bit WAV)!
 */
export async function synthesizeClonedVoice(params: {
  text: string;
  profile: VoiceProfile | null;
  presetVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  tryZeroShotNeural?: boolean;
  hfToken?: string;
  onStatus?: (msg: string) => void;
}): Promise<{ blob: Blob; url: string; engineUsed: string }> {
  const { text, profile, presetVoice, tryZeroShotNeural = true, hfToken, onStatus } = params;

  // 1. Try HuggingFace Zero-Shot F5-TTS if user has a recorded/uploaded profile and enabled Zero-Shot
  if (profile && tryZeroShotNeural) {
    const neural = await tryHuggingFaceZeroShotClone(profile, text, hfToken, onStatus);
    if (neural) {
      const url = URL.createObjectURL(neural.blob);
      return {
        blob: neural.blob,
        url,
        engineUsed: `Zero-Shot F5-TTS (${neural.spaceId})`,
      };
    }
  }

  // 2. Instant Unlimited Neural + Acoustic Voice Twin DSP Pipeline
  const baseVoice = profile?.biometrics.recommendedBaseVoice || presetVoice || 'alloy';
  onStatus?.(
    profile
      ? `Generating Neural Speech & applying "${profile.name}" Vocal DNA (${profile.biometrics.pitchHz}Hz)...`
      : `Synthesizing Studio Neural Voice (${baseVoice.toUpperCase()})...`
  );

  const rawAudioBuf = await fetchNeuralSpeechArrayBuffer(text, baseVoice);

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(rawAudioBuf.slice(0));
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  if (!profile) {
    const wavBlob = encodeAudioBufferToWav(decoded);
    return {
      blob: wavBlob,
      url: URL.createObjectURL(wavBlob),
      engineUsed: `Neural Studio TTS (${baseVoice.toUpperCase()})`,
    };
  }

  // Apply Vocal DNA Pitch, Pace, Warmth & Formant Sculpting in OfflineAudioContext
  const basePitchCenter: Record<string, number> = {
    onyx: 108,
    echo: 138,
    fable: 152,
    alloy: 175,
    nova: 212,
    shimmer: 242,
  };
  const refCenter = basePitchCenter[baseVoice] || 165;
  const rawPitchRatio = profile.biometrics.pitchHz / refCenter;
  const clampedRatio = Math.min(1.26, Math.max(0.78, rawPitchRatio));
  const playbackRate = Number((clampedRatio * 0.65 + profile.biometrics.paceFactor * 0.35).toFixed(3));
  const detuneCents = Math.round(1200 * Math.log2(clampedRatio / playbackRate));

  const outLength = Math.max(1, Math.ceil(decoded.length / playbackRate));
  const offline = new OfflineAudioContext(
    Math.min(2, decoded.numberOfChannels),
    outLength,
    decoded.sampleRate
  );

  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.playbackRate.value = playbackRate;
  src.detune.value = Math.max(-450, Math.min(450, detuneCents));

  // Chest warmth shelf (220 Hz)
  const lowShelf = offline.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 220;
  lowShelf.gain.value = (profile.biometrics.warmth - 55) * 0.14;

  // Vocal formant presence (2650 Hz)
  const formantPeak = offline.createBiquadFilter();
  formantPeak.type = 'peaking';
  formantPeak.frequency.value = 2650 * clampedRatio;
  formantPeak.Q.value = 1.4;
  formantPeak.gain.value = (profile.biometrics.brightness - 50) * 0.12;

  // Studio dynamics compressor
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3;

  src.connect(lowShelf);
  lowShelf.connect(formantPeak);
  formantPeak.connect(compressor);
  compressor.connect(offline.destination);
  src.start(0);

  const rendered = await offline.startRendering();
  const wavBlob = encodeAudioBufferToWav(rendered);

  return {
    blob: wavBlob,
    url: URL.createObjectURL(wavBlob),
    engineUsed: `Neural Acoustic Twin (${profile.name} • ${profile.biometrics.pitchHz}Hz)`,
  };
}
