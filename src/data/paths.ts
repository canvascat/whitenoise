function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalized = path.replace(/^\//, "");
  return `${base}${normalized}`;
}

export function audioUrl(name: string): string {
  return withBase(`assets/audio/${name}.mp3`);
}

/** Prefer WebP scene art; accept legacy .jpg paths from config. */
export function sceneImageUrl(imagePath: string): string {
  const file = imagePath.replace(/\.jpe?g$/i, ".webp");
  return withBase(`assets/scene/${file}`);
}

/** Tiny blur placeholder for progressive scene paint. */
export function sceneLqipUrl(imagePath: string): string {
  const stem = imagePath.replace(/\.(jpe?g|webp)$/i, "");
  return withBase(`assets/scene/lqip/${stem}.webp`);
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
