import { useEffect } from "react";
import { sceneLqipUrl } from "../data/paths";
import { CustomPage } from "../features/mixer/CustomPage";
import { RecommendPage } from "../features/scenes/RecommendPage";
import { TopTabs } from "../features/scenes/TopTabs";
import { applyChromeColor, resetChromeColor, sampleTopColorFromUrl } from "../lib/dominantColor";
import { updateMediaSession } from "../lib/mediaSession";
import { playbackActions } from "../store/playbackStore";
import { usePlayback } from "../store/usePlayback";

export function App() {
  const { tab, scenes, sceneIndex, status, error } = usePlayback();

  useEffect(() => {
    const scene = scenes[sceneIndex];
    updateMediaSession({
      title: scene?.title ?? "白噪声",
      playing: status === "playing",
      onPlay: () => {
        void playbackActions.play();
      },
      onPause: () => {
        playbackActions.pause();
      },
    });
  }, [scenes, sceneIndex, status]);

  useEffect(() => {
    if (error == null) return;
    const id = window.setTimeout(() => {
      playbackActions.clearError();
    }, 5000);
    return () => window.clearTimeout(id);
  }, [error]);

  // iOS may suspend AudioContext when backgrounded; resume on return if still playing.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (status !== "playing") return;
      void playbackActions.play();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status]);

  // Tint iOS status bar / overscroll to match the scene’s top colors.
  useEffect(() => {
    if (tab !== "recommend") {
      resetChromeColor();
      return;
    }
    const scene = scenes[sceneIndex];
    if (!scene) {
      resetChromeColor();
      return;
    }

    let cancelled = false;
    void sampleTopColorFromUrl(sceneLqipUrl(scene.imagePath))
      .then((hex) => {
        if (!cancelled) applyChromeColor(hex);
      })
      .catch(() => {
        if (!cancelled) resetChromeColor();
      });

    return () => {
      cancelled = true;
    };
  }, [tab, scenes, sceneIndex]);

  return (
    <div className="relative h-full min-h-dvh overflow-hidden bg-transparent text-white">
      {error != null ? (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-3 bg-red-900/90 px-4 pb-3 text-sm text-red-50 backdrop-blur-sm"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <p className="min-w-0 flex-1 break-words">{error}</p>
          <button
            type="button"
            className="shrink-0 rounded px-2 py-0.5 text-red-100/80 hover:bg-white/10 hover:text-white"
            onClick={() => playbackActions.clearError()}
            aria-label="关闭错误提示"
          >
            关闭
          </button>
        </div>
      ) : null}
      <TopTabs tab={tab} onTabChange={(next) => void playbackActions.setTab(next)} />
      {tab === "recommend" ? <RecommendPage /> : <CustomPage />}
    </div>
  );
}
