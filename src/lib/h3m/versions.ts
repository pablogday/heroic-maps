/**
 * Version magic numbers found at the start of every .h3m file (u32 LE,
 * offset 0 of the decompressed stream).
 *
 * Sources cross-checked against the VCMI codebase
 * (https://github.com/vcmi/vcmi) and the h3m wiki notes from the
 * homm3tools community. HotA is a moving target — the magic has
 * changed across HotA releases (0x1F → 0x20 → 0x21 → 0x2C in newer
 * builds). We map the families we know and surface the raw code
 * otherwise so the coverage report can show us what to add next.
 */

export type FormatId =
  | "RoE"
  | "AB"
  | "SoD"
  | "HotA1"
  | "HotA2"
  | "HotA3"
  | "WoG"
  | "Chronicles"
  | "Campaign06"
  | "Campaign0A"
  | "Unknown";

export const VERSION_MAGIC: Record<number, FormatId> = {
  0x0000000e: "RoE", // 14
  0x00000015: "AB", // 21
  0x0000001c: "SoD", // 28
  0x0000001f: "HotA1", // 31 — HotA 1.0
  0x00000020: "HotA2", // 32 — HotA 1.4 / 1.5
  0x00000021: "HotA3", // 33 — HotA 1.6+
  0x00000033: "WoG", // 51
  0x0000002c: "Chronicles", // 44 (best guess; needs sample to verify)
  // .h3c campaign archives (multi-map). Parsing them needs a separate
  // module — treat as "known but unsupported" so the error message is
  // meaningful instead of "unrecognized magic".
  0x00000006: "Campaign06",
  0x0000000a: "Campaign0A",
};

/** True iff the format is in the SoD-compatible family for header parsing. */
export function isSoDFamily(id: FormatId): boolean {
  return id === "SoD" || id === "AB";
}

export function formatLabel(id: FormatId): string {
  switch (id) {
    case "HotA1":
    case "HotA2":
    case "HotA3":
      return "HotA";
    default:
      return id;
  }
}

/** Map the parsed format to the project's `mapVersionEnum` codes. */
export function toMapVersion(
  id: FormatId
): "RoE" | "AB" | "SoD" | "HotA" | "WoG" | "Chronicles" | "Other" {
  if (id === "HotA1" || id === "HotA2" || id === "HotA3") return "HotA";
  if (id === "Unknown" || id === "Campaign06" || id === "Campaign0A") {
    return "Other";
  }
  return id;
}
