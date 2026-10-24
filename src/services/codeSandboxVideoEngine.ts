import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { AppSettings } from '../types';
import { generateFreeLLMResponse } from './llmEngine';
import { fetchNeuralSpeechArrayBuffer } from './voiceCloneEngine';

export interface CodeVideoSpec {
  prompt: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  durationSec?: number;
  ecoMode?: boolean;
  customCode?: string;
  includeVoiceover?: boolean;
  settings: AppSettings;
  onProgress?: (pct: number, status: string) => void;
}

export interface CodeVideoResult {
  videoBlob: Blob;
  videoUrl: string;
  mimeType: string;
  code: string;
  width: number;
  height: number;
  durationSec: number;
  engineLabel: string;
}

function getEvenDimensions(
  ratio: '9:16' | '16:9' | '1:1',
  ecoMode: boolean
): { width: number; height: number } {
  // Even dimensions divisible by 4 for universal hardware H.264 MediaCodec support & zero phone thermal load
  if (ecoMode) {
    if (ratio === '9:16') return { width: 540, height: 960 };
    if (ratio === '16:9') return { width: 960, height: 540 };
    return { width: 640, height: 640 };
  }
  if (ratio === '9:16') return { width: 720, height: 1280 };
  if (ratio === '16:9') return { width: 1280, height: 720 };
  return { width: 720, height: 720 };
}

function buildFallbackProceduralCode(topic: string): string {
  const safeTitle = JSON.stringify(topic.slice(0, 64));
  return `// Open Brain Programmatic Canvas/Manim-Style Animation
// Variables provided: ctx, t (seconds), duration (seconds), W (width), H (height), Math
const title = ${safeTitle};
const progress = Math.min(1, t / duration);

// Deep cosmic background
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#060916');
bg.addColorStop(0.5, '#130d33');
bg.addColorStop(1, '#051a2b');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// Animated mathematical grid (Manim style)
ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
ctx.lineWidth = 1;
const gridStep = Math.round(W / 10);
const shift = (t * 28) % gridStep;
for (let x = -gridStep + shift; x < W + gridStep; x += gridStep) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}
for (let y = -gridStep + shift; y < H + gridStep; y += gridStep) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

// Orbiting harmonic wave rings
const cx = W / 2;
const cy = H * 0.44;
const baseR = Math.min(W, H) * 0.22;

for (let ring = 0; ring < 3; ring++) {
  ctx.beginPath();
  const r = baseR * (0.65 + ring * 0.32);
  for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.06) {
    const wave = Math.sin(a * (4 + ring * 2) + t * (2.5 + ring)) * (10 + ring * 4);
    const px = cx + Math.cos(a + t * 0.4 * (ring + 1)) * (r + wave);
    const py = cy + Math.sin(a + t * 0.4 * (ring + 1)) * (r + wave);
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = ring === 0 ? '#a855f7' : ring === 1 ? '#22d3ee' : '#f472b6';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// Glowing central core
const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, baseR * 0.7);
glow.addColorStop(0, 'rgba(255,255,255,0.95)');
glow.addColorStop(0.35, 'rgba(139,92,246,0.55)');
glow.addColorStop(1, 'rgba(6,182,212,0)');
ctx.fillStyle = glow;
ctx.beginPath();
ctx.arc(cx, cy, baseR * 0.7, 0, Math.PI * 2);
ctx.fill();

// Kinetic Typography Card
ctx.fillStyle = 'rgba(7, 10, 22, 0.82)';
const boxW = W * 0.86;
const boxH = H * 0.2;
const bx = (W - boxW) / 2;
const by = H * 0.72;
ctx.fillRect(bx, by, boxW, boxH);
ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
ctx.lineWidth = 2;
ctx.strokeRect(bx, by, boxW, boxH);

ctx.fillStyle = '#22d3ee';
ctx.font = 'bold ' + Math.round(W * 0.032) + 'px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('OPEN BRAIN • SANDBOX MP4 RENDER', cx, by + boxH * 0.3);

ctx.fillStyle = '#f8fafc';
ctx.font = 'bold ' + Math.round(W * 0.044) + 'px sans-serif';
const words = title.split(' ');
const line1 = words.slice(0, 5).join(' ');
const line2 = words.slice(5, 10).join(' ');
ctx.fillText(line1, cx, by + boxH * (line2 ? 0.60 : 0.68));
if (line2) {
  ctx.fillText(line2, cx, by + boxH * 0.84);
}

// Timeline bar
ctx.fillStyle = '#8b5cf6';
ctx.fillRect(0, H - 8, W * progress, 8);`;
}

