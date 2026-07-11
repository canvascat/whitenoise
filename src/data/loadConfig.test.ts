import { describe, expect, it } from "vite-plus/test";
import { parseSceneTracks, parseColorParam } from "./loadConfig";

describe("parseColorParam", () => {
  it("splits two hex colors", () => {
    expect(parseColorParam("#FF8FC86F;#FF46A773")).toEqual(["#8FC86F", "#46A773"]);
  });
});

describe("parseSceneTracks", () => {
  it("maps line and point tracks", () => {
    const raw = [
      {
        audioName: "河流",
        isLineAudio: true,
        isPointAudio: false,
        volume: 1,
        names: [],
        frequency: 0,
        duration: 0,
        totalEndTime: 0,
      },
      {
        isLineAudio: false,
        isPointAudio: true,
        names: ["雷1", "雷2"],
        frequency: 5,
        duration: 8000,
        totalEndTime: 120000,
        volume: 1,
      },
    ];
    const tracks = parseSceneTracks(raw);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({ kind: "line", name: "河流" });
    expect(tracks[1]).toMatchObject({
      kind: "point",
      variants: ["雷1", "雷2"],
      frequency: 5,
    });
  });
});
