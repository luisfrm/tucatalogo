import { describe, expect, it } from "vitest";

import { findLastEmailTo } from "../src/libs/email";
import { postJson, uniqueEmail, uniqueSlug } from "./helpers";

describe("plumbing", () => {
  it("el worker comparte el buzón de pruebas con el test", async () => {
    const email = uniqueEmail();
    const response = await postJson("/auth/store/signup/otp", {
      email,
      slug: uniqueSlug(),
      turnstileToken: "test-token",
    });
    expect(response.status).toBe(202);
    const message = findLastEmailTo(email);
    expect(message).toBeTruthy();
  });
});
