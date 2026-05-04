import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseH3c, isCampaignMagic } from "../index";

/**
 * The .h3c parser is data-driven — we don't synthesize fixtures here
 * because the format is too gnarly to hand-roll a meaningful one.
 * Instead these tests pin down the magic-detection helper and the
 * shape of the failure modes.
 */

describe("isCampaignMagic", () => {
  it("recognizes the SoD/HotA campaign version magics", () => {
    assert.equal(isCampaignMagic(new Uint8Array([0x06, 0, 0, 0])), true); // SoD
    assert.equal(isCampaignMagic(new Uint8Array([0x0a, 0, 0, 0])), true); // HotA
    assert.equal(isCampaignMagic(new Uint8Array([0x04, 0, 0, 0])), true); // RoE
    assert.equal(isCampaignMagic(new Uint8Array([0x05, 0, 0, 0])), true); // AB
    assert.equal(isCampaignMagic(new Uint8Array([0x07, 0, 0, 0])), true); // Chr
  });

  it("rejects single-map magics and noise", () => {
    // SoD .h3m magic — definitely not a campaign.
    assert.equal(isCampaignMagic(new Uint8Array([0x1c, 0, 0, 0])), false);
    // HotA .h3m magic.
    assert.equal(isCampaignMagic(new Uint8Array([0x1f, 0, 0, 0])), false);
    // Trailing bytes nonzero — fails the "magic + 00 00 00" precheck.
    assert.equal(isCampaignMagic(new Uint8Array([0x06, 1, 0, 0])), false);
    // Buffer too short.
    assert.equal(isCampaignMagic(new Uint8Array([0x06])), false);
  });
});

describe("parseH3c", () => {
  it("rejects buffers smaller than the version magic", () => {
    const r = parseH3c(new Uint8Array([0x06, 0, 0]));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /too small/);
  });

  it("reports unknown campaign magics with the raw value", () => {
    const r = parseH3c(new Uint8Array([0xff, 0xee, 0, 0, 0, 0, 0, 0]));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /0x0000eeff/);
  });

  it("returns a structured failure for HotA formatVersion 3", () => {
    // 0x0a = HotA campaign + formatVersion=3 — currently unsupported.
    const buf = new Uint8Array(32);
    buf[0] = 0x0a;
    buf[4] = 0x03;
    const r = parseH3c(buf);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /formatVersion 3/);
  });
});
