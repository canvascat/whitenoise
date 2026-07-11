import { useStore } from "@tanstack/react-store";
import { playbackActions, playbackStore, type PlaybackState } from "./playbackStore";

export function usePlayback(): PlaybackState & typeof playbackActions {
  const state = useStore(playbackStore);
  return { ...state, ...playbackActions };
}

export function usePlaybackSelector<T>(
  selector: (state: PlaybackState) => T,
  compare?: (a: T, b: T) => boolean,
): T {
  return useStore(playbackStore, selector, compare);
}
