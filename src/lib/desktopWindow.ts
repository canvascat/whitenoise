/** localStorage flag: default desktop PWA window size already applied once. */
export const DESKTOP_WINDOW_STORAGE_KEY = "wn-desktop-window-default";

/** Phone-like portrait size for the mobile-first UI on desktop. */
export const DEFAULT_DESKTOP_WINDOW = { width: 430, height: 860 } as const;

function isInstalledAppWindow(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(display-mode: browser)").matches) return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return iosStandalone === true;
}

/**
 * On first launch of an installed desktop PWA, size the window to a phone-like
 * portrait. Manifest cannot set default size; browsers remember later resizes.
 */
export function applyDefaultDesktopWindowSize(
  storage: Storage = localStorage,
  size: { width: number; height: number } = DEFAULT_DESKTOP_WINDOW,
): boolean {
  if (typeof window === "undefined") return false;
  if (!isInstalledAppWindow()) return false;
  if (storage.getItem(DESKTOP_WINDOW_STORAGE_KEY) === "1") return false;

  const screen = window.screen as Screen & { availLeft?: number; availTop?: number };
  const availW = screen.availWidth || size.width;
  const availH = screen.availHeight || size.height;
  const width = Math.min(size.width, availW);
  const height = Math.min(size.height, availH);
  const left = typeof screen.availLeft === "number" ? screen.availLeft : 0;
  const top = typeof screen.availTop === "number" ? screen.availTop : 0;
  const x = Math.max(0, Math.floor(left + (availW - width) / 2));
  const y = Math.max(0, Math.floor(top + (availH - height) / 2));

  window.moveTo(x, y);
  window.resizeTo(width, height);
  storage.setItem(DESKTOP_WINDOW_STORAGE_KEY, "1");
  return true;
}
