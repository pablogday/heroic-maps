import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BinaryReader, EofError } from "../reader";

describe("BinaryReader", () => {
  it("reads little-endian integers", () => {
    const r = new BinaryReader(Buffer.from([0x01, 0x02, 0x03, 0x04]));
    assert.equal(r.u32le(), 0x04030201);
    assert.equal(r.offset, 4);
  });

  it("reads u8 / bool", () => {
    const r = new BinaryReader(Buffer.from([0x00, 0x01, 0xff]));
    assert.equal(r.bool(), false);
    assert.equal(r.bool(), true);
    assert.equal(r.u8(), 0xff);
  });

  it("reads length-prefixed strings", () => {
    const name = "Marshland";
    const len = Buffer.alloc(4);
    len.writeUInt32LE(name.length);
    const buf = Buffer.concat([len, Buffer.from(name, "latin1")]);
    const r = new BinaryReader(buf);
    assert.equal(r.string(), name);
  });

  it("throws EofError when reading past end", () => {
    const r = new BinaryReader(Buffer.from([0x01]));
    assert.throws(() => r.u32le(), EofError);
  });

  it("rejects absurd string lengths", () => {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(2 ** 30);
    const r = new BinaryReader(len);
    assert.throws(() => r.string(), RangeError);
  });
});
