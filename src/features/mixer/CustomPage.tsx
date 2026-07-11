import { useEffect, useState } from "react";
import { loadIconConfigs } from "../../data/loadConfig";
import type { IconConfig } from "../../data/types";
import { playbackActions } from "../../store/playbackStore";
import { usePlayback } from "../../store/usePlayback";
import { DockBar } from "./DockBar";
import { TrackGrid } from "./TrackGrid";

export function CustomPage() {
  const { customActive, status } = usePlayback();
  const [icons, setIcons] = useState<IconConfig[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadIconConfigs();
        if (!cancelled) setIcons(list);
      } catch {
        // leave empty grid on fetch failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTitles = icons
    .filter((icon) => icon.audioName in customActive)
    .map((icon) => icon.title);

  function handleToggle(icon: IconConfig) {
    void playbackActions.toggleCustom(icon.audioName, icon.volume);
  }

  function handlePlayPause() {
    if (status === "playing") {
      playbackActions.pause();
    } else {
      void playbackActions.play();
    }
  }

  return (
    <div className="relative h-full min-h-dvh overflow-hidden bg-[#121212] text-white">
      <div className="h-full overflow-y-auto">
        <TrackGrid icons={icons} active={customActive} onToggle={handleToggle} />
      </div>
      <DockBar titles={activeTitles} status={status} onPlayPause={handlePlayPause} />
    </div>
  );
}
