/**
 * Centralised catalogue of the photographed products in `public/images/`.
 *
 * Source of truth: `src/data/products.json` – one entry per real product, with the
 * images that show it (primary first). Every page that shows a photographed product
 * (homepage, collections, New Arrivals, product pages, related products) reads from
 * here, so a product always has the same name, collection, category and photos.
 *
 * Adding a product: drop the photo into its collection folder using the
 * `<colour>_<design>_<type>_NN.ext` naming pattern, then add an entry to products.json
 * (new id, unique slug). Run `npm run catalog:check` to find photos without an entry.
 *
 * Prices, materials and stock are deliberately not stored here – they are not known for
 * these photos. Customers enquire on WhatsApp for the price.
 *
 * Client-safe (no `fs`), but the JSON is large: import it from server components only.
 */
import data from "@/data/products.json";
import { COLLECTION_META, collectionHref } from "./collections";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  /** Collection slug, e.g. "silk-thread-jhumka". */
  collection: string;
  category: string;
  /** Paths under /images, primary image first. */
  images: string[];
  /** Newest original camera timestamp of the product's photos (null when unknown). */
  photographedAt: string | null;
  isNewArrival: boolean;
  homepageBanner: boolean;
};

export type CatalogItem = CatalogProduct & {
  collectionName: string;
  collectionHref: string;
  href: string;
  image: string;
};

const META_BY_SLUG = new Map(Object.values(COLLECTION_META).map((m) => [m.slug, m]));

function enrich(p: CatalogProduct): CatalogItem {
  const meta = META_BY_SLUG.get(p.collection);
  return {
    ...p,
    collectionName: meta?.name ?? p.collection,
    collectionHref: collectionHref(p.collection),
    href: productHref(p.slug),
    image: p.images[0],
  };
}

const PRODUCTS: CatalogItem[] = (data as CatalogProduct[]).map(enrich);
const BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));
const BY_IMAGE = new Map(PRODUCTS.flatMap((p) => p.images.map((src) => [src, p] as const)));

export function productHref(slug: string): string {
  return `/products/${slug}`;
}

export function getCatalog(): CatalogItem[] {
  return PRODUCTS;
}

export function getCatalogProduct(slug: string): CatalogItem | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Like getCatalogProduct but fails the build when a hard-coded slug goes stale. */
export function requireProduct(slug: string): CatalogItem {
  const p = BY_SLUG.get(slug);
  if (!p) throw new Error(`Unknown catalogue product "${slug}" – check src/data/products.json`);
  return p;
}

export function getProductByImage(src: string): CatalogItem | null {
  return BY_IMAGE.get(src) ?? null;
}

export function getCollectionProducts(collection: string): CatalogItem[] {
  return PRODUCTS.filter((p) => p.collection === collection);
}

/** New arrivals, newest photo first (stable on ties: catalogue order). */
export function getNewArrivals(): CatalogItem[] {
  return PRODUCTS.filter((p) => p.isNewArrival).sort((a, b) => (b.photographedAt ?? "").localeCompare(a.photographedAt ?? ""));
}

/**
 * A short, varied selection of new arrivals: take the newest product of each collection
 * in turn so one large batch (e.g. bangles) does not fill the whole row.
 */
export function getNewArrivalHighlights(limit: number): CatalogItem[] {
  const groups = new Map<string, CatalogItem[]>();
  for (const p of getNewArrivals()) groups.set(p.collection, [...(groups.get(p.collection) ?? []), p]);
  const queues = [...groups.values()];
  const out: CatalogItem[] = [];
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && out.length < limit) out.push(next);
    }
  }
  return out;
}

/** Other products of the same collection, starting just after this one. */
export function getRelatedProducts(p: CatalogItem, limit = 4): CatalogItem[] {
  const same = PRODUCTS.filter((x) => x.collection === p.collection && x.id !== p.id);
  const start = Math.max(0, same.findIndex((x) => x.id > p.id));
  return [...same.slice(start), ...same.slice(0, start)].slice(0, limit);
}

export type CatalogCategory = { slug: string; name: string; count: number };

/**
 * Shop sidebar categories: one per collection that has catalogued products, in the
 * collection display order. Built from the catalogue, so an empty collection never shows.
 */
export function getCatalogCategories(): CatalogCategory[] {
  const counts = new Map<string, number>();
  for (const p of PRODUCTS) counts.set(p.collection, (counts.get(p.collection) ?? 0) + 1);
  const order = (slug: string) => META_BY_SLUG.get(slug)?.order ?? Number.MAX_SAFE_INTEGER;
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, name: META_BY_SLUG.get(slug)?.name ?? slug, count }))
    .sort((a, b) => order(a.slug) - order(b.slug) || a.name.localeCompare(b.name, "en"));
}

export const CATALOG_SORTS = [
  { value: "latest", label: "Latest" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

export type CatalogQuery = { category?: string; search?: string; new?: string; sort?: string; page?: string };

/** Filter, sort and paginate the catalogue for the shop listing. */
export function queryCatalog(q: CatalogQuery, perPage = 24) {
  const term = q.search?.trim().toLowerCase();
  let list = PRODUCTS.filter((p) =>
    (!q.category || p.collection === q.category) &&
    (!q.new || p.isNewArrival) &&
    (!term || [p.name, p.collectionName, p.id, p.id.replace(/^product-0*/, "")].some((v) => v.toLowerCase().includes(term))),
  );
  if (q.sort === "name_asc" || q.sort === "name_desc") {
    const dir = q.sort === "name_asc" ? 1 : -1;
    list = [...list].sort((a, b) => dir * a.name.localeCompare(b.name, "en"));
  } else {
    // Latest: newest photo first; undated photos keep catalogue order after the dated ones.
    list = [...list].sort((a, b) => (b.photographedAt ?? "").localeCompare(a.photographedAt ?? ""));
  }
  const total = list.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(lastPage, Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1));
  return { products: list.slice((page - 1) * perPage, page * perPage), total, page, lastPage };
}

export function imageAlt(p: CatalogItem, index = 0): string {
  return index === 0 ? `${p.name} – ${p.collectionName}` : `${p.name} – view ${index + 1}`;
}
