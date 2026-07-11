export type RgbaImageData = {
  data: ArrayLike<number>;
  width: number;
  height: number;
};

/** Convert 0–255 RGB channels to #rrggbb. */
export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Average opaque pixels in the top band of ImageData (for status-bar / notch tint).
 * @param topBandRatio portion of height from the top to sample (0–1)
 */
export function averageColorFromImageData(imageData: RgbaImageData, topBandRatio = 0.2): string {
  const { data, width, height } = imageData;
  const rows = Math.max(1, Math.floor(height * Math.min(1, Math.max(0, topBandRatio))));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 255;
      if (a < 16) continue;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      count += 1;
    }
  }

  if (count === 0) return "#121212";
  return rgbToHex(r / count, g / count, b / count);
}

/** Load an image URL and return the top-band average color as #rrggbb. */
export function sampleTopColorFromUrl(url: string, topBandRatio = 0.25): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const w = Math.max(1, img.naturalWidth || img.width);
        const h = Math.max(1, img.naturalHeight || img.height);
        const canvas = document.createElement("canvas");
        // Downscale for speed; keep aspect
        const maxW = 64;
        const scale = Math.min(1, maxW / w);
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve("#121212");
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(averageColorFromImageData(imageData, topBandRatio));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
}

const DEFAULT_THEME = "#121212";

/** Update theme-color meta + document background (iOS status bar / overscroll). */
export function applyChromeColor(hex: string): void {
  const color = hex || DEFAULT_THEME;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}

export function resetChromeColor(): void {
  applyChromeColor(DEFAULT_THEME);
}
