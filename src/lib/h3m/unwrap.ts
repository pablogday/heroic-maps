import { unzipSync } from "fflate";

/**
 * Many community .h3m files ship inside a .zip (sometimes a .rar).
 * `unwrapMapFile` peels off a zip wrapper if present and returns the
 * inner map bytes plus its filename. Rar isn't supported — needs a
 * WASM decoder we haven't pulled in yet.
 *
 * Universal: uses fflate which runs in Node and the browser, so the
 * same code path works for the upload-form auto-fill (client) and
 * server-side scripts (Node).
 */
export type Unwrapped =
  | { ok: true; bytes: Uint8Array; filename: string; wasZip: boolean }
  | { ok: false; reason: string };

const MAP_EXT = new Set(["h3m", "h3c"]);
const ZIP_MAGIC = [0x50, 0x4b]; // "PK"
const RAR_MAGIC = [0x52, 0x61, 0x72, 0x21]; // "Rar!"

export function unwrapMapFile(buf: Uint8Array): Unwrapped {
  if (startsWith(buf, RAR_MAGIC)) {
    return { ok: false, reason: "rar archive (decoder not yet available)" };
  }
  if (startsWith(buf, ZIP_MAGIC)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buf);
    } catch (e) {
      return {
        ok: false,
        reason: `zip parse failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    const candidates = Object.entries(entries).filter(([name]) => {
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      return MAP_EXT.has(ext);
    });
    if (candidates.length === 0) {
      return { ok: false, reason: "zip contains no .h3m or .h3c file" };
    }
    // Prefer the largest map file when there are several (some
    // archives ship a campaign + readme + extras).
    candidates.sort((a, b) => b[1].length - a[1].length);
    const [filename, bytes] = candidates[0];
    return { ok: true, bytes, filename, wasZip: true };
  }
  // Already raw — pass through.
  return { ok: true, bytes: buf, filename: "", wasZip: false };
}

function startsWith(buf: Uint8Array, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}
