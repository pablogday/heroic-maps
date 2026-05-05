import { unzipSync } from "fflate";

/**
 * Many community .h3m files ship inside a .zip; some older Polish /
 * Russian uploads ship inside a .rar. `unwrapMapFile` peels off the
 * archive wrapper if present and returns the inner map bytes plus
 * its filename.
 *
 * Universal: uses fflate for zip (sync) and node-unrar-js for rar
 * (async, WASM). Both work in Node and the browser, so the same
 * code path covers the upload-form auto-fill (client) and server-
 * side scripts (Node).
 *
 * The function is async because rar decoding requires a WASM init.
 * Zip-only or raw paths still resolve in microseconds.
 */
export type Unwrapped =
  | { ok: true; bytes: Uint8Array; filename: string; wasZip: boolean }
  | { ok: false; reason: string };

const MAP_EXT = new Set(["h3m", "h3c"]);
const ZIP_MAGIC = [0x50, 0x4b]; // "PK"
const RAR_MAGIC_4 = [0x52, 0x61, 0x72, 0x21]; // "Rar!"

export async function unwrapMapFile(buf: Uint8Array): Promise<Unwrapped> {
  if (startsWith(buf, RAR_MAGIC_4)) {
    return unwrapRar(buf);
  }
  if (startsWith(buf, ZIP_MAGIC)) {
    return unwrapZip(buf);
  }
  // Already raw — pass through.
  return { ok: true, bytes: buf, filename: "", wasZip: false };
}

function unwrapZip(buf: Uint8Array): Unwrapped {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buf);
  } catch (e) {
    return {
      ok: false,
      reason: `zip parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return pickLargestMapEntry(entries, "zip");
}

async function unwrapRar(buf: Uint8Array): Promise<Unwrapped> {
  // Lazy import — keeps the rar WASM out of the bundle for the 99%
  // of paths that don't need it.
  let createExtractorFromData: typeof import("node-unrar-js").createExtractorFromData;
  try {
    ({ createExtractorFromData } = await import("node-unrar-js"));
  } catch (e) {
    return {
      ok: false,
      reason: `rar decoder failed to load: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  let extractor;
  try {
    // `data` accepts ArrayBuffer; pass the underlying buffer slice
    // so we don't drag the SharedArrayBuffer wrapper into wasm.
    extractor = await createExtractorFromData({
      data: buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength
      ) as ArrayBuffer,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `rar parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const fileList = [...extractor.getFileList().fileHeaders];
  const candidates = fileList
    .filter((h) => {
      if (h.flags.directory) return false;
      const name = h.name;
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      return MAP_EXT.has(ext);
    })
    .sort((a, b) => b.unpSize - a.unpSize); // largest first

  if (candidates.length === 0) {
    return { ok: false, reason: "rar contains no .h3m or .h3c file" };
  }

  const targetName = candidates[0].name;
  let extracted;
  try {
    extracted = extractor.extract({ files: [targetName] });
  } catch (e) {
    return {
      ok: false,
      reason: `rar extract failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const file = [...extracted.files][0];
  if (!file?.extraction) {
    return { ok: false, reason: "rar entry could not be decoded" };
  }
  return {
    ok: true,
    bytes: new Uint8Array(file.extraction),
    filename: targetName,
    wasZip: false,
  };
}

/** Common picker for both zip + (post-extraction) rar listings. */
function pickLargestMapEntry(
  entries: Record<string, Uint8Array>,
  kind: "zip"
): Unwrapped {
  const candidates = Object.entries(entries).filter(([name]) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return MAP_EXT.has(ext);
  });
  if (candidates.length === 0) {
    return { ok: false, reason: `${kind} contains no .h3m or .h3c file` };
  }
  // Prefer the largest map file when several are present (some
  // archives ship a campaign + readme + extras).
  candidates.sort((a, b) => b[1].length - a[1].length);
  const [filename, bytes] = candidates[0];
  return { ok: true, bytes, filename, wasZip: kind === "zip" };
}

function startsWith(buf: Uint8Array, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}
