type DockBarProps = {
  titles: string[];
  status: "idle" | "loading" | "playing" | "paused" | "stopped";
  onPlayPause: () => void;
};

export function DockBar({ titles, status, onPlayPause }: DockBarProps) {
  const label = titles.length > 0 ? titles.join("/") : "选择音效";
  const isPlaying = status === "playing";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className={`pointer-events-auto flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 py-3.5 shadow-lg ${
          isPlaying ? "dock-playing-pulse" : ""
        }`}
        style={{
          background: "linear-gradient(90deg, #5b8def 0%, #7b6cf0 55%, #9b6ae8 100%)",
        }}
      >
        <MusicNoteIcon />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{label}</span>
        <ChevronIcon />
      </div>

      <button
        type="button"
        aria-label={isPlaying ? "暂停" : "播放"}
        className={`pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg ${
          isPlaying ? "dock-playing-pulse" : ""
        }`}
        style={{
          background: "linear-gradient(145deg, #8b7cf5 0%, #6a8ef0 100%)",
        }}
        onClick={onPlayPause}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}

function MusicNoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M9 18V6.5l10-2V16"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="2.5" fill="white" />
      <circle cx="17" cy="16" r="2.5" fill="white" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 opacity-90"
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
