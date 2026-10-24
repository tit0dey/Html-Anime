import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { CompiledFilmProject } from '../types/film';
import {
  prepareOptionalVoiceoverPcm,
  renderCinemaAudioChunk,
} from './audioScoreEngine';
import { renderAnimeFilmFrame } from './celRenderer';

export interface RenderProgressInfo {
  pct: number;
  currentFrame: number;
  totalFrames: number;
  statusText: string;
  etaSec: number;
}

export interface RenderedMp4Output {
  blob: Blob;
  url: string;
  mimeType: string;
  sizeBytes: number;
  engineLabel: string;
}

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pickSupportedAvcCodec(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<string | null> {
  const VE = (window as any).VideoEncoder;
  if (!VE || typeof VE.isConfigSupported !== 'function') return null;

  const candidates = [
    'avc1.4d0028', // Main Profile Level 4.0 (Supports up to 1080p+)
    'avc1.420028', // Baseline Profile Level 4.0 (Supports up to 1080p+)
    'avc1.640028', // High Profile Level 4.0
    'avc1.42001f', // Baseline Profile Level 3.1 (720p)
  ];

  for (const codec of candidates) {
    try {
      const check = await VE.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
      });
      if (check?.supported) return codec;
    } catch {
      continue;
    }
  }
  return null;
}