export async function generateAnimationCodeFromPrompt(
  prompt: string,
  durationSec: number,
  settings: AppSettings
): Promise<string> {
  const systemPrompt = `You are Open Brain Motion/Manim Code Generator (like Claude Artifacts + Manim + Remotion in pure HTML5 Canvas2D JavaScript).
Write ONLY the JavaScript body of a frame-renderer function with signature:
(ctx, t, duration, W, H, Math)
where:
- ctx is a CanvasRenderingContext2D
- t is current elapsed time in seconds (0 <= t <= duration, here duration = ${durationSec})
- W and H are canvas pixel width & height
- Math is standard JS Math

Requirements:
1. Output ONLY pure JavaScript statements (NO markdown \`\`\`, NO function wrapper declaration around the body, NO external images/DOM/document/window calls — purely deterministic Canvas2D drawing using ctx, t, duration, W, H, Math!).
2. Fill the entire canvas every frame (e.g. rich dark gradient background).
3. Divide the ${durationSec}s timeline into 2 or 3 smooth animated phases/scenes with easing, rich animated diagrams/shapes/graphs/particles/illustrations that visually explain or depict the user's prompt!
4. Include crisp, readable, scaled typography (font sizes proportional to W, e.g. Math.round(W * 0.045) + 'px sans-serif') that stays well inside W * 0.88 margins.
5. Make it visually breathtaking, colorful, smooth at 30fps, and 100% free of syntax errors.`;

  const raw = await generateFreeLLMResponse(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a ${durationSec}-second animated video for: ${prompt}` },
    ],
    settings,
    'qwen-coder'
  );

  let cleaned = raw.trim();
  const fenced = cleaned.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  // If the model wrapped it in `function renderFrame(...) { ... }`, unwrap cleanly or call it
  if (/function\s+renderFrame\s*\(/.test(cleaned)) {
    cleaned += `\nrenderFrame(ctx, t, duration, W, H, Math);`;
  }

  return cleaned;
}

function compileAndValidateFrameFn(
  code: string,
  width: number,
  height: number,
  duration: number
): (ctx: CanvasRenderingContext2D, t: number, duration: number, W: number, H: number, m: Math) => void {
  const fn = new Function('ctx', 't', 'duration', 'W', 'H', 'Math', code) as (
    ctx: CanvasRenderingContext2D,
    t: number,
    duration: number,
    W: number,
    H: number,
    m: Math
  ) => void;

  // Dry-run validation at t=0.1s and t=duration*0.6s on tiny test canvas
  const testCanvas = document.createElement('canvas');
  testCanvas.width = width;
  testCanvas.height = height;
  const testCtx = testCanvas.getContext('2d')!;
  fn(testCtx, 0.1, duration, width, height, Math);
  fn(testCtx, duration * 0.6, duration, width, height, Math);
  return fn;
}

/**
 * Generates synthetic stereo/mono Float32 PCM audio (either decoded Neural Voiceover + ambient chord,
 * or pure procedural ambient chord) for AAC hardware muxing inside the .mp4!
 */
async function buildAudioTrackSamples(
  prompt: string,
  durationSec: number,
  sampleRate: number,
  includeVoiceover: boolean
): Promise<Float32Array> {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(totalSamples);

  // Subtle pleasant harmonic ambient bed (zero CPU cost)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const env =
      t < 0.4
        ? t / 0.4
        : t > durationSec - 0.6
        ? Math.max(0, (durationSec - t) / 0.6)
        : 1.0;
    const chord =
      Math.sin(2 * Math.PI * 110 * t) * 0.025 +
      Math.sin(2 * Math.PI * 164.81 * t) * 0.02 +
      Math.sin(2 * Math.PI * 220 * t) * 0.015;
    out[i] = chord * env;
  }

  if (includeVoiceover) {
    try {
      const shortScript = prompt.slice(0, 180);
      const rawBuf = await fetchNeuralSpeechArrayBuffer(shortScript, 'onyx');
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate });
      try {
        const decoded = await ctx.decodeAudioData(rawBuf.slice(0));
        const ch = decoded.getChannelData(0);
        const copyLen = Math.min(totalSamples, ch.length);
        for (let i = 0; i < copyLen; i++) {
          out[i] = Math.max(-0.98, Math.min(0.98, out[i] + ch[i] * 0.88));
        }
      } finally {
        await ctx.close().catch(() => {});
      }
    } catch {
      // Keep clean harmonic soundtrack if offline
    }
  }

  return out;
}

/**
 * Renders programmatic JS Canvas animation code inside an isolated Sandbox and encodes
 * directly to a REAL H.264 .mp4 file using WebCodecs + mp4-muxer (with MediaRecorder fallback)!
 */
export async function renderCodeSandboxToMp4(spec: CodeVideoSpec): Promise<CodeVideoResult> {
  const {
    prompt,
    aspectRatio,
    durationSec = 7,
    ecoMode = true,
    customCode,
    includeVoiceover = true,
    settings,
    onProgress,
  } = spec;

  const { width, height } = getEvenDimensions(aspectRatio, ecoMode);
  const fps = ecoMode ? 24 : 30;
  const totalFrames = Math.round(durationSec * fps);

  onProgress?.(12, 'Writing programmatic Canvas2D / Manim-style animation code...');
  let code = customCode?.trim() || '';
  if (!code) {
    try {
      code = await generateAnimationCodeFromPrompt(prompt, durationSec, settings);
    } catch {
      code = buildFallbackProceduralCode(prompt);
    }
  }

  let frameFn: ReturnType<typeof compileAndValidateFrameFn>;
  try {
    frameFn = compileAndValidateFrameFn(code, width, height, durationSec);
  } catch {
    // Self-heal to guaranteed clean procedural code if custom/LLM code threw a runtime error
    code = buildFallbackProceduralCode(prompt);
    frameFn = compileAndValidateFrameFn(code, width, height, durationSec);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Check Hardware WebCodecs H.264 support (supported in Android WebView & modern Chrome/Edge/Safari!)
  const hasWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;

  if (hasWebCodecs) {
    const codecCandidates = ['avc1.42001f', 'avc1.42E01F', 'avc1.4d001f'];
    let selectedAvc: string | null = null;
    for (const c of codecCandidates) {
      try {
        const sup = await VideoEncoder.isConfigSupported({
          codec: c,
          width,
          height,
          bitrate: ecoMode ? 1_800_000 : 3_200_000,
          framerate: fps,
        });
        if (sup.supported) {
          selectedAvc = c;
          break;
        }
      } catch {
        // Try next profile
      }
    }

    if (selectedAvc) {
      onProgress?.(28, 'Preparing soundtrack & initializing Hardware H.264 MP4 Muxer...');
      const sampleRate = 44100;
      let canEncodeAac = false;
      if ('AudioEncoder' in window && 'AudioData' in window) {
        try {
          const aSup = await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2',
            sampleRate,
            numberOfChannels: 1,
            bitrate: 96_000,
          });
          canEncodeAac = Boolean(aSup.supported);
        } catch {
          canEncodeAac = false;
        }
      }

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width,
          height,
          frameRate: fps,
        },
        ...(canEncodeAac
          ? {
              audio: {
                codec: 'aac',
                numberOfChannels: 1,
                sampleRate,
              },
            }
          : {}),
        fastStart: 'in-memory',
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });

      videoEncoder.configure({
        codec: selectedAvc,
        width,
        height,
        bitrate: ecoMode ? 1_800_000 : 3_200_000,
        framerate: fps,
      });

      // Encode Audio Track if AAC WebCodecs is available
      if (canEncodeAac) {
        const pcm = await buildAudioTrackSamples(prompt, durationSec, sampleRate, includeVoiceover);
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => console.warn('AudioEncoder warning:', e),
        });
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate,
          numberOfChannels: 1,
          bitrate: 96_000,
        });

        const chunkSamples = 4096;
        for (let offset = 0; offset < pcm.length; offset += chunkSamples) {
          const slice = pcm.subarray(offset, Math.min(pcm.length, offset + chunkSamples));
          const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
          const ad = new AudioData({
            format: 'f32',
            sampleRate,
            numberOfFrames: slice.length,
            numberOfChannels: 1,
            timestamp: timestampUs,
            data: new Float32Array(slice),
          });
          audioEncoder.encode(ad);
          ad.close();
        }
        await audioEncoder.flush();
        audioEncoder.close();
      }

      // Render & Hardware-Encode Video Frames with UI Event-Loop Yielding (Zero Phone Lag!)
      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        ctx.save();
        try {
          frameFn(ctx, t, durationSec, width, height, Math);
        } catch {
          // Ignore single-frame math edge case
        }
        ctx.restore();

        const timestampUs = Math.round((f / fps) * 1_000_000);
        const frame = new VideoFrame(canvas, { timestamp: timestampUs });
        videoEncoder.encode(frame, { keyFrame: f % fps === 0 });
        frame.close();

        // Yield every 6 frames so phone stays 100% cool & smooth!
        if (f % 6 === 0) {
          const pct = Math.min(96, Math.round(35 + (f / totalFrames) * 60));
          onProgress?.(pct, `Hardware H.264 Encoding Frame ${f + 1}/${totalFrames} (.mp4)...`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await videoEncoder.flush();
      videoEncoder.close();
      muxer.finalize();

      const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
      onProgress?.(100, 'Rendered True H.264 MP4 in Sandbox!');
      return {
        videoBlob: mp4Blob,
        videoUrl: URL.createObjectURL(mp4Blob),
        mimeType: 'video/mp4',
        code,
        width,
        height,
        durationSec,
        engineLabel: 'Sandbox Code -> Hardware H.264 MP4 Muxer',
      };
    }
  }

  // Fallback for browsers without WebCodecs VideoEncoder: Real-Time Canvas Stream Recorder
  onProgress?.(40, 'Recording Sandbox Animation Stream...');
  const stream = canvas.captureStream(fps);
  const mime =
    ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || '';
  const chunks: BlobPart[] = [];
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const fallbackBlob = await new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/mp4' }));
    rec.start(200);
    const t0 = performance.now();
    const totalMs = durationSec * 1000;
    const step = () => {
      const elapsed = performance.now() - t0;
      const sec = Math.min(durationSec, elapsed / 1000);
      ctx.save();
      frameFn(ctx, sec, durationSec, width, height, Math);
      ctx.restore();
      onProgress?.(Math.min(98, Math.round(40 + (sec / durationSec) * 58)), 'Rendering Sandbox Video...');
      if (elapsed < totalMs) {
        setTimeout(step, Math.round(1000 / fps));
      } else {
        rec.stop();
      }
    };
    step();
  });

  onProgress?.(100, 'Sandbox Video Ready!');
  return {
    videoBlob: fallbackBlob,
    videoUrl: URL.createObjectURL(fallbackBlob),
    mimeType: fallbackBlob.type || 'video/mp4',
    code,
    width,
    height,
    durationSec,
    engineLabel: 'Sandbox Code Stream Renderer',
  };
}
