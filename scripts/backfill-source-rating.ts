import { config } from "dotenv";
config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1 });

  const moved = await sql`
    UPDATE maps
    SET source_rating = rating_sum
    WHERE source_rating IS NULL AND rating_sum > 0
  `;
  console.log(`source_rating populated for ${moved.count} rows`);

  const reset = await sql`
    UPDATE maps
    SET rating_sum = 0, rating_count = 0
    WHERE rating_count <= 1
  `;
  console.log(`rating_sum/count reset for ${reset.count} rows`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
