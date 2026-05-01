/**
 * Tiny cursor over a Uint8Array. All multi-byte integers in the .h3m
 * format are little-endian. Strings are length-prefixed: u32le length
 * followed by that many bytes, decoded as latin1 (CP1252-ish) by
 * default. CP1251 (Russian) maps will need a different decoder later.
 *
 * Universal: works in Node and the browser. No `Buffer` dependency.
 */

const LATIN1 = new TextDecoder("latin1");

export class BinaryReader {
  offset = 0;
  private view: DataView;
  constructor(public buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

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
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  u16le(): number {
    this.ensure(2);
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  u32le(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  bytes(n: number): Uint8Array {
    this.ensure(n);
    const slice = this.buf.subarray(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  /** Length-prefixed string (u32le length + bytes), latin1-decoded. */
  string(maxLen = 1 << 20): string {
    const len = this.u32le();
    if (len > maxLen) {
      throw new RangeError(
        `string length ${len} exceeds sanity cap ${maxLen} at ${
          this.offset - 4
        }`
      );
    }
    return LATIN1.decode(this.bytes(len));
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
