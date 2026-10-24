import { CompiledFilmProject } from '../types/film';
import { renderCinemaAudioChunk } from './audioScoreEngine';

export class LiveStageAudioPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private isPlaying = false;

  public start(project: CompiledFilmProject, fromSecond: number): void {
    this.stop();
    if (!project.includeScore) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const sr = 22050; // Lightweight real-time preview sample rate
      const remainSec = Math.max(0.2, project.totalSeconds - fromSecond);
      // Cap live preview buffer chunk to 90s at a time so RAM stays tiny (<7MB)
      const genSec = Math.min(90, remainSec);
      const numSamples = Math.max(1, Math.floor(genSec * sr));
      const startSample = Math.max(0, Math.floor(fromSecond * sr));

      const pcm = renderCinemaAudioChunk(project, startSample, numSamples, sr, null);
      const audioBuffer = ctx.createBuffer(1, numSamples, sr);
      audioBuffer.getChannelData(0).set(pcm);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      src.start(0);
      this.source = src;
      this.isPlaying = true;
    } catch {
      this.stop();
    }
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch {
        // Ignore
      }
      this.source = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  public get playing(): boolean {
    return this.isPlaying;
  }
}
