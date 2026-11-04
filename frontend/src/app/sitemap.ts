import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { HANDMADE_SLUG } from "@/lib/collections";
import { getAllCollections } from "@/lib/collections.server";
import { getCatalog } from "@/lib/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = ["", "/shop", "/custom-order", "/new-arrivals", "/shop?best_seller=1"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.8,
  }));
  statics.push(
    ...["/collections", `/collections/${HANDMADE_SLUG}`, ...getAllCollections().map((c) => c.href)].map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...getCatalog().map((p) => ({ url: `${SITE_URL}${p.href}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  );
  try {
    const data = await getSitemapData();
    return [
      ...statics,
      ...data.categories.map((c) => ({ url: `${SITE_URL}/categories/${c.slug}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...data.products.map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  } catch {
    return statics;
  }
}
