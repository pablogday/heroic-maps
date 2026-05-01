import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { parseH3m } from "../index";

/**
 * Synthesize a minimal SoD header so we can exercise the parser
 * without committing real map files as fixtures. Each call builds the
 * exact bytes a SoD .h3m would have for the basic-header section.
 */
function buildSoDHeader(opts: {
  width: number;
  hasUnderground: boolean;
  name: string;
  description: string;
  difficulty: number;
  heroLevelLimit?: number;
  areAnyPlayers?: boolean;
}): Buffer {
  const parts: Buffer[] = [];
  // version: SoD = 0x1c
  const ver = Buffer.alloc(4);
  ver.writeUInt32LE(0x0000001c);
  parts.push(ver);
  parts.push(Buffer.from([opts.areAnyPlayers === false ? 0 : 1]));
  const w = Buffer.alloc(4);
  w.writeUInt32LE(opts.width);
  parts.push(w);
  parts.push(Buffer.from([opts.hasUnderground ? 1 : 0]));
  parts.push(lpString(opts.name));
  parts.push(lpString(opts.description));
  parts.push(Buffer.from([opts.difficulty]));
  parts.push(Buffer.from([opts.heroLevelLimit ?? 0]));
  return Buffer.concat(parts);
}

function lpString(s: string): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(s.length);
  return Buffer.concat([len, Buffer.from(s, "latin1")]);
}

describe("parseH3m — SoD synthetic header", () => {
  it("parses a Medium two-level Hard map", () => {
    const raw = buildSoDHeader({
      width: 72,
      hasUnderground: true,
      name: "Marshland Menace",
      description: "Frogs everywhere.",
      difficulty: 2,
    });
    const res = parseH3m(gzipSync(raw));
    assert.equal(res.confidence, "high");
    assert.equal(res.format, "SoD");
    assert.equal(res.mapVersion, "SoD");
    assert.ok(res.header);
    assert.equal(res.header!.size, "M");
    assert.equal(res.header!.hasUnderground, true);
    assert.equal(res.header!.name, "Marshland Menace");
    assert.equal(res.header!.description, "Frogs everywhere.");
    assert.equal(res.header!.difficulty, "hard");
    assert.equal(res.header!.heroLevelLimit, 0);
    assert.deepEqual(res.warnings, []);
  });

  it("works on uncompressed input too", () => {
    const raw = buildSoDHeader({
      width: 144,
      hasUnderground: false,
      name: "Big Map",
      description: "",
      difficulty: 0,
    });
    const res = parseH3m(raw);
    assert.equal(res.confidence, "high");
    assert.equal(res.header!.size, "XL");
    assert.equal(res.header!.difficulty, "easy");
  });

  it("returns 'partial' on unknown width", () => {
    const raw = buildSoDHeader({
      width: 99,
      hasUnderground: false,
      name: "Weird",
      description: "",
      difficulty: 1,
    });
    const res = parseH3m(raw);
    assert.equal(res.confidence, "partial");
    assert.equal(res.header!.size, null);
    assert.ok(res.warnings.some((w) => w.includes("99")));
  });

  it("fails cleanly on unknown version magic", () => {
    const buf = Buffer.alloc(8);
    buf.writeUInt32LE(0xdeadbeef);
    const res = parseH3m(buf);
    assert.equal(res.confidence, "failed");
    assert.equal(res.format, "Unknown");
    assert.match(res.error!, /unrecognized version magic/);
  });

  it("fails cleanly on truncated file", () => {
    const buf = Buffer.alloc(2);
    const res = parseH3m(buf);
    assert.equal(res.confidence, "failed");
    assert.match(res.error!, /too small/);
  });
});
