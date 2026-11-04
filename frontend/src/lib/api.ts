import "server-only";
import { cache } from "react";
import { SERVER_API_URL } from "./config";
import type { Category, HomeData, Paginated, Product, Settings } from "./types";

/**
 * Server-side storefront API. Requests are uncached so admin price / stock
 * changes are visible immediately. React `cache` dedupes calls within a render.
 */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

export class NotFoundError extends Error {}

export const getSettings = cache(async (): Promise<Settings> => (await get<{ data: Settings }>("/settings")).data);

export const getHome = cache(async (): Promise<HomeData> => (await get<{ data: HomeData }>("/home")).data);

export const getCategories = cache(async (): Promise<Category[]> => (await get<{ data: Category[] }>("/categories")).data);

export const getCategory = cache(async (slug: string): Promise<Category | null> => {
  try {
    return (await get<{ data: Category }>(`/categories/${encodeURIComponent(slug)}`)).data;
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
});

export const getProduct = cache(async (slug: string): Promise<{ product: Product; related: Product[] } | null> => {
  try {
    const r = await get<{ data: Product; related: Product[] }>(`/products/${encodeURIComponent(slug)}`);
    return { product: r.data, related: r.related };
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
});

export type ProductQuery = Record<string, string | undefined>;

export const getProducts = cache(async (query: ProductQuery): Promise<Paginated<Product>> => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== "") as [string, string][]);
  return get<Paginated<Product>>(`/products?${qs.toString()}`);
});

export async function getSitemapData(): Promise<{ products: { slug: string; updated_at: string }[]; categories: { slug: string; updated_at: string }[] }> {
  return (await get<{ data: never }>("/sitemap")).data;
}
