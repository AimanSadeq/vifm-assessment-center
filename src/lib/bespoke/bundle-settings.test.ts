/**
 * Unit tests for the bundle delivery-setting helpers (client logo, greeting).
 * Run: npx tsx --test src/lib/bespoke/bundle-settings.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { firstNameOf, sanitiseClientLogoUrl } from "./bundle-settings.ts";

test("a logo shipped under /client-logos/ is kept", () => {
  assert.equal(sanitiseClientLogoUrl("/client-logos/soudah-development.png"), "/client-logos/soudah-development.png");
  assert.equal(sanitiseClientLogoUrl("  /client-logos/acme.svg  "), "/client-logos/acme.svg");
});

test("anything that would load from elsewhere is refused", () => {
  for (const bad of [
    "https://evil.example/logo.png",
    "//evil.example/logo.png",
    "/client-logos/../secret.png",
    "/client-logos/sub/logo.png",
    "/images/logo.png",
    "/client-logos/logo.gif",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ]) {
    assert.equal(sanitiseClientLogoUrl(bad), null, String(bad));
  }
});

test("the greeting uses the first name", () => {
  assert.equal(firstNameOf("Sarah Abdullah Alfakeeh"), "Sarah");
  assert.equal(firstNameOf("  Ahmed   Sbah Alonazi "), "Ahmed");
  assert.equal(firstNameOf("Mufid"), "Mufid");
  assert.equal(firstNameOf(""), "");
});
