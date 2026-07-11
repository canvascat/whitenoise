import type { IconConfig } from "../../data/types";
import { iconUrl } from "../../data/paths";

type TrackGridProps = {
  icons: IconConfig[];
  /** keys = audioName */
  active: Record<string, number>;
  onToggle: (icon: IconConfig) => void;
};

export function TrackGrid({ icons, active, onToggle }: TrackGridProps) {
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-7 px-6 pb-28 pt-20">
      {icons.map((icon) => {
        const isActive = icon.audioName in active;
        return (
          <button
            key={icon.audioName}
            type="button"
            className="flex flex-col items-center gap-2.5"
            onClick={() => onToggle(icon)}
          >
            <span
              className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full"
              style={
                isActive
                  ? {
                      background: `linear-gradient(145deg, ${icon.colors[0]}, ${icon.colors[1]})`,
                    }
                  : { background: "#2c2c2c" }
              }
            >
              <img
                src={iconUrl(icon.icon)}
                alt=""
                className="h-9 w-9 object-contain"
                draggable={false}
              />
            </span>
            <span className="text-[13px] leading-none text-white/90">{icon.title}</span>
          </button>
        );
      })}
    </div>
  );
}
