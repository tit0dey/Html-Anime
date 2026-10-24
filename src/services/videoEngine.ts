import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { AppSettings, VideoEngineType, VideoScene } from '../types';
import { renderCodeSandboxToMp4 } from './codeSandboxVideoEngine';
import { buildFluxImageUrl, preloadImageAsObjectUrl } from './imageEngine';
import { extractJsonObject, generateFreeLLMResponse } from './llmEngine';
import { fetchNeuralSpeechArrayBuffer } from './voiceCloneEngine';

interface DirectorPlan {
  scenes: Array<{
    visualPrompt: string;
    narration: string;
    subtitle: string;
    motion?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  }>;
}

async function tryOpenSourceDiffusionVideo(
  prompt: string,
  hfToken: string,
  onProgress: (pct: number, msg: string) => void
): Promise<{ videoBlob: Blob; spaceUsed: string } | null> {
  const searchQueries = ['LTX-Video', 'Wan2.1', 'AnimateDiff-Lightning', 'CogVideoX'];
  const headers: Record<string, string> = {};
  if (hfToken.trim()) {
    headers.Authorization = `Bearer ${hfToken.trim()}`;
  }

  for (const q of searchQueries) {
    try {
      onProgress(12, `Discovering live Open-Source ${q} GPU nodes on HuggingFace...`);
      const resp = await fetch(
        `https://huggingface.co/api/spaces?search=${encodeURIComponent(
          q
        )}&sort=likes&direction=-1&limit=6&full=true`
      );
      if (!resp.ok) continue;
      const list = await resp.json();
      const running = (Array.isArray(list) ? list : []).filter(
        (s: any) => s?.runtime?.stage === 'RUNNING' && s?.subdomain
      );

      for (const sp of running.slice(0, 2)) {
        const baseUrl = `https://${sp.subdomain}.hf.space`;
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 7000);
          const infoResp = await fetch(`${baseUrl}/gradio_api/info`, {
            headers,
            signal: ctrl.signal,
          }).catch(() => fetch(`${baseUrl}/info`, { headers, signal: ctrl.signal }));
          clearTimeout(t);
          if (!infoResp || !infoResp.ok) continue;

          const info = await infoResp.json();
          const apiPrefix = infoResp.url.includes('/gradio_api/') ? '/gradio_api' : '';
          const endpoints = info?.named_endpoints || {};
          const candidate = Object.entries(endpoints).find(([epName, meta]: [string, any]) => {
            const params = meta?.parameters || [];
            const returns = meta?.returns || [];
            const hasPrompt = params.some(
              (p: any) =>
                String(p?.type || p?.component || '').toLowerCase().includes('str') ||
                String(p?.component || '').toLowerCase().includes('textbox')
            );
            const returnsVideo = returns.some((r: any) =>
              JSON.stringify(r).toLowerCase().includes('video')
            );
            return (
              hasPrompt &&
              returnsVideo &&
              !epName.toLowerCase().includes('i2v') &&
              params.every(
                (p: any, idx: number) =>
                  idx === 0 ||
                  p.parameter_has_default ||
                  String(p.component || '').toLowerCase() !== 'image'
              )
            );
          });

          if (!candidate) continue;
          const [epName, epMeta] = candidate as [string, any];
          const cleanEp = epName.replace(/^\//, '');
          const args = (epMeta.parameters as any[]).map((p, idx) => {
            if (idx === 0) return prompt;
            if (p.parameter_has_default) return p.parameter_default;
            return '';
          });

          onProgress(28, `Submitting diffusion job to ${sp.id}...`);
          const callResp = await fetch(`${baseUrl}${apiPrefix}/call/${cleanEp}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: args }),
          });
          if (!callResp.ok) continue;
          const { event_id } = await callResp.json();
          if (!event_id) continue;

          onProgress(48, `Rendering neural video frames on ${sp.id} ZeroGPU...`);
          const sseCtrl = new AbortController();
          const sseTimer = setTimeout(() => sseCtrl.abort(), 45000);
          const sseResp = await fetch(`${baseUrl}${apiPrefix}/call/${cleanEp}/${event_id}`, {
            headers,
            signal: sseCtrl.signal,
          });
          const sseText = await sseResp.text();
          clearTimeout(sseTimer);

          const completeMatch = sseText.match(/event:\s*complete\s*\ndata:\s*(\[[\s\S]*?\])\n/);
          if (!completeMatch) continue;
          const outArr = JSON.parse(completeMatch[1]);
          let videoUrl = '';
          for (const item of outArr) {
            if (!item) continue;
            if (typeof item === 'string' && item.startsWith('http')) {
              videoUrl = item;
              break;
            }
            if (item?.video?.url) {
              videoUrl = item.video.url;
              break;
            }
            if (item?.url) {
              videoUrl = item.url;
              break;
            }
            if (item?.path) {
              videoUrl = `${baseUrl}${apiPrefix}/file=${item.path}`;
              break;
            }
          }
          if (!videoUrl) continue;

          onProgress(88, `Downloading MP4 video stream from ${sp.id}...`);
          const vResp = await fetch(videoUrl);
          if (vResp.ok) {
            const videoBlob = await vResp.blob();
            if (videoBlob.size > 4000) {
              return { videoBlob, spaceUsed: sp.id };
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export async function generateOpenBrainVideo(params: {
  prompt: string;
  engine: VideoEngineType;
  aspectRatio: '9:16' | '16:9' | '1:1';
  sceneCount?: number;
  voice?: 'onyx' | 'alloy' | 'nova' | 'echo';
  customCode?: string;
  settings: AppSettings;
  onProgress: (pct: number, message: string) => void;
}): Promise<{
  videoBlob: Blob;
  videoUrl: string;
  mimeType: string;
  thumbnailUrl?: string;
  generatedCode?: string;
  scenes: VideoScene[];
  spaceUsed: string;
}> {
  const {
    prompt,
    engine,
    aspectRatio,
    sceneCount = 3,
    voice = 'onyx',
    customCode,
    settings,
    onProgress,
  } = params;

  // MODE 1: Claude-Style Programmatic Code -> Sandbox H.264 MP4 Renderer!
  if (engine === 'claude-code-mp4') {
    const codeOut = await renderCodeSandboxToMp4({
      prompt,
      aspectRatio,
      durationSec: sceneCount * 3,
      ecoMode: settings.featherlightEcoMode,
      customCode,
      includeVoiceover: true,
      settings,
      onProgress,
    });
    return {
      videoBlob: codeOut.videoBlob,
      videoUrl: codeOut.videoUrl,
      mimeType: codeOut.mimeType,
      generatedCode: codeOut.code,
      scenes: [],
      spaceUsed: codeOut.engineLabel,
    };
  }

  // MODE 2: HuggingFace ZeroGPU Diffusion (Wan2.1 / LTX-Video / CogVideoX)
  if (engine === 'hf-wan-diffusion') {
    const diffResult = await tryOpenSourceDiffusionVideo(prompt, settings.hfToken, onProgress);
    if (diffResult) {
      const url = URL.createObjectURL(diffResult.videoBlob);
      onProgress(100, `Completed on ${diffResult.spaceUsed}!`);
      return {
        videoBlob: diffResult.videoBlob,
        videoUrl: url,
        mimeType: diffResult.videoBlob.type || 'video/mp4',
        scenes: [],
        spaceUsed: `HuggingFace ZeroGPU (${diffResult.spaceUsed})`,
      };
    }
    onProgress(
      20,
      'Public ZeroGPU queues are busy — seamlessly engaging Flux Cinema MP4 Engine...'
    );
  }

  // MODE 3: Flux Cinema Director -> Hardware H.264 .mp4 Muxer!
  onProgress(10, 'AI Director writing multi-shot visual script & voiceover...');

  const directorSystem = `You are an elite AI Film Director. Create a ${sceneCount}-scene short video storyboard for the user's topic.
Return ONLY valid JSON matching:
{
  "scenes": [
    {
      "visualPrompt": "ultra-detailed cinematic photorealistic English prompt for Flux image generation, dramatic lighting, 8k",
      "narration": "short punchy spoken voiceover sentence (10-16 words)",
      "subtitle": "concise caption for screen (max 12 words)",
      "motion": "zoom-in"
    }
  ]
}`;

  let scenes: VideoScene[] = [];
  try {
    const rawScript = await generateFreeLLMResponse(
      [
        { role: 'system', content: directorSystem },
        { role: 'user', content: prompt },
      ],
      settings,
      'openai'
    );
    const parsed = extractJsonObject<DirectorPlan>(rawScript);
    if (parsed?.scenes && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
      const motions: Array<VideoScene['motion']> = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
      scenes = parsed.scenes.slice(0, sceneCount).map((s, idx) => ({
        index: idx,
        visualPrompt: s.visualPrompt || `${prompt}, cinematic shot ${idx + 1}, dramatic lighting`,
        narration: s.narration || prompt,
        subtitle: s.subtitle || s.narration || prompt.slice(0, 60),
        motion: s.motion || motions[idx % motions.length],
      }));
    }
  } catch {
    // Fallback below
  }

  if (scenes.length === 0) {
    const fallbackMotions: Array<VideoScene['motion']> = ['zoom-in', 'pan-right', 'zoom-out'];
    scenes = Array.from({ length: sceneCount }, (_, idx) => ({
      index: idx,
      visualPrompt: `${prompt}, cinematic shot ${idx + 1}, ultra detailed, volumetric lighting, 8k`,
      narration: idx === 0 ? prompt : `Scene ${idx + 1}: ${prompt}`,
      subtitle: prompt.slice(0, 65),
      motion: fallbackMotions[idx % fallbackMotions.length],
    }));
  }

  const eco = settings.featherlightEcoMode;
  const canvasW = aspectRatio === '9:16' ? (eco ? 540 : 720) : aspectRatio === '16:9' ? (eco ? 960 : 1280) : 640;
  const canvasH = aspectRatio === '9:16' ? (eco ? 960 : 1280) : aspectRatio === '16:9' ? (eco ? 540 : 720) : 640;

  onProgress(28, `Generating ${scenes.length} Flux HD keyframes & Neural Voiceover in parallel...`);
  const fullNarration = scenes.map((s) => s.narration).join(' ... ');

  const localObjectUrls: string[] = [];
  const [loadedImages, narrationBufferRaw] = await Promise.all([
    Promise.all(
      scenes.map(async (scene, i) => {
        const fluxUrl = buildFluxImageUrl({
          prompt: scene.visualPrompt,
          model: 'flux-realism',
          width: canvasW,
          height: canvasH,
          seed: Math.floor(Math.random() * 900000) + i * 137,
        });
        scene.imageUrl = fluxUrl;
        try {
          const objUrl = await preloadImageAsObjectUrl(fluxUrl, 34000);
          localObjectUrls.push(objUrl);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Decode error'));
            img.src = objUrl;
          });
          return img;
        } catch {
          return null;
        }
      })
    ),
    fetchNeuralSpeechArrayBuffer(fullNarration, voice).catch(() => null),
  ]);

  const sampleRate = 44100;
  let decodedVoice: AudioBuffer | null = null;
  if (narrationBufferRaw) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const decodeCtx = new AudioCtx({ sampleRate });
    try {
      decodedVoice = await decodeCtx.decodeAudioData(narrationBufferRaw.slice(0));
    } catch {
      decodedVoice = null;
    } finally {
      await decodeCtx.close().catch(() => {});
    }
  }

  const totalDurationSec = decodedVoice
    ? Math.max(scenes.length * 3.2, Math.min(26, decodedVoice.duration + 0.8))
    : scenes.length * 3.5;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  const drawCinemaAtTime = (sec: number) => {
    const overall = Math.min(1, sec / totalDurationSec);
    const exactScene = Math.min(scenes.length - 0.0001, (sec / totalDurationSec) * scenes.length);
    const sIdx = Math.floor(exactScene);
    const localP = exactScene - sIdx;

    const drawLayer = (img: HTMLImageElement | null, idx: number, p: number, motion: VideoScene['motion'], alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (img) {
        let scale = 1.08;
        let tx = 0;
        let ty = 0;
        if (motion === 'zoom-in') scale = 1.0 + p * 0.15;
        else if (motion === 'zoom-out') scale = 1.15 - p * 0.13;
        else if (motion === 'pan-right') {
          scale = 1.14;
          tx = (p - 0.5) * canvasW * 0.08;
        } else {
          scale = 1.14;
          tx = (0.5 - p) * canvasW * 0.08;
          ty = (p - 0.5) * canvasH * 0.03;
        }
        const imgRatio = img.width / img.height;
        const cRatio = canvasW / canvasH;
        const drawW = imgRatio > cRatio ? canvasH * imgRatio : canvasW;
        const drawH = imgRatio > cRatio ? canvasH : canvasW / imgRatio;
        ctx.translate(canvasW / 2 + tx, canvasH / 2 + ty);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        const h1 = [265, 195, 315, 220][idx % 4];
        g.addColorStop(0, `hsl(${h1}, 70%, 16%)`);
        g.addColorStop(1, '#06080F');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
      ctx.restore();
    };

    ctx.fillStyle = '#05070C';
    ctx.fillRect(0, 0, canvasW, canvasH);
    drawLayer(loadedImages[sIdx], sIdx, localP, scenes[sIdx].motion, 1);
    if (localP > 0.82 && sIdx + 1 < scenes.length) {
      drawLayer(loadedImages[sIdx + 1], sIdx + 1, 0, scenes[sIdx + 1].motion, (localP - 0.82) / 0.18);
    }

    const vig = ctx.createLinearGradient(0, canvasH * 0.58, 0, canvasH);
    vig.addColorStop(0, 'rgba(5,7,12,0)');
    vig.addColorStop(1, 'rgba(5,7,12,0.92)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, canvasH * 0.58, canvasW, canvasH * 0.42);

    const subtitleText = scenes[sIdx].subtitle || scenes[sIdx].narration;
    const fontSize = Math.round(canvasW * (aspectRatio === '16:9' ? 0.033 : 0.048));
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapCanvasText(ctx, subtitleText, canvasW * 0.84);
    const baseSubY = canvasH - canvasH * 0.13 - (lines.length - 1) * (fontSize * 1.3) * 0.5;
    lines.forEach((line, lIdx) => {
      const ly = baseSubY + lIdx * fontSize * 1.32;
      ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
      ctx.strokeStyle = 'rgba(0,0,0,0.88)';
      ctx.strokeText(line, canvasW / 2, ly);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(line, canvasW / 2, ly);
    });

    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(0, canvasH - 6, canvasW * overall, 6);
  };

  // Encode directly to Hardware H.264 .mp4 via WebCodecs + mp4-muxer when supported!
  const fps = eco ? 24 : 30;
  const totalFrames = Math.round(totalDurationSec * fps);

  if (typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window) {
    let avcCodec: string | null = null;
    for (const c of ['avc1.42001f', 'avc1.42E01F']) {
      try {
        const sup = await VideoEncoder.isConfigSupported({
          codec: c,
          width: canvasW,
          height: canvasH,
          bitrate: eco ? 2_000_000 : 3_600_000,
          framerate: fps,
        });
        if (sup.supported) {
          avcCodec = c;
          break;
        }
      } catch {
        // continue
      }
    }

    if (avcCodec) {
      let canAac = false;
      if ('AudioEncoder' in window && 'AudioData' in window) {
        try {
          const aSup = await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2',
            sampleRate,
            numberOfChannels: 1,
            bitrate: 96_000,
          });
          canAac = Boolean(aSup.supported);
        } catch {
          canAac = false;
        }
      }

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: canvasW, height: canvasH, frameRate: fps },
        ...(canAac ? { audio: { codec: 'aac', numberOfChannels: 1, sampleRate } } : {}),
        fastStart: 'in-memory',
      });

      const vEnc = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error(e),
      });
      vEnc.configure({
        codec: avcCodec,
        width: canvasW,
        height: canvasH,
        bitrate: eco ? 2_000_000 : 3_600_000,
        framerate: fps,
      });

      if (canAac) {
        const totalSamples = Math.floor(totalDurationSec * sampleRate);
        const pcm = new Float32Array(totalSamples);
        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          pcm[i] = Math.sin(2 * Math.PI * 110 * t) * 0.02 + Math.sin(2 * Math.PI * 164.81 * t) * 0.015;
        }
        if (decodedVoice) {
          const vCh = decodedVoice.getChannelData(0);
          const offsetStart = Math.floor(0.2 * sampleRate);
          for (let i = 0; i < vCh.length && i + offsetStart < totalSamples; i++) {
            pcm[i + offsetStart] = Math.max(-0.98, Math.min(0.98, pcm[i + offsetStart] + vCh[i] * 0.9));
          }
        }
        const aEnc = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: () => {},
        });
        aEnc.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 1, bitrate: 96_000 });
        for (let off = 0; off < pcm.length; off += 4096) {
          const slice = pcm.subarray(off, Math.min(pcm.length, off + 4096));
          const ad = new AudioData({
            format: 'f32',
            sampleRate,
            numberOfFrames: slice.length,
            numberOfChannels: 1,
            timestamp: Math.round((off / sampleRate) * 1_000_000),
            data: new Float32Array(slice),
          });
          aEnc.encode(ad);
          ad.close();
        }
        await aEnc.flush();
        aEnc.close();
      }

      for (let f = 0; f < totalFrames; f++) {
        drawCinemaAtTime(f / fps);
        const vf = new VideoFrame(canvas, { timestamp: Math.round((f / fps) * 1_000_000) });
        vEnc.encode(vf, { keyFrame: f % fps === 0 });
        vf.close();
        if (f % 6 === 0) {
          onProgress(Math.min(98, Math.round(58 + (f / totalFrames) * 40)), `Hardware MP4 Encoding ${Math.round((f / totalFrames) * 100)}%...`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await vEnc.flush();
      vEnc.close();
      muxer.finalize();

      // Free temporary image ObjectURLs immediately to keep phone RAM spotless!
      localObjectUrls.forEach((u) => URL.revokeObjectURL(u));

      const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
      onProgress(100, 'HD MP4 Cinema Video Ready!');
      return {
        videoBlob: mp4Blob,
        videoUrl: URL.createObjectURL(mp4Blob),
        mimeType: 'video/mp4',
        thumbnailUrl: scenes[0]?.imageUrl,
        scenes,
        spaceUsed: 'Flux-Realism + Neural Audio -> Hardware H.264 MP4',
      };
    }
  }

  // Fallback stream recorder if WebCodecs unavailable
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const fallbackBlob = await new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }));
    rec.start(250);
    const t0 = performance.now();
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      drawCinemaAtTime(Math.min(totalDurationSec, el));
      if (el < totalDurationSec) setTimeout(tick, Math.round(1000 / fps));
      else rec.stop();
    };
    tick();
  });

  localObjectUrls.forEach((u) => URL.revokeObjectURL(u));
  onProgress(100, 'Video Ready!');
  return {
    videoBlob: fallbackBlob,
    videoUrl: URL.createObjectURL(fallbackBlob),
    mimeType: fallbackBlob.type || 'video/webm',
    thumbnailUrl: scenes[0]?.imageUrl,
    scenes,
    spaceUsed: 'Flux-Realism Cinema Engine',
  };
}
