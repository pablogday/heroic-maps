import { BinaryReader } from "./reader";

/**
 * HotA prepends a variable-length prefix between the 4-byte version
 * magic and the SoD-compatible basic header (`areAnyPlayers`, width,
 * etc.). The prefix shape is keyed off a `subRevision` field — each
 * HotA build added more conditional fields.
 *
 * **Important:** This is reverse-engineered from byte patterns in our
 * corpus, not from official documentation. The shape matches every
 * sample we've examined (subRev = 0, 1, 3, 5, 7, 8, 9), but unfamiliar
 * subRevisions may parse incorrectly. The parser bails out for
 * subRev > MAX_KNOWN_SUBREV.
 *
 * Empirical structure:
 *   u32 subRevision
 *   if subRevision >= 8:
 *     u32 + u32 + u32   (three extra fields — purpose unknown, varies)
 *   if subRevision >= 1:
 *     u16               (always 0 in samples)
 *   if subRevision >= 2:
 *     u32               (always 12 — likely "supported faction count")
 *   if subRevision >= 5:
 *     u32               (11 for subRev 5-8, 12 for subRev 9 — playable count?)
 *     u8                (varies: 0x11, 0x1f)
 *   if subRevision >= 7:
 *     u8                (always 0)
 *   if subRevision >= 8:
 *     u8                (always 0 or 1)
 *   if subRevision >= 9:
 *     u32               (always 0 in our one sample — needs more data)
 *
 * Total prefix bytes by subRev (excluding version magic):
 *   0 →  4    1 →  6    2 → 10    3 → 10    5 → 15
 *   7 → 16    8 → 29    9 → 33
 */

export const MAX_KNOWN_SUBREV = 9;

export interface HotaPrefix {
  subRevision: number;
}

export function parseHotaPrefix(reader: BinaryReader): HotaPrefix {
  const subRevision = reader.u32le();
  if (subRevision > MAX_KNOWN_SUBREV) {
    throw new Error(
      `HotA subRevision ${subRevision} exceeds known range (max ${MAX_KNOWN_SUBREV})`
    );
  }

  if (subRevision >= 8) {
    reader.skip(12);
  }
  if (subRevision >= 1) {
    reader.u16le();
  }
  if (subRevision >= 2) {
    reader.u32le();
  }
  if (subRevision >= 5) {
    reader.u32le();
    reader.u8();
  }
  if (subRevision >= 7) {
    reader.u8();
  }
  if (subRevision >= 8) {
    reader.u8();
  }
  if (subRevision >= 9) {
    reader.u32le();
  }

  return { subRevision };
}
