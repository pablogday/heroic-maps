/**
 * Tiny cursor over a Buffer. All multi-byte integers in the .h3m
 * format are little-endian. Strings are length-prefixed: u32le length
 * followed by that many bytes, decoded as latin1 (CP1252-ish) by
 * default. CP1251 (Russian) maps will need a different decoder later.
 */
export class BinaryReader {
  offset = 0;
  constructor(public buf: Buffer) {}

  remaining(): number {
    return this.buf.length - this.offset;
  }

  ensure(n: number): void {
    if (this.offset + n > this.buf.length) {
      throw new EofError(
        `read past end of buffer (need ${n} at ${this.offset}, have ${this.remaining()})`
      );
    }
  }

  u8(): number {
    this.ensure(1);
    const v = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }

  u16le(): number {
    this.ensure(2);
    const v = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }

  u32le(): number {
    this.ensure(4);
    const v = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  bytes(n: number): Buffer {
    this.ensure(n);
    const slice = this.buf.subarray(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  /** Length-prefixed string (u32le length + bytes). */
  string(encoding: BufferEncoding = "latin1", maxLen = 1 << 20): string {
    const len = this.u32le();
    if (len > maxLen) {
      throw new RangeError(
        `string length ${len} exceeds sanity cap ${maxLen} at ${
          this.offset - 4
        }`
      );
    }
    return this.bytes(len).toString(encoding);
  }

  skip(n: number): void {
    this.ensure(n);
    this.offset += n;
  }
}

export class EofError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "EofError";
  }
}
