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
    // frequency shots + 1 window renewal
    expect(timers.length).toBe(6);
    expect(timers.filter((x) => x.t < 1000).length).toBe(5);
    expect(timers.some((x) => x.t === 1000)).toBe(true);
    timers.filter((x) => x.t < 1000).forEach((x) => x.fn());
    expect(play).toHaveBeenCalledTimes(5);
  });

  it("renews the window after windowMs", () => {
    const play = vi.fn();
    const timers: { t: number; fn: () => void }[] = [];
    const sched = new PointScheduler({
      frequency: 3,
      windowMs: 1000,
      variants: ["a"],
      playOneShot: play,
      random: () => 0.2,
      schedule: (fn, ms) => {
        timers.push({ t: ms, fn });
        return timers.length;
      },
      clear: () => {},
    });
    sched.start();
    expect(timers.length).toBe(4); // 3 shots + 1 renew

    const renew = timers.find((x) => x.t === 1000);
    expect(renew).toBeDefined();
    renew!.fn();

    // after renewal, schedule was called again (more than frequency times)
    expect(timers.length).toBeGreaterThan(3);
    expect(timers.length).toBe(8); // another 3 shots + 1 renew
  });

  it("stop clears pending and prevents renewal", () => {
    const clear = vi.fn();
    const timers: { fn: () => void }[] = [];
    const sched = new PointScheduler({
      frequency: 3,
      windowMs: 1000,
      variants: ["a"],
      playOneShot: () => {},
      random: () => 0.1,
      schedule: (fn) => {
        timers.push({ fn });
        return timers.length;
      },
      clear,
    });
    sched.start();
    sched.stop();
    expect(clear).toHaveBeenCalled();

    const before = timers.length;
    // firing renew after stop should not reschedule
    const renew = timers[timers.length - 1];
    renew.fn();
    expect(timers.length).toBe(before);
  });
});
