import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { sceneImageUrl, sceneLqipUrl } from "../../data/paths";
import { startBreath, type EffectHandle } from "./effects/breath";
import { startFireplace } from "./effects/fireplace";
import { startRain } from "./effects/rain";

type SceneStageProps = {
  title: string;
  imagePath: string;
  reducedMotion?: boolean;
  children?: ReactNode;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function startEffect(title: string, container: HTMLElement): EffectHandle {
  if (title === "夏雨") return startRain(container);
  if (title === "炉火") return startFireplace(container);
  return startBreath(container);
}

export function SceneStage({
  title,
  imagePath,
  reducedMotion = false,
  children,
  onPointerDown,
  onPointerUp,
}: SceneStageProps) {
  const effectsRef = useRef<HTMLDivElement>(null);
  const [hiResReady, setHiResReady] = useState(false);
  const src = sceneImageUrl(imagePath);
  const lqip = sceneLqipUrl(imagePath);

  useEffect(() => {
    setHiResReady(false);
  }, [src]);

  useEffect(() => {
    const layer = effectsRef.current;
    if (!layer) return;

    if (reducedMotion || prefersReducedMotion()) {
      layer.replaceChildren();
      return;
    }

    const handle = startEffect(title, layer);
    return () => {
      handle.stop();
      layer.replaceChildren();
    };
  }, [title, reducedMotion]);

  return (
    <div
      className="absolute inset-0 touch-pan-y overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* LQIP blur placeholder — tiny WebP, instant paint */}
      <div
        data-scene-lqip
        className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-xl"
        style={{ backgroundImage: `url(${lqip})` }}
        aria-hidden
      />
      <img
        data-scene-bg
        src={src}
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable={false}
        onLoad={() => setHiResReady(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          hiResReady ? "opacity-100" : "opacity-0"
        }`}
      />
      <div ref={effectsRef} className="pointer-events-none absolute inset-0" data-effects-layer />
      {children}
    </div>
  );
}
