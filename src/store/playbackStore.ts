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
  "resume" | "play" | "pause" | "stop" | "loadScene" | "status"
>;

export type PlaybackControllerOptions = {
  loadTracks?: (title: string) => Promise<TrackConfig[]>;
  initialState?: Partial<PlaybackState>;
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
  const store = new Store<PlaybackState>({
    ...initialPlaybackState,
    ...options.initialState,
  });

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
      store.setState((s) => ({ ...s, status: "paused" }));
    },

    stop() {
      engine.stop();
      store.setState((s) => ({
        ...s,
        status: "stopped",
        timerEndsAt: null,
      }));
    },

    setTimer(minutes: 0 | 15 | 30 | 60) {
      store.setState((s) => ({
        ...s,
        timerMinutes: minutes,
        timerEndsAt: minutes === 0 ? null : Date.now() + minutes * 60_000,
      }));
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
