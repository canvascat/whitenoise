import { describe, expect, it, vi } from "vite-plus/test";
import { audioDebug } from "./audioDebug";

describe("audioDebug", () => {
  it("prefixes console output with [wn-audio]", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    audioDebug.info("hello", { a: 1 });
    expect(info).toHaveBeenCalledWith("[wn-audio]", "hello", { a: 1 });
    info.mockRestore();
  });
});
