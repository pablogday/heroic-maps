/**
 * Smoke test for R2 wiring. Uploads a tiny test object, verifies it
 * exists, fetches it back, confirms public URL is reachable, then
 * deletes it. Use after configuring credentials to confirm everything
 * is wired up before running real migration scripts.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  r2Put,
  r2Get,
  r2Exists,
  r2Delete,
  r2PublicUrl,
  getR2Bucket,
  getR2PublicUrl,
} from "../src/lib/r2";

async function main() {
  const key = `_smoketest/${Date.now()}.txt`;
  const payload = `Hello from Heroic Maps — ${new Date().toISOString()}`;

  console.log(`Bucket:     ${getR2Bucket()}`);
  console.log(`Public URL: ${getR2PublicUrl() || "(not set)"}`);
  console.log(`Test key:   ${key}\n`);

  console.log("→ PUT");
  await r2Put(key, payload, "text/plain");

  console.log("→ HEAD (exists?)");
  const exists = await r2Exists(key);
  console.log(`  exists: ${exists}`);

  console.log("→ GET");
  const buf = await r2Get(key);
  const fetched = buf.toString("utf8");
  console.log(`  body: "${fetched}"`);
  if (fetched !== payload) {
    throw new Error("Round-trip mismatch — what we got back didn't match.");
  }

  if (getR2PublicUrl()) {
    const url = r2PublicUrl(key);
    console.log(`→ Public fetch via ${url}`);
    const res = await fetch(url);
    if (res.ok) {
      const txt = await res.text();
      console.log(`  HTTP ${res.status}; body matches: ${txt === payload}`);
    } else {
      console.log(`  HTTP ${res.status} ${res.statusText}`);
      console.log(
        "  Public URL not reachable — check that the bucket's R2.dev subdomain is enabled."
      );
    }
  }

  console.log("→ DELETE");
  await r2Delete(key);

  console.log("\n✓ R2 round-trip OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
