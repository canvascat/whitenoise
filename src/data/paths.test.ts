import { describe, expect, it } from "vite-plus/test";
import { audioUrl, sceneImageUrl, iconUrl } from "./paths";

describe("paths", () => {
  it("builds audio url from name without extension", () => {
    expect(audioUrl("夏雨")).toBe("/assets/audio/夏雨.mp3");
  });

  it("builds scene image url", () => {
    expect(sceneImageUrl("夏雨.jpg")).toBe("/assets/scene/夏雨.jpg");
  });

  it("builds icon url", () => {
    expect(iconUrl("夏雨.png")).toBe("/assets/icons/夏雨.png");
  });
});
