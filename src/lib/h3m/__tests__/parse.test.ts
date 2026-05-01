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
  /** Number of human-playable slots out of 8. Default 2. */
  humans?: number;
  /** Number of AI-only slots out of 8. Default 2. */
  ais?: number;
}): Buffer {
  const parts: Buffer[] = [];
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

  // 8 player slots — disabled slots are 2 flag bytes + 13 skip bytes.
  // Enabled slots get a minimal valid block: aiTactic, p7, factions(2),
  // isFactionRandom, hasMainTown=0, hasRandomHero, mainCustomHero=0xff,
  // powerPlaceholders, heroCount=0, 3 padding = 13 trailing bytes.
  const humans = opts.humans ?? 2;
  const ais = opts.ais ?? 2;
  for (let i = 0; i < 8; i++) {
    const isHuman = i < humans;
    const isAI = !isHuman && i < humans + ais;
    if (!isHuman && !isAI) {
      parts.push(Buffer.alloc(15));
      continue;
    }
    parts.push(Buffer.from([isHuman ? 1 : 0, isAI || isHuman ? 1 : 0]));
    // aiTactic, p7, factionsLo, factionsHi, isFactionRandom, hasMainTown=0,
    // hasRandomHero, mainCustomHero=0xff, powerPlaceholders, heroCount=0,
    // 3 padding bytes
    parts.push(
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0xff, 0, 0, 0, 0, 0])
    );
  }
  // Standard victory + loss (0xff each)
  parts.push(Buffer.from([0xff, 0xff]));
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

  it("counts humans and AIs from player slots", () => {
    const raw = buildSoDHeader({
      width: 72,
      hasUnderground: false,
      name: "X",
      description: "",
      difficulty: 1,
      humans: 3,
      ais: 4,
    });
    const res = parseH3m(raw);
    assert.equal(res.confidence, "high");
    assert.equal(res.humanPlayers, 3);
    assert.equal(res.aiPlayers, 4);
    assert.equal(res.totalPlayers, 7);
  });

  it("reports standard victory and loss when none specified", () => {
    const raw = buildSoDHeader({
      width: 72,
      hasUnderground: false,
      name: "X",
      description: "",
      difficulty: 1,
    });
    const res = parseH3m(raw);
    assert.equal(res.victory!.type, "standard");
    assert.equal(res.loss!.type, "standard");
  });
});
