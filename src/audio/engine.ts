import type { TrackConfig, LineTrackConfig, PointTrackConfig } from "../data/types";
import { fetchAndDecode } from "./decode";
import { LineTrack } from "./lineTrack";
import { PointScheduler } from "./pointScheduler";

export type EngineDeps = {
  createContext: () => AudioContext;
  /** Decode-only context so playback AudioContext can be created inside a user gesture (iOS). */
  createDecodeContext?: () => BaseAudioContext;
  fetchBuffer?: (url: string) => Promise<ArrayBuffer>;
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear?: (id: ReturnType<typeof setTimeout>) => void;
  random?: () => number;
  /** iOS Safari: prefer playback session so the mute switch does not silence Web Audio. */
  setAudioSessionType?: (type: "playback" | "transient" | "ambient") => void;
};

export type Status = "idle" | "loading" | "playing" | "paused" | "stopped";

type PendingLine = {
  name: string;
  volume: number;
  buffer: AudioBuffer;
};

type PendingPoint = {
  config: PointTrackConfig;
};

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
  private readonly createDecodeContext?: () => BaseAudioContext;
  private readonly fetchBuffer?: (url: string) => Promise<ArrayBuffer>;
  private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clear: (id: ReturnType<typeof setTimeout>) => void;
  private readonly random: () => number;
  private readonly setAudioSessionType?: (type: "playback" | "transient" | "ambient") => void;

  private ctx: AudioContext | null = null;
  private decodeCtx: BaseAudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private pendingLines: PendingLine[] = [];
  private pendingPoints: PendingPoint[] = [];
  private lines: LoadedLine[] = [];
  private points: LoadedPoint[] = [];
  private oneShotSources: AudioBufferSourceNode[] = [];
  private generation = 0;
  private _status: Status = "idle";
  private unlocked = false;

  constructor(deps: EngineDeps) {
    this.createContext = deps.createContext;
    this.createDecodeContext = deps.createDecodeContext;
    this.fetchBuffer = deps.fetchBuffer;
    this.schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.clear = deps.clear ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.random = deps.random ?? Math.random;
    this.setAudioSessionType = deps.setAudioSessionType;
  }

  get status(): Status {
    return this._status;
  }

  private ensureDecodeContext(): BaseAudioContext {
    if (this.ctx) return this.ctx;
    if (!this.decodeCtx) {
      this.decodeCtx = this.createDecodeContext?.() ?? new OfflineAudioContext(2, 1, 48000);
    }
    return this.decodeCtx;
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
    const decodeCtx = this.ensureDecodeContext();

    const nextLines: PendingLine[] = [];
    const nextPoints: PendingPoint[] = [];

    for (const track of tracks) {
      if (gen !== this.generation) return;
      try {
        if (track.kind === "line") {
          const loaded = await this.loadLineBuffer(decodeCtx, track);
          if (gen !== this.generation) return;
          if (loaded) nextLines.push(loaded);
        } else {
          const loaded = await this.loadPointPending(decodeCtx, track);
          if (gen !== this.generation) return;
          if (loaded) nextPoints.push(loaded);
        }
      } catch {
        /* skip failed track */
      }
    }

    if (gen !== this.generation) return;

    this.teardownPlayback();
    this.pendingLines = nextLines;
    this.pendingPoints = nextPoints;
    this.lines = [];
    this.points = [];

    if (shouldResume) {
      this.play();
    } else {
      this._status = "stopped";
    }
  }

  private async loadLineBuffer(
    ctx: BaseAudioContext,
    track: LineTrackConfig,
  ): Promise<PendingLine | null> {
    try {
      const buffer = await fetchAndDecode(ctx, track.name, this.cache, this.fetchBuffer);
      return { name: track.name, volume: track.volume, buffer };
    } catch {
      return null;
    }
  }

  private async loadPointPending(
    ctx: BaseAudioContext,
    track: PointTrackConfig,
  ): Promise<PendingPoint | null> {
    try {
      for (const name of track.variants) {
        await fetchAndDecode(ctx, name, this.cache, this.fetchBuffer);
      }
      return { config: track };
    } catch {
      return null;
    }
  }

  private materialize(ctx: AudioContext): void {
    this.teardownPlayback();
    this.lines = this.pendingLines.map((line) => ({
      name: line.name,
      track: new LineTrack(ctx, line.buffer, line.volume),
    }));
    this.points = this.pendingPoints.map((point) => {
      const gain = ctx.createGain();
      gain.gain.value = point.config.volume;
      gain.connect(ctx.destination);
      return { config: point.config, scheduler: null, gain };
    });
  }

  async resume(): Promise<void> {
    // Must create/resume synchronously within the user-gesture call stack (iOS).
    const ctx = this.ensureContext();
    this.setAudioSessionType?.("playback");
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.unlock(ctx);
  }

  private unlock(ctx: AudioContext): void {
    if (this.unlocked) return;
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 48000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      this.unlocked = true;
    } catch {
      /* unlock best-effort */
    }
  }

  play(): void {
    const ctx = this.ensureContext();
    // Nodes live on the playback context; rebuild after load/stop or first play.
    if (this.lines.length === 0) {
      this.materialize(ctx);
    }

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
    this.lines = [];
    this.points = [];
    this._status = "stopped";
  }

  private teardownPlayback(): void {
    for (const line of this.lines) {
      line.track.stop();
    }
    for (const point of this.points) {
      point.scheduler?.stop();
      point.scheduler = null;
      try {
        point.gain.disconnect();
      } catch {
        /* mock */
      }
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
      line.track.fadeTo(0, ms / 1000);
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
