export type SceneMeta = {
  title: string;
  desp: string;
  engTitle: string;
  engDesp: string;
  imagePath: string;
};

export type LineTrackConfig = {
  kind: "line";
  name: string;
  volume: number;
};

export type PointTrackConfig = {
  kind: "point";
  variants: string[];
  frequency: number;
  durationMs: number;
  windowMs: number;
  volume: number;
};

export type TrackConfig = LineTrackConfig | PointTrackConfig;

export type IconConfig = {
  title: string;
  engTitle: string;
  colors: [string, string];
  icon: string;
  volume: number;
  audioName: string;
};
