import { CompiledFilmProject } from '../types/film';
import { renderCinemaAudioChunk } from './audioScoreEngine';

export class LiveStageAudioPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private playToken = 0;

  public start(project: CompiledFilmProject, fromSecond: number): void {
    this.stop();
    if (!project.includeScore) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const token = ++this.playToken;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.scheduleNextChunk(ctx, project, fromSecond, token);
    } catch {
      this.stop();
    }
  }

  private scheduleNextChunk(
    ctx: AudioContext,
    project: CompiledFilmProject,
    cursorSec: number,
    token: number
  ): void {
    if (token !== this.playToken) return;
    const remainSec = project.totalSeconds - cursorSec;
    if (remainSec <= 0.05) return;

    const sr = 22050;
    const chunkSec = Math.min(45, remainSec);
    const numSamples = Math.max(1, Math.floor(chunkSec * sr));
    const startSample = Math.max(0, Math.floor(cursorSec * sr));

    const pcm = renderCinemaAudioChunk(project, startSample, numSamples, sr, []);
    const audioBuffer = ctx.createBuffer(1, numSamples, sr);
    audioBuffer.getChannelData(0).set(pcm);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (token === this.playToken && cursorSec + chunkSec < project.totalSeconds - 0.05) {
        this.scheduleNextChunk(ctx, project, cursorSec + chunkSec, token);
      }
    };
    src.start(0);
    this.source = src;
  }

  public stop(): void {
    this.playToken++;
    if (this.source) {
      try {
        this.source.onended = null;
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
}
