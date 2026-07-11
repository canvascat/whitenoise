import { describe, expect, it, vi } from "vite-plus/test";
import { createPlaybackController, type PlaybackEngine } from "./playbackStore";
import type { SceneMeta, TrackConfig } from "../data/types";

function mockEngine(overrides: Partial<PlaybackEngine> = {}): PlaybackEngine {
  return {
    status: "idle",
    resume: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    loadScene: vi.fn(async () => {}),
    ...overrides,
  };
}

const scenes: SceneMeta[] = [
  {
    title: "夏雨",
    desp: "雨声",
    engTitle: "Rain",
    engDesp: "rain",
    imagePath: "rain.jpg",
  },
  {
    title: "炉火",
    desp: "火声",
    engTitle: "Fire",
    engDesp: "fire",
    imagePath: "fire.jpg",
  },
];

describe("playbackStore", () => {
  it("setTab updates state", () => {
    const { store, actions } = createPlaybackController(mockEngine());
    actions.setTab("custom");
    expect(store.state.tab).toBe("custom");
  });

  it("play calls resume+play and sets playing", async () => {
    const engine = mockEngine();
    const { store, actions } = createPlaybackController(engine);

    await actions.play();

    expect(engine.resume).toHaveBeenCalled();
    expect(engine.play).toHaveBeenCalled();
    expect(store.state.status).toBe("playing");
  });

  it("pause after play calls engine.pause and sets paused", async () => {
    const engine = mockEngine();
    const { store, actions } = createPlaybackController(engine);

    await actions.play();
    actions.pause();

    expect(engine.pause).toHaveBeenCalled();
    expect(store.state.status).toBe("paused");
  });

  it("setTimer(15) sets timerEndsAt roughly now+15min; setTimer(0) clears", () => {
    const { store, actions } = createPlaybackController(mockEngine());
    const before = Date.now();

    actions.setTimer(15);
    expect(store.state.timerMinutes).toBe(15);
    expect(store.state.timerEndsAt).toBeGreaterThanOrEqual(before + 15 * 60_000);
    expect(store.state.timerEndsAt).toBeLessThanOrEqual(Date.now() + 15 * 60_000);

    actions.setTimer(0);
    expect(store.state.timerMinutes).toBe(0);
    expect(store.state.timerEndsAt).toBeNull();
  });

  it("toggleCustom adds then removes key", async () => {
    const engine = mockEngine({ status: "stopped" });
    const { store, actions } = createPlaybackController(engine);

    await actions.toggleCustom("河流", 0.6);
    expect(store.state.customActive).toEqual({ 河流: 0.6 });
    expect(engine.loadScene).toHaveBeenCalledWith([{ kind: "line", name: "河流", volume: 0.6 }]);

    await actions.toggleCustom("河流", 0.6);
    expect(store.state.customActive).toEqual({});
    expect(engine.loadScene).toHaveBeenLastCalledWith([]);
  });

  it("selectScene with injected loader calls engine.loadScene", async () => {
    const tracks: TrackConfig[] = [{ kind: "line", name: "雨", volume: 0.8 }];
    const loadTracks = vi.fn(async () => tracks);
    const engine = mockEngine({ status: "stopped" });
    const { store, actions } = createPlaybackController(engine, {
      loadTracks,
      initialState: { scenes },
    });

    await actions.selectScene(0);

    expect(store.state.sceneIndex).toBe(0);
    expect(loadTracks).toHaveBeenCalledWith("夏雨");
    expect(engine.loadScene).toHaveBeenCalledWith(tracks);
    expect(store.state.status).toBe("stopped");
    expect(store.state.error).toBeNull();
  });
});
