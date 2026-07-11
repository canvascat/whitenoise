import type { PointerEvent, ReactNode } from "react";
import { sceneImageUrl } from "../../data/paths";

type SceneStageProps = {
  imagePath: string;
  children?: ReactNode;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
};

export function SceneStage({ imagePath, children, onPointerDown, onPointerUp }: SceneStageProps) {
  return (
    <div
      className="absolute inset-0 touch-pan-y bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${sceneImageUrl(imagePath)})` }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Task 9: D3 / CSS effects mount point */}
      <div className="pointer-events-none absolute inset-0" data-effects-layer />
      {children}
    </div>
  );
}
