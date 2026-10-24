import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { CompiledFilmProject } from '../types/film';
import {
  VoiceCue,
  prepareOptionalVoiceoverCues,
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

interface SelectedVideoCodec {
  webCodec: string;
  muxerCodec: 'avc' | 'vp9';
  label: string;
}

interface SelectedAudioCodec {
  webCodec: string;
  muxerCodec: 'aac' | 'opus';
  sampleRate: number;
  bitrate: number;
  label: string;
}

async function pickSupportedVideoCodec(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<SelectedVideoCodec | null> {
  const VE = (window as any).VideoEncoder;
  if (!VE || typeof VE.isConfigSupported !== 'function') return null;

  const avcCandidates = [
    'avc1.4d0028', // Main Profile Level 4.0 (720p & 1080p)
    'avc1.420028', // Baseline Profile Level 4.0 (720p & 1080p)
    'avc1.640028', // High Profile Level 4.0
    'avc1.42001f', // Baseline Profile Level 3.1 (720p)
  ];

  for (const codec of avcCandidates) {
    try {
      const check = await VE.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
      });
      if (check?.supported) {
        return { webCodec: codec, muxerCodec: 'avc', label: 'H.264' };
      }
    } catch {
      continue;
    }
  }

  // Fallback for open-source Linux Chromium builds without proprietary H.264
  try {
    const vp9Check = await VE.isConfigSupported({
      codec: 'vp09.00.10.08',
      width,
      height,
      bitrate,
      framerate: fps,
    });
    if (vp9Check?.supported) {
      return { webCodec: 'vp09.00.10.08', muxerCodec: 'vp9', label: 'VP9' };
    }
  } catch {
    // Ignore
  }

  return null;
}

async function getSupportedAudioCandidates(): Promise<SelectedAudioCodec[]> {
  const AE = (window as any).AudioEncoder;
  if (!AE || typeof AE.isConfigSupported !== 'function') return [];

  const candidates: SelectedAudioCodec[] = [
    {
      webCodec: 'mp4a.40.2',
      muxerCodec: 'aac',
      sampleRate: 48000,
      bitrate: 96_000,
      label: 'AAC',
    },
    {
      webCodec: 'mp4a.40.2',
      muxerCodec: 'aac',
      sampleRate: 44100,
      bitrate: 96_000,
      label: 'AAC',
    },
    {
      webCodec: 'opus',
      muxerCodec: 'opus',
      sampleRate: 48000,
      bitrate: 96_000,
      label: 'Opus',
    },
  ];

  const supported: SelectedAudioCodec[] = [];
  for (const c of candidates) {
    try {
      const check = await AE.isConfigSupported({
        codec: c.webCodec,
        sampleRate: c.sampleRate,
        numberOfChannels: 1,
        bitrate: c.bitrate,
      });
      if (check?.supported) supported.push(c);
    } catch {
      continue;
    }
  }
  return supported;
}

async function encodeAudioTrackSafely(params: {
  project: CompiledFilmProject;
  audioCandidates: SelectedAudioCodec[];
  voiceCuesByRate: Map<number, VoiceCue[]>;
  signal?: AbortSignal;
}): Promise<{
  codec: SelectedAudioCodec;
  chunks: Array<{ chunk: any; meta: any }>;
} | null> {
  const { project, audioCandidates, voiceCuesByRate, signal } = params;
  const AE = (window as any).AudioEncoder;
  const AD = (window as any).AudioData;
  if (!AE || !AD) return null;

  for (const candidate of audioCandidates) {
    const collected: Array<{ chunk: any; meta: any }> = [];
    let failed = false;

    const audioEncoder = new AE({
      output: (chunk: any, meta: any) => {
        // Clone chunk bytes into a compact Uint8Array in case browser recycles internal buffer
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        const clonedChunk = new (window as any).EncodedAudioChunk({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration ?? undefined,
          data: buf,
        });
        collected.push({ chunk: clonedChunk, meta });
      },
      error: () => {
        failed = true;
      },
    });

    try {
      audioEncoder.configure({
        codec: candidate.webCodec,
        sampleRate: candidate.sampleRate,
        numberOfChannels: 1,
        bitrate: candidate.bitrate,
      });

      let voiceCues = voiceCuesByRate.get(candidate.sampleRate);
      if (!voiceCues) {
        voiceCues = project.includeVoiceover
          ? await prepareOptionalVoiceoverCues(project, candidate.sampleRate)
          : [];
        voiceCuesByRate.set(candidate.sampleRate, voiceCues);
      }

      const totalAudioSamples = Math.ceil(
        project.totalSeconds * candidate.sampleRate
      );
      const chunkSize = candidate.sampleRate; // 1 second per chunk (<200KB RAM!)

      for (
        let startSample = 0;
        startSample < totalAudioSamples && !failed;
        startSample += chunkSize
      ) {
        if (signal?.aborted) {
          audioEncoder.close();
          throw new Error('Render cancelled.');
        }

        const len = Math.min(chunkSize, totalAudioSamples - startSample);
        const pcm = renderCinemaAudioChunk(
          project,
          startSample,
          len,
          candidate.sampleRate,
          voiceCues
        );

        const audioData = new AD({
          format: 'f32',
          sampleRate: candidate.sampleRate,
          numberOfFrames: len,
          numberOfChannels: 1,
          timestamp: Math.round((startSample * 1_000_000) / candidate.sampleRate),
          data: pcm,
        });
        audioEncoder.encode(audioData);
        audioData.close();

        while (audioEncoder.encodeQueueSize > 8 && !failed) {
          await sleepMs(6);
        }
      }

      if (!failed) {
        await audioEncoder.flush();
      }
      audioEncoder.close();

      if (!failed && collected.length > 0) {
        return { codec: candidate, chunks: collected };
      }
    } catch (err) {
      try {
        audioEncoder.close();
      } catch {
        // Ignore
      }
      if (err instanceof Error && err.message === 'Render cancelled.') {
        throw err;
      }
    }
  }

  return null;
}

