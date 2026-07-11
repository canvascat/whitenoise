import { describe, expect, it } from "vite-plus/test";
import { averageColorFromImageData, rgbToHex } from "./dominantColor";

describe("dominantColor", () => {
  it("rgbToHex pads channels", () => {
    expect(rgbToHex(15, 122, 179)).toBe("#0f7ab3");
  });

  it("averages top band of ImageData", () => {
    // 2x2: top row blue-ish, bottom row red — topBandRatio 0.5 → only top
    const data = new Uint8ClampedArray([
      0, 100, 200, 255, 0, 120, 180, 255, 255, 0, 0, 255, 200, 0, 0, 255,
    ]);
    const imageData = {
      data,
      width: 2,
      height: 2,
    };
    expect(averageColorFromImageData(imageData, 0.5)).toBe("#006ebe");
  });
});
