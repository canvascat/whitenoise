import { describe, expect, it } from "vite-plus/test";
import { audioUrl, sceneImageUrl, sceneLqipUrl, iconUrl } from "./paths";

describe("paths", () => {
  it("builds audio url from name without extension", () => {
    expect(audioUrl("rain")).toBe(`${import.meta.env.BASE_URL}assets/audio/rain.mp3`);
  });

  it("percent-encodes non-ascii audio names for iOS fetch", () => {
    expect(audioUrl("夏雨")).toBe(
      `${import.meta.env.BASE_URL}assets/audio/${encodeURIComponent("夏雨")}.mp3`,
    );
  });

  it("maps jpg scene paths to webp", () => {
    expect(sceneImageUrl("夏雨.jpg")).toBe(
      `${import.meta.env.BASE_URL}assets/scene/${encodeURIComponent("夏雨.webp")}`,
    );
  });

  it("keeps webp scene paths", () => {
    expect(sceneImageUrl("夏雨.webp")).toBe(
      `${import.meta.env.BASE_URL}assets/scene/${encodeURIComponent("夏雨.webp")}`,
    );
  });

  it("builds lqip url from jpg or webp stem", () => {
    expect(sceneLqipUrl("夏雨.jpg")).toBe(
      `${import.meta.env.BASE_URL}assets/scene/lqip/${encodeURIComponent("夏雨")}.webp`,
    );
    expect(sceneLqipUrl("夏雨.webp")).toBe(
      `${import.meta.env.BASE_URL}assets/scene/lqip/${encodeURIComponent("夏雨")}.webp`,
    );
  });

  it("builds icon url", () => {
    expect(iconUrl("夏雨.png")).toBe(
      `${import.meta.env.BASE_URL}assets/icons/${encodeURIComponent("夏雨.png")}`,
    );
  });
});