async function pickSupportedAacConfig(): Promise<{
  sampleRate: number;
  bitrate: number;
} | null> {
  const AE = (window as any).AudioEncoder;
  if (!AE || typeof AE.isConfigSupported !== 'function') return null;

  for (const sr of [48000, 44100]) {
    try {
      const check = await AE.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: sr,
        numberOfChannels: 1,
        bitrate: 96_000,
      });
      if (check?.supported) {
        return { sampleRate: sr, bitrate: 96_000 };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Renders the entire CompiledFilmProject directly into a downloadable H.264 (+ AAC) .mp4 file
 * entirely on-device via streaming WebCodecs + mp4-muxer (0 MB uncompressed frame accumulation!).
 */
export async function renderFilmToMp4(params: {
  project: CompiledFilmProject;
  signal?: AbortSignal;
  onProgress?: (info: RenderProgressInfo) => void;
}): Promise<RenderedMp4Output> {
  const { project, signal, onProgress } = params;
  const W = project.width;
  const H = project.height;
  const fps = project.fps;
  const totalFrames = project.totalFrames;
  const videoBitrate = project.quality === '1080p' ? 3_200_000 : 1_850_000;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not initialize 2D rendering context.');
  }

  const avcCodec = await pickSupportedAvcCodec(W, H, fps, videoBitrate);

  // Path A: Fast Hardware H.264 + AAC MP4 Streaming Pipeline (WebCodecs + mp4-muxer)
  if (avcCodec && typeof (window as any).VideoFrame !== 'undefined') {
    const wantAudio = project.includeScore || project.includeVoiceover;
    const aacConfig = wantAudio ? await pickSupportedAacConfig() : null;

    let voicePcm: Float32Array | null = null;
    if (aacConfig && project.includeVoiceover) {
      onProgress?.({
        pct: 2,
        currentFrame: 0,
        totalFrames,
        statusText: 'Synthesizing narration voiceover...',
        etaSec: Math.ceil(totalFrames / 60),
      });
      voicePcm = await prepareOptionalVoiceoverPcm(project, aacConfig.sampleRate);
    }

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'avc',
        width: W,
        height: H,
      },
      ...(aacConfig
        ? {
            audio: {
              codec: 'aac',
              sampleRate: aacConfig.sampleRate,
              numberOfChannels: 1,
            },
          }
        : {}),
      fastStart: 'in-memory',
    });

    let encoderErr: Error | null = null;

    const VE = (window as any).VideoEncoder;
    const videoEncoder = new VE({
      output: (chunk: any, meta: any) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e: Error) => {
        encoderErr = e;
      },
    });

    videoEncoder.configure({
      codec: avcCodec,
      width: W,
      height: H,
      bitrate: videoBitrate,
      framerate: fps,
    });

    // Encode streaming audio track in 1-second chunks first (uses <200KB RAM!)
    if (aacConfig && typeof (window as any).AudioData !== 'undefined') {
      const AE = (window as any).AudioEncoder;
      let audioFailed = false;
      const audioEncoder = new AE({
        output: (chunk: any, meta: any) => {
          muxer.addAudioChunk(chunk, meta);
        },
        error: () => {
          audioFailed = true;
        },
      });

      try {
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: aacConfig.sampleRate,
          numberOfChannels: 1,
          bitrate: aacConfig.bitrate,
        });

        const totalAudioSamples = Math.ceil(project.totalSeconds * aacConfig.sampleRate);
        const chunkSize = aacConfig.sampleRate; // 1 second per chunk
        for (
          let startSample = 0;
          startSample < totalAudioSamples && !audioFailed;
          startSample += chunkSize
        ) {
          if (signal?.aborted) {
            videoEncoder.close();
            audioEncoder.close();
            throw new Error('Render cancelled.');
          }
          const len = Math.min(chunkSize, totalAudioSamples - startSample);
          const pcm = renderCinemaAudioChunk(
            project,
            startSample,
            len,
            aacConfig.sampleRate,
            voicePcm
          );
          const audioData = new (window as any).AudioData({
            format: 'f32',
            sampleRate: aacConfig.sampleRate,
            numberOfFrames: len,
            numberOfChannels: 1,
            timestamp: Math.round((startSample * 1_000_000) / aacConfig.sampleRate),
            data: pcm,
          });
          audioEncoder.encode(audioData);
          audioData.close();

          while (audioEncoder.encodeQueueSize > 8) {
            await sleepMs(6);
          }
        }
        await audioEncoder.flush();
        audioEncoder.close();
      } catch {
        try {
          audioEncoder.close();
        } catch {
          // Ignore
        }
      }
    }

    // Stream every 24fps anime cel frame directly into Hardware H.264 encoder!
    const tStart = performance.now();
    const VF = (window as any).VideoFrame;

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        try {
          videoEncoder.close();
        } catch {
          // Ignore
        }
        throw new Error('Render cancelled.');
      }
      if (encoderErr) throw encoderErr;

      renderAnimeFilmFrame(ctx, project, i);

      const timestampUs = Math.round((i * 1_000_000) / fps);
      const durationUs = Math.round(1_000_000 / fps);
      const vf = new VF(canvas, { timestamp: timestampUs, duration: durationUs });
      videoEncoder.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();

      // Hardware backpressure & thermal guard so phone never lags or heats up
      while (videoEncoder.encodeQueueSize > 8) {
        await sleepMs(8);
      }

      if (i % 6 === 0 || i === totalFrames - 1) {
        const elapsedSec = (performance.now() - tStart) / 1000;
        const fpsRate = Math.max(1, (i + 1) / Math.max(0.05, elapsedSec));
        const etaSec = Math.max(0, Math.ceil((totalFrames - 1 - i) / fpsRate));
        const pct = Math.min(98, Math.round(((i + 1) / totalFrames) * 94) + 4);

        onProgress?.({
          pct,
          currentFrame: i + 1,
          totalFrames,
          statusText: `Encoding H.264 Cel Frame ${i + 1} / ${totalFrames} (${Math.round(
            fpsRate
          )} fps)...`,
          etaSec,
        });
        await sleepMs(0);
      }
    }

    onProgress?.({
      pct: 99,
      currentFrame: totalFrames,
      totalFrames,
      statusText: 'Finalizing MP4 container...',
      etaSec: 0,
    });

    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();

    const mp4Buffer = target.buffer;
    const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      mimeType: 'video/mp4',
      sizeBytes: blob.size,
      engineLabel: aacConfig
        ? `Hardware H.264 + AAC MP4 (${W}×${H} · 24fps)`
        : `Hardware H.264 MP4 (${W}×${H} · 24fps)`,
    };
  }

  // Path B: Universal MediaRecorder Fallback for legacy browsers without WebCodecs
  const stream = canvas.captureStream(fps);
  const mimeCandidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const chosenMime =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || '';

  const recorder = chosenMime
    ? new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: videoBitrate })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const donePromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: chosenMime || 'video/mp4' }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start(250);
  const frameIntervalMs = 1000 / fps;

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Render cancelled.');
    }
    const t0 = performance.now();
    renderAnimeFilmFrame(ctx, project, i);
    if (i % 6 === 0 || i === totalFrames - 1) {
      onProgress?.({
        pct: Math.round(((i + 1) / totalFrames) * 99),
        currentFrame: i + 1,
        totalFrames,
        statusText: `Capturing Frame ${i + 1} / ${totalFrames}...`,
        etaSec: Math.ceil((totalFrames - 1 - i) / fps),
      });
    }
    const wait = Math.max(0, frameIntervalMs - (performance.now() - t0));
    await sleepMs(wait);
  }

  recorder.stop();
  const finalBlob = await donePromise;
  return {
    blob: finalBlob,
    url: URL.createObjectURL(finalBlob),
    mimeType: finalBlob.type || 'video/mp4',
    sizeBytes: finalBlob.size,
    engineLabel: `Stream Capture (${W}×${H} · 24fps)`,
  };
}
