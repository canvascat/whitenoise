import type { TrackConfig, LineTrackConfig, PointTrackConfig } from "../data/types";
import { fetchAndDecode } from "./decode";
import { LineTrack } from "./lineTrack";
import { PointScheduler } from "./pointScheduler";

export type EngineDeps = {
  createContext: () => AudioContext;
  fetchBuffer?: (url: string) => Promise<ArrayBuffer>;
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear?: (id: ReturnType<typeof setTimeout>) => void;
  random?: () => number;
};

export type Status = "idle" | "loading" | "playing" | "paused" | "stopped";

type LoadedLine = {
  name: string;
  track: LineTrack;
};

type LoadedPoint = {
  config: PointTrackConfig;
  scheduler: PointScheduler | null;
  gain: GainNode;
};

export class AudioEngine {
  private readonly createContext: () => AudioContext;
  private readonly fetchBuffer?: (url: string) => Promise<ArrayBuffer>;
  private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clear: (id: ReturnType<typeof setTimeout>) => void;
  private readonly random: () => number;

  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private lines: LoadedLine[] = [];
  private points: LoadedPoint[] = [];
  private oneShotSources: AudioBufferSourceNode[] = [];
  private generation = 0;
  private _status: Status = "idle";

  constructor(deps: EngineDeps) {
    this.createContext = deps.createContext;
    this.fetchBuffer = deps.fetchBuffer;
    this.schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.clear = deps.clear ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.random = deps.random ?? Math.random;
  }

  get status(): Status {
    return this._status;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.createContext();
    }
    return this.ctx;
  }

  async loadScene(tracks: TrackConfig[]): Promise<void> {
    const shouldResume = this._status === "playing";
    const gen = ++this.generation;
    this._status = "loading";
    const ctx = this.ensureContext();

    const nextLines: LoadedLine[] = [];
    const nextPoints: LoadedPoint[] = [];

    for (const track of tracks) {
      if (gen !== this.generation) return;
      try {
        if (track.kind === "line") {
          const loaded = await this.loadLine(ctx, track);
          if (gen !== this.generation) return;
          if (loaded) nextLines.push(loaded);
        } else {
          const loaded = await this.loadPoint(ctx, track);
          if (gen !== this.generation) return;
          if (loaded) nextPoints.push(loaded);
        }
      } catch {
        /* skip failed track */
      }
    }

    if (gen !== this.generation) return;

    this.teardownPlayback();
    this.lines = nextLines;
    this.points = nextPoints;

    if (shouldResume) {
      this.play();
    } else {
      this._status = "stopped";
    }
  }

  private async loadLine(ctx: AudioContext, track: LineTrackConfig): Promise<LoadedLine | null> {
    try {
      const buffer = await fetchAndDecode(ctx, track.name, this.cache, this.fetchBuffer);
      return { name: track.name, track: new LineTrack(ctx, buffer, track.volume) };
    } catch {
      return null;
    }
  }

  private async loadPoint(ctx: AudioContext, track: PointTrackConfig): Promise<LoadedPoint | null> {
    try {
      for (const name of track.variants) {
        await fetchAndDecode(ctx, name, this.cache, this.fetchBuffer);
      }
      const gain = ctx.createGain();
      gain.gain.value = track.volume;
      gain.connect(ctx.destination);
      return { config: track, scheduler: null, gain };
    } catch {
      return null;
    }
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
  }

  play(): void {
    for (const line of this.lines) {
      line.track.start();
    }
    for (const point of this.points) {
      point.scheduler?.stop();
      point.scheduler = new PointScheduler({
        frequency: point.config.frequency,
        windowMs: point.config.windowMs,
        variants: point.config.variants,
        playOneShot: (name) => this.playOneShot(name, point.gain),
        random: this.random,
        schedule: (fn, ms) => this.schedule(fn, ms) as number,
        clear: (id) => this.clear(id),
      });
      point.scheduler.start();
    }
    this._status = "playing";
  }

  private playOneShot(name: string, gain: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = this.cache.get(name);
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    src.start();
    this.oneShotSources.push(src);
    src.onended = () => {
      this.oneShotSources = this.oneShotSources.filter((s) => s !== src);
      try {
        src.disconnect();
      } catch {
        /* mock */
      }
    };
  }

  pause(): void {
    for (const line of this.lines) {
      line.track.stop();
    }
    for (const point of this.points) {
      point.scheduler?.stop();
      point.scheduler = null;
    }
    this.stopOneShots();
    this._status = "paused";
  }

  stop(): void {
    this.teardownPlayback();
    this._status = "stopped";
  }

  private teardownPlayback(): void {
    for (const line of this.lines) {
      line.track.stop();
    }
    for (const point of this.points) {
      point.scheduler?.stop();
      point.scheduler = null;
    }
    this.stopOneShots();
  }

  private stopOneShots(): void {
    for (const src of this.oneShotSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* mock */
      }
    }
    this.oneShotSources = [];
  }

  setTrackVolume(name: string, volume: number): void {
    const line = this.lines.find((l) => l.name === name);
    if (!line) return;
    line.track.setVolume(volume);
  }

  async fadeOutAndStop(ms: number): Promise<void> {
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? 0;
    const end = now + ms / 1000;

    for (const line of this.lines) {
      line.track.setVolume(0);
    }
    for (const point of this.points) {
      try {
        point.gain.gain.setValueAtTime(point.gain.gain.value, now);
        point.gain.gain.linearRampToValueAtTime(0, end);
      } catch {
        point.gain.gain.value = 0;
      }
    }

    await new Promise<void>((resolve) => {
      this.schedule(() => resolve(), ms);
    });
    this.stop();
  }
}
