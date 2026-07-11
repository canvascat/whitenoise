import { describe, expect, it, vi } from "vite-plus/test";
import { LineTrack } from "./lineTrack";

function mockCtx() {
  const gain = {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const source = {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  return {
    currentTime: 0,
    destination: {},
    createGain: () => gain,
    createBufferSource: () => source,
    _gain: gain,
    _source: source,
  } as unknown as AudioContext & {
    _gain: typeof gain;
    _source: typeof source;
  };
}

describe("LineTrack", () => {
  it("starts looping buffer at given volume", () => {
    const ctx = mockCtx();
    const buffer = { duration: 2 } as AudioBuffer;
    const track = new LineTrack(ctx, buffer, 0.5);
    track.start();
    expect(ctx._source.loop).toBe(true);
    expect(ctx._source.start).toHaveBeenCalled();
    expect(ctx._gain.gain.value).toBe(0.5);
  });

  it("stop is idempotent", () => {
    const ctx = mockCtx();
    const track = new LineTrack(ctx, { duration: 1 } as AudioBuffer, 1);
    track.start();
    track.stop();
    track.stop();
    expect(ctx._source.stop).toHaveBeenCalledTimes(1);
  });

  it("fadeTo schedules linear ramp from current volume", () => {
    const ctx = mockCtx();
    (ctx as { currentTime: number }).currentTime = 1.5;
    const track = new LineTrack(ctx, { duration: 1 } as AudioBuffer, 0.8);
    track.fadeTo(0, 0.5);
    expect(ctx._gain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 1.5);
    expect(ctx._gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2);
  });
});
