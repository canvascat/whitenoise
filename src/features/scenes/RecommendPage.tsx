import { useEffect, useRef, useState, type PointerEvent } from "react";
import { loadSceneList } from "../../data/loadConfig";
import { playbackActions } from "../../store/playbackStore";
import { usePlayback } from "../../store/usePlayback";
import { SceneStage } from "./SceneStage";

const SWIPE_THRESHOLD = 50;

export function RecommendPage() {
  const { scenes, sceneIndex, status } = usePlayback();
  const [timerOpen, setTimerOpen] = useState(false);
  const [hasResumed, setHasResumed] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadSceneList();
        if (cancelled) return;
        playbackActions.setScenes(list);
        if (!cancelled) await playbackActions.selectScene(0);
      } catch {
        // list fetch failure: leave empty stage
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scene = scenes[sceneIndex];
  const showPlayOverlay = !hasResumed && (status === "idle" || status === "stopped");

  function goScene(delta: number) {
    if (scenes.length === 0) return;
    const next = (sceneIndex + delta + scenes.length) % scenes.length;
    if (next === sceneIndex) return;
    void playbackActions.selectScene(next);
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = e.clientX;
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    const startX = pointerStartX.current;
    pointerStartX.current = null;
    if (startX == null) return;
    const dx = e.clientX - startX;
    if (dx < -SWIPE_THRESHOLD) goScene(1);
    else if (dx > SWIPE_THRESHOLD) goScene(-1);
  }

  async function handlePlay() {
    await playbackActions.play();
    setHasResumed(true);
  }

  return (
    <div className="relative h-full min-h-dvh overflow-hidden">
      {scene ? (
        <SceneStage
          imagePath={scene.imagePath}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-6 pb-14 pt-24">
            <div className="max-w-[70%]">
              <h1 className="text-[2rem] font-semibold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
                {scene.title}
              </h1>
              <p className="mt-1.5 text-[15px] leading-snug text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                {scene.desp}
              </p>
            </div>

            <button
              type="button"
              aria-label="定时"
              className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/90 text-white"
              onClick={() => setTimerOpen(true)}
            >
              <TimerIcon />
            </button>
          </div>
        </SceneStage>
      ) : (
        <div className="absolute inset-0 bg-[#121212]" />
      )}

      {showPlayOverlay && scene ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <button
            type="button"
            className="rounded-full px-8 py-3 text-xl font-medium tracking-wide text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]"
            onClick={() => void handlePlay()}
          >
            点击播放
          </button>
        </div>
      ) : null}

      {timerOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div className="mb-8 w-[min(100%,20rem)] rounded-2xl bg-[#1e1e1e] px-6 py-5 text-center text-white shadow-lg">
            <p className="text-lg">定时</p>
            <button
              type="button"
              className="mt-4 text-sm text-white/60"
              onClick={() => setTimerOpen(false)}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="15" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 15V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 15L18.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 4.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
