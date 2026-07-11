import type { IconConfig, SceneMeta, TrackConfig } from "./types";
import { assetUrl, sceneTracksUrl } from "./paths";

function stripArgb(hex: string): string {
  const h = hex.trim();
  if (/^#FF[0-9A-Fa-f]{6}$/i.test(h)) return `#${h.slice(3)}`;
  if (/^#ff[0-9A-Fa-f]{6}$/i.test(h)) return `#${h.slice(3)}`;
  return h.startsWith("#") ? h : `#${h}`;
}

export function parseColorParam(colorParam: string): [string, string] {
  const [a, b] = colorParam.split(";");
  return [stripArgb(a), stripArgb(b ?? a)];
}

type RawSceneTrack = {
  audioName?: string;
  isLineAudio?: boolean;
  isPointAudio?: boolean;
  names?: string[];
  frequency?: number;
  duration?: number;
  totalEndTime?: number;
  volume?: number;
};

export function parseSceneTracks(raw: RawSceneTrack[]): TrackConfig[] {
  return raw.map((t) => {
    if (t.isPointAudio) {
      return {
        kind: "point" as const,
        variants: t.names ?? [],
        frequency: t.frequency ?? 0,
        durationMs: t.duration ?? 0,
        windowMs: t.totalEndTime || 120_000,
        volume: t.volume ?? 1,
      };
    }
    return {
      kind: "line" as const,
      name: t.audioName ?? "",
      volume: t.volume ?? 1,
    };
  });
}

export async function loadSceneList(): Promise<SceneMeta[]> {
  const res = await fetch(assetUrl("assets/prebuilt_scene_config.json"));
  if (!res.ok) throw new Error("scene config missing");
  return res.json();
}

export async function loadSceneTracks(title: string): Promise<TrackConfig[]> {
  const res = await fetch(sceneTracksUrl(encodeURIComponent(title)));
  if (!res.ok) throw new Error(`scene tracks missing: ${title}`);
  const raw = await res.json();
  return parseSceneTracks(raw);
}

export async function loadIconConfigs(): Promise<IconConfig[]> {
  const res = await fetch(assetUrl("assets/prebuilt_icon_config.json"));
  if (!res.ok) throw new Error("icon config missing");
  const raw = await res.json();
  return raw.map(
    (item: {
      title: string;
      engTitle: string;
      colorParam: string;
      icon: string;
      volume: string | number;
      audioUrls: { url: string }[];
    }) => ({
      title: item.title,
      engTitle: item.engTitle,
      colors: parseColorParam(item.colorParam),
      icon: item.icon,
      volume: Number(item.volume),
      audioName: item.audioUrls[0]?.url ?? item.title,
    }),
  );
}
