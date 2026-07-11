import { Store } from "@tanstack/store";
import { AudioEngine } from "../audio/engine";
import { loadSceneTracks } from "../data/loadConfig";
import type { SceneMeta, TrackConfig } from "../data/types";

export type PlaybackState = {
  tab: "recommend" | "custom";
  scenes: SceneMeta[];
  sceneIndex: number;
  status: "idle" | "loading" | "playing" | "paused" | "stopped";
  /** 自选：title -> volume；缺省表示未选中 */
  customActive: Record<string, number>;
  timerMinutes: 0 | 15 | 30 | 60;
  timerEndsAt: number | null;
  error: string | null;
  reducedMotion: boolean;
};

export type PlaybackEngine = Pick<
  AudioEngine,
  "resume" | "play" | "pause" | "stop" | "loadScene" | "status" | "fadeOutAndStop"
>;

export type PlaybackControllerOptions = {
  loadTracks?: (title: string) => Promise<TrackConfig[]>;
  initialState?: Partial<PlaybackState>;
  /** 定时检查间隔（毫秒），默认 1000；测试可注入更短间隔 */
  timerIntervalMs?: number;
  /** 到时淡出时长（毫秒） */
  fadeOutMs?: number;
  /** 可注入 now，便于单测 */
  now?: () => number;
  /** 可注入调度器，便于 fake timers */
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

export const initialPlaybackState: PlaybackState = {
  tab: "recommend",
  scenes: [],
  sceneIndex: 0,
  status: "idle",
  customActive: {},
  timerMinutes: 0,
  timerEndsAt: null,
  error: null,
  reducedMotion: false,
};

const DEFAULT_FADE_OUT_MS = 1500;

/**
 * 纯检查：若 now >= timerEndsAt 则调用 fadeOutAndStop。
 * 返回是否已触发到时逻辑（调用方负责清 timer / 更新 status）。
 */
export async function checkTimer(
  now: number,
  timerEndsAt: number | null,
  engine: Pick<PlaybackEngine, "fadeOutAndStop">,
  fadeOutMs: number = DEFAULT_FADE_OUT_MS,
): Promise<boolean> {
  if (timerEndsAt == null || now < timerEndsAt) return false;
  await engine.fadeOutAndStop(fadeOutMs);
  return true;
}

function customActiveToLineTracks(customActive: Record<string, number>): TrackConfig[] {
  return Object.entries(customActive).map(([name, volume]) => ({
    kind: "line" as const,
    name,
    volume,
  }));
}

export function createPlaybackController(
  engine: PlaybackEngine,
  options: PlaybackControllerOptions = {},
) {
  const loadTracks = options.loadTracks ?? loadSceneTracks;
  const getNow = options.now ?? Date.now;
  const fadeOutMs = options.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
  const timerIntervalMs = options.timerIntervalMs ?? 1000;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;

  const store = new Store<PlaybackState>({
    ...initialPlaybackState,
    ...options.initialState,
  });

  let timerHandle: ReturnType<typeof setInterval> | null = null;
  let ticking = false;

  function clearTimerFields(extra: Partial<PlaybackState> = {}) {
    store.setState((s) => ({
      ...s,
      ...extra,
      timerMinutes: 0,
      timerEndsAt: null,
    }));
  }

  function stopTimerWatch() {
    if (timerHandle != null) {
      clearIntervalFn(timerHandle);
      timerHandle = null;
    }
  }

  async function onTimerTick() {
    if (ticking) return;
    const endsAt = store.state.timerEndsAt;
    if (endsAt == null) {
      stopTimerWatch();
      return;
    }

    ticking = true;
    try {
      const fired = await checkTimer(getNow(), endsAt, engine, fadeOutMs);
      if (fired) {
        stopTimerWatch();
        clearTimerFields({ status: "paused" });
      }
    } finally {
      ticking = false;
    }
  }

  function startTimerWatch() {
    if (timerHandle != null) return;
    timerHandle = setIntervalFn(() => {
      void onTimerTick();
    }, timerIntervalMs);
  }

  const actions = {
    setTab(tab: PlaybackState["tab"]) {
      store.setState((s) => ({ ...s, tab }));
    },

    setScenes(scenes: SceneMeta[]) {
      store.setState((s) => ({ ...s, scenes }));
    },

    async selectScene(index: number) {
      const scene = store.state.scenes[index];
      if (!scene) return;

      store.setState((s) => ({
        ...s,
        sceneIndex: index,
        status: "loading",
        error: null,
      }));

      try {
        const tracks = await loadTracks(scene.title);
        await engine.loadScene(tracks);
        store.setState((s) => ({ ...s, status: engine.status }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setState((s) => ({
          ...s,
          status: "stopped",
          error: message,
        }));
      }
    },

    async toggleCustom(title: string, defaultVolume: number) {
      const prev = store.state.customActive;
      const next = { ...prev };
      if (title in next) {
        delete next[title];
      } else {
        next[title] = defaultVolume;
      }

      // 先更新 UI 选中态；加载失败时保留选中并写入 error，不回滚 customActive
      store.setState((s) => ({ ...s, customActive: next, error: null }));

      try {
        // stub：用 customActive 键名作为线声轨名加载
        await engine.loadScene(customActiveToLineTracks(next));
        store.setState((s) => ({ ...s, status: engine.status }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setState((s) => ({
          ...s,
          error: message,
        }));
      }
    },

    async play() {
      await engine.resume();
      engine.play();
      store.setState((s) => ({ ...s, status: "playing" }));
    },

    pause() {
      engine.pause();
      stopTimerWatch();
      clearTimerFields({ status: "paused" });
    },

    stop() {
      engine.stop();
      stopTimerWatch();
      clearTimerFields({ status: "stopped" });
    },

    setTimer(minutes: 0 | 15 | 30 | 60) {
      if (minutes === 0) {
        stopTimerWatch();
        store.setState((s) => ({
          ...s,
          timerMinutes: 0,
          timerEndsAt: null,
        }));
        return;
      }

      store.setState((s) => ({
        ...s,
        timerMinutes: minutes,
        timerEndsAt: getNow() + minutes * 60_000,
      }));
      startTimerWatch();
    },

    /** 供测试：手动推进一次定时检查 */
    async tickTimer() {
      await onTimerTick();
    },

    dispose() {
      stopTimerWatch();
    },

    clearError() {
      store.setState((s) => ({ ...s, error: null }));
    },

    syncStatusFromEngine() {
      store.setState((s) => ({ ...s, status: engine.status }));
    },
  };

  return { store, actions };
}

export type PlaybackController = ReturnType<typeof createPlaybackController>;

const defaultEngine = new AudioEngine({
  createContext: () => new AudioContext(),
});

export const { store: playbackStore, actions: playbackActions } =
  createPlaybackController(defaultEngine);
