import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { sceneImageUrl } from "../../data/paths";
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
      <div
        data-scene-bg
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${sceneImageUrl(imagePath)})` }}
      />
      <div ref={effectsRef} className="pointer-events-none absolute inset-0" data-effects-layer />
      {children}
    </div>
  );
}
