import Link from "next/link";
import { CATALOG_SORTS, getCatalogCategories, queryCatalog } from "@/lib/catalog";
import { CatalogProductGrid } from "./CatalogProductCard";
import ShopFilters from "./ShopFilters";
import { NoResults, Pagination } from "./ShopListing";

/**
 * Shop listing for the photographed catalogue (src/data/products.json). The sidebar
 * categories are the image collections that actually have products.
 */
export default function CatalogListing({ query, basePath }: { query: Record<string, string | undefined>; basePath: string }) {
  const categories = getCatalogCategories();
  // An unknown/old category slug (e.g. a retired API category) falls back to all products.
  const category = categories.some((c) => c.slug === query.category) ? query.category : undefined;
  const q = { category, search: query.search, new: query.new, sort: query.sort, page: query.page };
  const { products, total, page, lastPage } = queryCatalog(q);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    Object.entries({ ...q, page: n > 1 ? String(n) : undefined }).forEach(([k, v]) => v && params.set(k, v));
    return `${basePath}${params.size ? `?${params}` : ""}`;
  };

  return (
    <ShopFilters categories={categories} current={q} bounds={{ min_price: 0, max_price: 0 }} total={total} sorts={CATALOG_SORTS} catalogMode>
      {query.search && (
        <p className="mb-5 text-sm text-muted">
          Showing results for <span className="font-medium text-ink">“{query.search}”</span> · <Link href={basePath} className="text-gold-dark underline">clear</Link>
        </p>
      )}
      {products.length ? <CatalogProductGrid products={products} priorityCount={4} /> : <NoResults basePath={basePath} />}
      <Pagination current={page} last={lastPage} href={pageHref} />
    </ShopFilters>
  );
}
