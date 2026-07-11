import { describe, expect, it, vi } from "vite-plus/test";
import { PointScheduler } from "./pointScheduler";

describe("PointScheduler", () => {
  it("schedules roughly frequency one-shots in a window", () => {
    const play = vi.fn();
    const timers: { t: number; fn: () => void }[] = [];
    const sched = new PointScheduler({
      frequency: 5,
      windowMs: 1000,
      variants: ["a", "b"],
      playOneShot: play,
      random: () => 0.5,
      schedule: (fn, ms) => {
        timers.push({ t: ms, fn });
        return timers.length;
      },
      clear: () => {},
    });
    sched.start();
    expect(timers.length).toBe(5);
    timers.forEach((x) => x.fn());
    expect(play).toHaveBeenCalledTimes(5);
  });

  it("stop clears pending", () => {
    const clear = vi.fn();
    const sched = new PointScheduler({
      frequency: 3,
      windowMs: 1000,
      variants: ["a"],
      playOneShot: () => {},
      random: () => 0.1,
      schedule: (fn) => {
        fn();
        return 1;
      },
      clear,
    });
    sched.start();
    sched.stop();
    expect(clear).toHaveBeenCalled();
  });
});
