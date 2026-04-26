import { readFileSync } from "node:fs";
import { parseListingPage, parsePageCount, mapSize, mapVersion, slugify } from "./parse";

const html = readFileSync("/tmp/m4h/list.html", "utf8");
const maps = parseListingPage(html);
console.log(`Parsed ${maps.length} maps. Total pages: ${parsePageCount(html)}`);
console.log("\n--- First map ---");
console.log(JSON.stringify(maps[0], null, 2));
console.log("\n--- Mapped version/size for first 3 ---");
maps.slice(0, 3).forEach((m) => {
  console.log({
    slug: slugify(m.name, m.sourceId),
    size: mapSize(m.sizeRaw),
    version: mapVersion(m.versionRaw),
    raw: { sizeRaw: m.sizeRaw, versionRaw: m.versionRaw },
  });
});
