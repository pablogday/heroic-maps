import { gunzipSync } from "node:zlib";

/**
 * .h3m / .h3c files are raw gzip streams. The first two bytes are the
 * gzip magic (0x1f 0x8b). Some uploads will have already been
 * decompressed by hand or wrapped in zip — the caller is expected to
 * have unwrapped any outer zip first.
 */
export function isGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

export function decompress(buf: Buffer): Buffer {
  if (!isGzip(buf)) {
    throw new Error("not a gzip stream (missing 1f 8b magic)");
  }
  return gunzipSync(buf);
}
