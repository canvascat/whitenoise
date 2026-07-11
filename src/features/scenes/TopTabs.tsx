type TopTabsProps = {
  tab: "recommend" | "custom";
  onTabChange: (tab: "recommend" | "custom") => void;
};

export function TopTabs({ tab, onTabChange }: TopTabsProps) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
      <nav className="pointer-events-auto flex items-center gap-10">
        <button
          type="button"
          onClick={() => onTabChange("recommend")}
          className={`text-[17px] tracking-wide transition-opacity ${
            tab === "recommend" ? "font-semibold text-white" : "font-normal text-white/45"
          }`}
        >
          推荐
        </button>
        <button
          type="button"
          onClick={() => onTabChange("custom")}
          className={`text-[17px] tracking-wide transition-opacity ${
            tab === "custom" ? "font-semibold text-white" : "font-normal text-white/45"
          }`}
        >
          自选
        </button>
      </nav>
      <button
        type="button"
        aria-label="菜单"
        className="pointer-events-auto absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-2xl leading-none text-white"
      >
        ⋮
      </button>
    </header>
  );
}
