import { describe, expect, it, vi } from "vite-plus/test";
import { AudioEngine } from "./engine";
import type { TrackConfig } from "../data/types";

function mockCtx() {
  const gain = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const makeSource = () => ({
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  });
  const sources: ReturnType<typeof makeSource>[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: "running" as AudioContextState,
    destination: {},
    createGain: () => gain,
    createBuffer: vi.fn(() => ({ duration: 0 }) as AudioBuffer),
    createBufferSource: () => {
      const s = makeSource();
      sources.push(s);
      return s;
    },
    decodeAudioData: vi.fn(async () => ({ duration: 1 }) as AudioBuffer),
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    _gain: gain,
    _sources: sources,
  };
  return ctx as unknown as AudioContext & {
    _gain: typeof gain;
    _sources: ReturnType<typeof makeSource>[];
    decodeAudioData: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    createBuffer: ReturnType<typeof vi.fn>;
  };
}

function makeEngine(
  ctx: ReturnType<typeof mockCtx>,
  extra: Partial<ConstructorParameters<typeof AudioEngine>[0]> = {},
) {
  return new AudioEngine({
    createContext: () => ctx,
    createDecodeContext: () => mockCtx(),
    fetchBuffer: async () => new ArrayBuffer(8),
    ...extra,
  });
}

const lineAndPoint: TrackConfig[] = [
  { kind: "line", name: "河流", volume: 0.5 },
  {
    kind: "point",
    variants: ["鸟叫1", "鸟叫2"],
    frequency: 2,
    durationMs: 1000,
    windowMs: 5000,
    volume: 0.3,
  },
];

describe("AudioEngine", () => {
  it("loadScene decodes without creating playback AudioContext", async () => {
    const ctx = mockCtx();
    const createContext = vi.fn(() => ctx);
    const decodeCtx = mockCtx();
    const engine = new AudioEngine({
      createContext,
      createDecodeContext: () => decodeCtx,
      fetchBuffer: async () => new ArrayBuffer(8),
    });

    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    expect(createContext).not.toHaveBeenCalled();
    expect(decodeCtx.decodeAudioData).toHaveBeenCalled();
  });

  it("resume creates playback context, resumes, and plays unlock buffer", async () => {
    const ctx = mockCtx();
    (ctx as { state: AudioContextState }).state = "suspended";
    const createContext = vi.fn(() => ctx);
    const setAudioSessionType = vi.fn();
    const engine = new AudioEngine({
      createContext,
      createDecodeContext: () => mockCtx(),
      fetchBuffer: async () => new ArrayBuffer(8),
      setAudioSessionType,
    });

    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    await engine.resume();

    expect(createContext).toHaveBeenCalledTimes(1);
    expect(setAudioSessionType).toHaveBeenCalledWith("playback");
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalled();
    const unlockSources = ctx._sources.filter((s) => !s.loop);
    expect(unlockSources.length).toBeGreaterThanOrEqual(1);
    expect(unlockSources[0].start).toHaveBeenCalled();
  });

  it("loadScene then play starts line loop", async () => {
    const ctx = mockCtx();
    const fetchBuffer = vi.fn(async () => new ArrayBuffer(8));
    const engine = makeEngine(ctx, { fetchBuffer });

    await engine.loadScene(lineAndPoint);
    expect(engine.status).not.toBe("loading");
    expect(fetchBuffer).toHaveBeenCalled();

    await engine.resume();
    engine.play();
    expect(engine.status).toBe("playing");
    const looping = ctx._sources.filter((s) => s.loop);
    expect(looping.length).toBeGreaterThanOrEqual(1);
    expect(looping[0].start).toHaveBeenCalled();
  });

  it("loadScene skips failing track and still resolves", async () => {
    const ctx = mockCtx();
    const fetchBuffer = vi.fn(async (url: string) => {
      if (url.includes(encodeURIComponent("坏轨"))) throw new Error("fetch failed");
      return new ArrayBuffer(8);
    });
    const engine = makeEngine(ctx, { fetchBuffer });

    await expect(
      engine.loadScene([
        { kind: "line", name: "坏轨", volume: 1 },
        { kind: "line", name: "好轨", volume: 0.5 },
      ]),
    ).resolves.toBeUndefined();
    expect(engine.status).not.toBe("loading");

    await engine.resume();
    engine.play();
    expect(engine.status).toBe("playing");
    expect(ctx._sources.some((s) => s.loop)).toBe(true);
  });

  it("second loadScene invalidates first (generation)", async () => {
    const ctx = mockCtx();
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      resolveFirst = r;
    });
    let call = 0;
    const fetchBuffer = vi.fn(async () => {
      call += 1;
      if (call === 1) await firstGate;
      return new ArrayBuffer(8);
    });
    const engine = makeEngine(ctx, { fetchBuffer });

    const first = engine.loadScene([{ kind: "line", name: "慢轨", volume: 1 }]);
    const second = engine.loadScene([{ kind: "line", name: "快轨", volume: 0.8 }]);
    resolveFirst();
    await Promise.all([first, second]);

    await engine.resume();
    engine.play();
    expect(engine.status).toBe("playing");
    expect(() => engine.setTrackVolume("快轨", 0.2)).not.toThrow();
  });

  it("fadeOutAndStop ends in stopped", async () => {
    const ctx = mockCtx();
    const engine = makeEngine(ctx);
    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    await engine.resume();
    engine.play();
    await engine.fadeOutAndStop(10);
    expect(ctx._gain.gain.setValueAtTime).toHaveBeenCalled();
    expect(ctx._gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.01);
    expect(engine.status).toBe("stopped");
  });

  it("setTrackVolume does not throw for known line after load+play", async () => {
    const ctx = mockCtx();
    const engine = makeEngine(ctx);
    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    await engine.resume();
    engine.play();
    expect(() => engine.setTrackVolume("河流", 0.2)).not.toThrow();
    expect(ctx._gain.gain.value).toBe(0.2);
  });
});
