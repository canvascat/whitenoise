import { useEffect, useRef, useState, type PointerEvent } from "react";
import { loadSceneList } from "../../data/loadConfig";
import { sceneImageUrl, sceneLqipUrl } from "../../data/paths";
import { playbackActions } from "../../store/playbackStore";
import { usePlayback } from "../../store/usePlayback";
import { TimerSheet, type TimerMinutes } from "../timer/TimerSheet";
import { SceneStage } from "./SceneStage";

const SWIPE_THRESHOLD = 50;

export function RecommendPage() {
  const { scenes, sceneIndex, status, reducedMotion, timerMinutes } = usePlayback();
  const [timerOpen, setTimerOpen] = useState(false);
  const [hasResumed, setHasResumed] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const pointerStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setSystemReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  // Preload current + neighbors (hi-res + LQIP)
  useEffect(() => {
    if (scenes.length === 0) return;
    const n = scenes.length;
    const idxs = [sceneIndex, (sceneIndex + 1) % n, (sceneIndex - 1 + n) % n];
    for (const i of idxs) {
      const path = scenes[i]?.imagePath;
      if (!path) continue;
      const hi = new Image();
      hi.decoding = "async";
      hi.src = sceneImageUrl(path);
      const lo = new Image();
      lo.src = sceneLqipUrl(path);
    }
  }, [scenes, sceneIndex]);

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

  function handleTimerSelect(minutes: TimerMinutes) {
    playbackActions.setTimer(minutes);
    setTimerOpen(false);
  }

  return (
    <div className="relative h-full min-h-dvh overflow-hidden">
      {scene ? (
        <SceneStage
          title={scene.title}
          imagePath={scene.imagePath}
          playing={status === "playing"}
          reducedMotion={reducedMotion || systemReducedMotion}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between pt-24"
            style={{
              paddingBottom: "max(2.5rem, calc(1.25rem + var(--safe-bottom)))",
              paddingLeft: "max(1.5rem, var(--safe-left))",
              paddingRight: "max(1.5rem, var(--safe-right))",
            }}
          >
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

      <TimerSheet
        open={timerOpen}
        selected={timerMinutes}
        onSelect={handleTimerSelect}
        onClose={() => setTimerOpen(false)}
      />
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
