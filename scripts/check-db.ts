import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const count =
    await sql`SELECT count(*)::int AS n, count(DISTINCT version) AS versions FROM maps`;
  const recent = await sql`
    SELECT id, name, size, version, total_players, download_count, rating_sum
    FROM maps ORDER BY id DESC LIMIT 5
  `;
  console.log("Stats:", count[0]);
  console.log("Recent:");
  for (const r of recent) console.log(" ", r);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
