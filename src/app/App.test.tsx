import { describe, expect, it } from "vite-plus/test";
import { App } from "./App";

describe("App", () => {
  it("exports a component", () => {
    expect(typeof App).toBe("function");
  });
});
