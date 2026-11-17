import { describe, expect, it } from "vitest";

import { cn } from "../src/cn";

describe("cn", () => {
  it("compone clases y resuelve conflictos de Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
      "text-sm font-medium",
    );
  });
});
