import { gunzipSync } from "fflate";

/**
 * .h3m / .h3c files are raw gzip streams. The first two bytes are the
 * gzip magic (0x1f 0x8b). Some uploads will have already been
 * decompressed by hand or wrapped in zip — the caller is expected to
 * have unwrapped any outer zip first.
 *
 * Universal: uses fflate (works in Node and browser).
 */
export function isGzip(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

export function decompress(buf: Uint8Array): Uint8Array {
  if (!isGzip(buf)) {
    throw new Error("not a gzip stream (missing 1f 8b magic)");
  }
  return gunzipSync(buf);
}
