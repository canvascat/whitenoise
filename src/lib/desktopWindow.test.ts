import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { applyDefaultDesktopWindowSize, DESKTOP_WINDOW_STORAGE_KEY } from "./desktopWindow";

type MatchMediaMock = (query: string) => MediaQueryList;

function stubMatchMedia(standalone: boolean): void {
  const matchMedia: MatchMediaMock = (query) =>
    ({
      matches: query.includes("display-mode: browser")
        ? !standalone
        : standalone && query.includes("standalone"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList;
  vi.stubGlobal("matchMedia", matchMedia);
}

describe("applyDefaultDesktopWindowSize", () => {
  const resizeTo = vi.fn();
  const moveTo = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    resizeTo.mockReset();
    moveTo.mockReset();
    vi.stubGlobal("resizeTo", resizeTo);
    vi.stubGlobal("moveTo", moveTo);
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 1920,
        availHeight: 1080,
        availLeft: 0,
        availTop: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resizes standalone desktop window once to a phone-like portrait size", () => {
    stubMatchMedia(true);

    expect(applyDefaultDesktopWindowSize()).toBe(true);
    expect(resizeTo).toHaveBeenCalledWith(430, 860);
    expect(moveTo).toHaveBeenCalled();
    expect(localStorage.getItem(DESKTOP_WINDOW_STORAGE_KEY)).toBe("1");
  });

  it("does not resize again after the default has been applied", () => {
    stubMatchMedia(true);
    localStorage.setItem(DESKTOP_WINDOW_STORAGE_KEY, "1");

    expect(applyDefaultDesktopWindowSize()).toBe(false);
    expect(resizeTo).not.toHaveBeenCalled();
  });

  it("skips browser tab display mode", () => {
    stubMatchMedia(false);

    expect(applyDefaultDesktopWindowSize()).toBe(false);
    expect(resizeTo).not.toHaveBeenCalled();
  });

  it("clamps to available screen size", () => {
    stubMatchMedia(true);
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 360,
        availHeight: 640,
        availLeft: 0,
        availTop: 0,
      },
    });

    expect(applyDefaultDesktopWindowSize()).toBe(true);
    expect(resizeTo).toHaveBeenCalledWith(360, 640);
  });
});
