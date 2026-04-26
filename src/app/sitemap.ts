import type { MetadataRoute } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { maps } from "@/db/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await db
    .select({ slug: maps.slug, updatedAt: maps.updatedAt })
    .from(maps)
    .orderBy(desc(maps.updatedAt));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/maps`, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE_URL}/maps?sort=rating`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/maps?sort=newest`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const mapRoutes: MetadataRoute.Sitemap = rows.map((m) => ({
    url: `${SITE_URL}/maps/${m.slug}`,
    lastModified: m.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...mapRoutes];
}
