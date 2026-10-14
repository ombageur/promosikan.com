import { describe, expect, it } from "vitest";
import { redirectTarget } from "./redirect";

describe("redirectTarget", () => {
  it("meneruskan path internal", () => {
    expect(redirectTarget({ from: "/invite/abc?token=x" })).toBe("/invite/abc?token=x");
  });

  it("menolak URL eksternal dan protocol-relative (open redirect)", () => {
    expect(redirectTarget({ from: "https://evil.example" })).toBe("/app");
    expect(redirectTarget({ from: "//evil.example" })).toBe("/app");
  });

  it("memakai fallback jika state kosong", () => {
    expect(redirectTarget(null)).toBe("/app");
    expect(redirectTarget(undefined, "/x")).toBe("/x");
  });
});
