export type TimerMinutes = 0 | 15 | 30 | 60;

const OPTIONS: { minutes: TimerMinutes; label: string }[] = [
  { minutes: 15, label: "15 分钟" },
  { minutes: 30, label: "30 分钟" },
  { minutes: 60, label: "60 分钟" },
  { minutes: 0, label: "关闭" },
];

type TimerSheetProps = {
  open: boolean;
  selected: TimerMinutes;
  onSelect: (minutes: TimerMinutes) => void;
  onClose: () => void;
};

export function TimerSheet({ open, selected, onSelect, onClose }: TimerSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="定时关闭"
        className="mb-0 w-full max-w-lg rounded-t-2xl bg-[#1a1a1a] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
        <p className="mb-2 px-2 text-center text-base font-medium text-white/90">定时关闭</p>
        <ul className="divide-y divide-white/10">
          {OPTIONS.map(({ minutes, label }) => {
            const isActive = selected === minutes;
            return (
              <li key={minutes}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-center py-3.5 text-[17px] transition-colors ${
                    isActive ? "text-white" : "text-white/75"
                  }`}
                  onClick={() => onSelect(minutes)}
                >
                  {label}
                  {isActive ? <span className="ml-2 text-sm text-white/50">✓</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