/**
 * Renders the entire CompiledFilmProject directly into a downloadable H.264 (+ AAC/Opus) .mp4 file
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

  const selectedVideo = await pickSupportedVideoCodec(W, H, fps, videoBitrate);

  // Path A: Fast Hardware WebCodecs + mp4-muxer Streaming Pipeline
  if (selectedVideo && typeof (window as any).VideoFrame !== 'undefined') {
    const wantAudio = project.includeScore || project.includeVoiceover;
    const audioCandidates = wantAudio ? await getSupportedAudioCandidates() : [];
    const voiceCuesByRate = new Map<number, VoiceCue[]>();

    if (wantAudio && audioCandidates.length > 0) {
      onProgress?.({
        pct: 2,
        currentFrame: 0,
        totalFrames,
        statusText: project.includeVoiceover
          ? 'Synthesizing narration & cinema score...'
          : 'Synthesizing procedural cinema score & SFX...',
        etaSec: Math.ceil(totalFrames / 60),
      });
    }

    const encodedAudio =
      audioCandidates.length > 0
        ? await encodeAudioTrackSafely({
            project,
            audioCandidates,
            voiceCuesByRate,
            signal,
          })
        : null;

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: selectedVideo.muxerCodec,
        width: W,
        height: H,
        frameRate: fps,
      },
      ...(encodedAudio
        ? {
            audio: {
              codec: encodedAudio.codec.muxerCodec,
              sampleRate: encodedAudio.codec.sampleRate,
              numberOfChannels: 1,
            },
          }
        : {}),
      fastStart: 'in-memory',
    });

    if (encodedAudio) {
      for (const item of encodedAudio.chunks) {
        muxer.addAudioChunk(item.chunk, item.meta);
      }
      encodedAudio.chunks.length = 0; // Release audio chunk references immediately
    }

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
      codec: selectedVideo.webCodec,
      width: W,
      height: H,
      bitrate: videoBitrate,
      framerate: fps,
    });

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

      while (videoEncoder.encodeQueueSize > 8) {
        await sleepMs(8);
      }

      if (i % 6 === 0 || i === totalFrames - 1) {
        const elapsedSec = (performance.now() - tStart) / 1000;
        const fpsRate = Math.max(1, (i + 1) / Math.max(0.05, elapsedSec));
        const etaSec = Math.max(0, Math.ceil((totalFrames - 1 - i) / fpsRate));
        const pct = Math.min(98, Math.round(((i + 1) / totalFrames) * 93) + 5);

        onProgress?.({
          pct,
          currentFrame: i + 1,
          totalFrames,
          statusText: `Encoding ${selectedVideo.label} Cel Frame ${i + 1} / ${totalFrames} (${Math.round(
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
    if (encoderErr) throw encoderErr;

    muxer.finalize();

    const mp4Buffer = target.buffer;
    const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      mimeType: 'video/mp4',
      sizeBytes: blob.size,
      engineLabel: encodedAudio
        ? `Hardware ${selectedVideo.label} + ${encodedAudio.codec.label} MP4 (${W}×${H} · 24fps)`
        : `Hardware ${selectedVideo.label} MP4 (${W}×${H} · 24fps)`,
    };
  }

  // Path B: Universal MediaRecorder Fallback (with WebAudio Soundtrack + Drift-Free Clock)
  const combinedStream = canvas.captureStream(fps);
  let fallbackAudioCtx: AudioContext | null = null;

  if (project.includeScore || project.includeVoiceover) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      try {
        fallbackAudioCtx = new AudioCtx();
        const sr = 22050;
        const voiceCues = project.includeVoiceover
          ? await prepareOptionalVoiceoverCues(project, sr)
          : [];
        const totalSamples = Math.max(1, Math.ceil(project.totalSeconds * sr));
        // Cap single buffer in fallback mode to 180s max
        const cappedSamples = Math.min(totalSamples, sr * 180);
        const pcm = renderCinemaAudioChunk(project, 0, cappedSamples, sr, voiceCues);
        const buf = fallbackAudioCtx.createBuffer(1, cappedSamples, sr);
        buf.getChannelData(0).set(pcm);
        const dest = fallbackAudioCtx.createMediaStreamDestination();
        const src = fallbackAudioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(0);
        for (const track of dest.stream.getAudioTracks()) {
          combinedStream.addTrack(track);
        }
      } catch {
        // Ignore fallback audio errors
      }
    }
  }

  const mimeCandidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const chosenMime =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || '';

  const recorder = chosenMime
    ? new MediaRecorder(combinedStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: videoBitrate,
      })
    : new MediaRecorder(combinedStream);

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
  const startWall = performance.now();

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        recorder.stop();
        throw new Error('Render cancelled.');
      }
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
      const targetTime = startWall + (i + 1) * frameIntervalMs;
      const wait = Math.max(0, targetTime - performance.now());
      if (wait > 1) {
        await sleepMs(wait);
      }
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
  } finally {
    if (fallbackAudioCtx) {
      await fallbackAudioCtx.close().catch(() => {});
    }
  }
}
