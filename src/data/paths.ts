function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalized = path.replace(/^\//, "");
  return `${base}${normalized}`;
}

export function audioUrl(name: string): string {
  return withBase(`assets/audio/${name}.mp3`);
}

export function sceneImageUrl(imagePath: string): string {
  return withBase(`assets/scene/${imagePath}`);
}

export function iconUrl(icon: string): string {
  return withBase(`assets/icons/${icon}`);
}

export function sceneTracksUrl(title: string): string {
  return withBase(`assets/scene/${title}.json`);
}

export function assetUrl(path: string): string {
  return withBase(path);
}
