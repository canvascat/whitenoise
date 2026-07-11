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
    state: "running" as AudioContextState,
    destination: {},
    createGain: () => gain,
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
  };
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
  it("loadScene then play starts line loop", async () => {
    const ctx = mockCtx();
    const fetchBuffer = vi.fn(async () => new ArrayBuffer(8));
    const engine = new AudioEngine({
      createContext: () => ctx,
      fetchBuffer,
    });

    await engine.loadScene(lineAndPoint);
    expect(engine.status).not.toBe("loading");
    expect(fetchBuffer).toHaveBeenCalled();

    engine.play();
    expect(engine.status).toBe("playing");
    const looping = ctx._sources.filter((s) => s.loop);
    expect(looping.length).toBeGreaterThanOrEqual(1);
    expect(looping[0].start).toHaveBeenCalled();
  });

  it("loadScene skips failing track and still resolves", async () => {
    const ctx = mockCtx();
    const fetchBuffer = vi.fn(async (url: string) => {
      if (url.includes("坏轨")) throw new Error("fetch failed");
      return new ArrayBuffer(8);
    });
    const engine = new AudioEngine({
      createContext: () => ctx,
      fetchBuffer,
    });

    await expect(
      engine.loadScene([
        { kind: "line", name: "坏轨", volume: 1 },
        { kind: "line", name: "好轨", volume: 0.5 },
      ]),
    ).resolves.toBeUndefined();
    expect(engine.status).not.toBe("loading");

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
    const engine = new AudioEngine({
      createContext: () => ctx,
      fetchBuffer,
    });

    const first = engine.loadScene([{ kind: "line", name: "慢轨", volume: 1 }]);
    const second = engine.loadScene([{ kind: "line", name: "快轨", volume: 0.8 }]);
    resolveFirst();
    await Promise.all([first, second]);

    engine.play();
    expect(engine.status).toBe("playing");
    // Only the second scene's line should be playable by name
    expect(() => engine.setTrackVolume("快轨", 0.2)).not.toThrow();
  });

  it("fadeOutAndStop ends in stopped", async () => {
    const ctx = mockCtx();
    const engine = new AudioEngine({
      createContext: () => ctx,
      fetchBuffer: async () => new ArrayBuffer(8),
    });
    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    engine.play();
    await engine.fadeOutAndStop(10);
    expect(ctx._gain.gain.setValueAtTime).toHaveBeenCalled();
    expect(ctx._gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.01);
    expect(engine.status).toBe("stopped");
  });

  it("setTrackVolume does not throw for known line after load+play", async () => {
    const ctx = mockCtx();
    const engine = new AudioEngine({
      createContext: () => ctx,
      fetchBuffer: async () => new ArrayBuffer(8),
    });
    await engine.loadScene([{ kind: "line", name: "河流", volume: 0.5 }]);
    engine.play();
    expect(() => engine.setTrackVolume("河流", 0.2)).not.toThrow();
    expect(ctx._gain.gain.value).toBe(0.2);
  });
});
