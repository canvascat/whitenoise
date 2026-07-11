export function updateMediaSession(opts: {
  title: string;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
}): void {
  if (!("mediaSession" in navigator) || !navigator.mediaSession) return;

  const { mediaSession } = navigator;

  mediaSession.metadata = new MediaMetadata({
    title: opts.title,
    artist: "白噪声",
  });

  mediaSession.setActionHandler("play", () => {
    opts.onPlay();
  });
  mediaSession.setActionHandler("pause", () => {
    opts.onPause();
  });

  if ("playbackState" in mediaSession) {
    mediaSession.playbackState = opts.playing ? "playing" : "paused";
  }
}
