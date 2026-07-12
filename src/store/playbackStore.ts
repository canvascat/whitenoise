import { Store } from "@tanstack/store";
import { AudioEngine } from "../audio/engine";
import { loadSceneTracks } from "../data/loadConfig";
import type { SceneMeta, TrackConfig } from "../data/types";
import { audioDebug } from "../lib/audioDebug";

export type PlaybackState = {
  tab: "recommend" | "custom";
  scenes: SceneMeta[];
  sceneIndex: number;
  status: "idle" | "loading" | "playing" | "paused" | "stopped";
  /** 自选：audioName（文件 stem）-> volume；缺省表示未选中 */
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
    async setTab(tab: PlaybackState["tab"]) {
      const prevTab = store.state.tab;
      store.setState((s) => ({ ...s, tab }));
      if (prevTab === tab) return;

      if (tab === "recommend") {
        if (store.state.scenes.length > 0) {
          await actions.selectScene(store.state.sceneIndex);
        }
        return;
      }

      const { customActive, status } = store.state;
      if (Object.keys(customActive).length === 0) return;

      const wasPlaying = status === "playing";
      try {
        await engine.loadScene(customActiveToLineTracks(customActive));
        if (wasPlaying) {
          await engine.resume();
          engine.play();
          store.setState((s) => ({ ...s, status: "playing", error: null }));
        } else {
          store.setState((s) => ({ ...s, status: engine.status, error: null }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setState((s) => ({ ...s, error: message }));
      }
    },

    setScenes(scenes: SceneMeta[]) {
      store.setState((s) => ({ ...s, scenes }));
    },

    async selectScene(index: number) {
      const scene = store.state.scenes[index];
      if (!scene) return;

      audioDebug.info("selectScene", { index, title: scene.title });
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
        audioDebug.error("selectScene failed", { title: scene.title, message });
        store.setState((s) => ({
          ...s,
          status: "stopped",
          error: message,
        }));
      }
    },

    async toggleCustom(audioName: string, defaultVolume: number) {
      const prev = store.state.customActive;
      const next = { ...prev };
      if (audioName in next) {
        delete next[audioName];
      } else {
        next[audioName] = defaultVolume;
      }

      audioDebug.info("toggleCustom", {
        audioName,
        on: audioName in next,
        count: Object.keys(next).length,
      });
      // 先更新 UI 选中态；加载失败时保留选中并写入 error，不回滚 customActive
      store.setState((s) => ({ ...s, customActive: next, error: null }));

      try {
        // 用 audioName（文件 stem）作为线声轨名加载
        await engine.loadScene(customActiveToLineTracks(next));
        store.setState((s) => ({ ...s, status: engine.status }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        audioDebug.error("toggleCustom load failed", { message });
        store.setState((s) => ({
          ...s,
          error: message,
        }));
      }
    },

    async play() {
      audioDebug.info("store.play");
      await engine.resume();
      engine.play();
      store.setState((s) => ({ ...s, status: "playing" }));
    },

    pause() {
      audioDebug.info("store.pause");
      engine.pause();
      stopTimerWatch();
      clearTimerFields({ status: "paused" });
    },

    stop() {
      audioDebug.info("store.stop");
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

function createPlaybackAudioContext(): AudioContext {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("Web Audio API not supported");
  return new AC();
}

function setAudioSessionType(type: "playback" | "transient" | "ambient"): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = type;
  } catch {
    /* Safari < 17.2 or unsupported */
  }
}

const defaultEngine = new AudioEngine({
  createContext: createPlaybackAudioContext,
  setAudioSessionType,
});

export const { store: playbackStore, actions: playbackActions } =
  createPlaybackController(defaultEngine);
