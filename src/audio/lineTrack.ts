export class LineTrack {
  private source: AudioBufferSourceNode | null = null;
  private readonly gain: GainNode;
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;

  constructor(ctx: AudioContext, buffer: AudioBuffer, volume: number) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.gain = ctx.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(ctx.destination);
  }

  start(when = 0) {
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain);
    src.start(when);
    this.source = src;
  }

  setVolume(v: number) {
    this.gain.gain.value = v;
  }

  stop() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.source.disconnect();
    } catch {
      /* mock without disconnect */
    }
    this.source = null;
  }
}
