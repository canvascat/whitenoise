export function audioUrl(name: string): string {
  return `/assets/audio/${name}.mp3`;
}

export function sceneImageUrl(imagePath: string): string {
  return `/assets/scene/${imagePath}`;
}

export function iconUrl(icon: string): string {
  return `/assets/icons/${icon}`;
}

export function sceneTracksUrl(title: string): string {
  return `/assets/scene/${title}.json`;
}
