import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { getCategories, getProducts } from "@/lib/api";
import ProductGrid from "./ProductGrid";
import ShopFilters from "./ShopFilters";

const ALLOWED = ["category", "search", "min_price", "max_price", "availability", "new", "best_seller", "featured", "on_sale", "sort", "page"] as const;

export function pickQuery(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of ALLOWED) {
    const v = sp[k];
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export default async function ShopListing({ query, basePath, lockedCategory, hideCategories = false }: { query: Record<string, string | undefined>; basePath: string; lockedCategory?: string; hideCategories?: boolean }) {
  const q = { ...query, ...(lockedCategory ? { category: lockedCategory } : {}) };
  const [result, categories] = await Promise.all([getProducts({ ...q, per_page: "12" }), getCategories()]);
  const { data: products, meta } = result;

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    Object.entries({ ...query, page: page > 1 ? String(page) : undefined }).forEach(([k, v]) => v && k !== "category" && params.set(k, v));
    if (!lockedCategory && query.category) params.set("category", query.category);
    return `${basePath}${params.size ? `?${params}` : ""}`;
  };

  return (
    <ShopFilters categories={categories} current={q} lockedCategory={lockedCategory} bounds={result.meta_extra ?? { min_price: 0, max_price: 0 }} total={meta.total} hideCategories={hideCategories}>
      {query.search && (
        <p className="mb-5 text-sm text-muted">
          Showing results for <span className="font-medium text-ink">“{query.search}”</span> · <Link href={basePath} className="text-gold-dark underline">clear</Link>
        </p>
      )}
      {products.length ? <ProductGrid products={products} priorityCount={4} /> : <NoResults basePath={basePath} />}
      <Pagination current={meta.current_page} last={meta.last_page} href={pageHref} />
    </ShopFilters>
  );
}

export function NoResults({ basePath }: { basePath: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <SearchX className="h-10 w-10 text-sand" strokeWidth={1.3} />
      <p className="heading-display text-2xl">No products found</p>
      <p className="text-sm text-muted">Try removing a filter, or ask us for a custom piece.</p>
      <div className="mt-2 flex gap-2">
        <Link href={basePath} className="btn-outline">Clear filters</Link>
        <Link href="/custom-order" className="btn-primary">Custom order</Link>
      </div>
    </div>
  );
}

export function Pagination({ current, last, href }: { current: number; last: number; href: (page: number) => string }) {
  if (last <= 1) return null;
  return (
    <nav className="mt-12 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {current > 1 && <Link href={href(current - 1)} className="btn-ghost" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link>}
      {Array.from({ length: last }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === last || Math.abs(p - current) <= 1)
        .map((p, i, arr) => (
          <span key={p} className="flex items-center gap-1.5">
            {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <Link href={href(p)} aria-current={p === current ? "page" : undefined}
              className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm ${p === current ? "bg-ink text-ivory" : "hover:bg-cream"}`}>{p}</Link>
          </span>
        ))}
      {current < last && <Link href={href(current + 1)} className="btn-ghost" aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link>}
    </nav>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:ml-[17.5rem] xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-square rounded-2xl bg-cream" />
          <div className="mt-3 h-4 w-3/4 rounded bg-cream" />
          <div className="mt-2 h-4 w-1/3 rounded bg-cream" />
        </div>
      ))}
    </div>
  );
}
