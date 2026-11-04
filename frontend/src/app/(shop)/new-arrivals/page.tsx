import type { Metadata } from "next";
import Link from "next/link";
import { getNewArrivals } from "@/lib/catalog";
import { CatalogProductGrid } from "@/components/shop/CatalogProductCard";

export const metadata: Metadata = {
  title: "New Arrivals",
  description: "The latest handmade designs from our studio – silk thread bangles, keychains, headbands, brooch pins, U pins, alligator clips and jhumkas. Enquire on WhatsApp.",
  alternates: { canonical: "/new-arrivals" },
};

/**
 * Products flagged `isNewArrival` in src/data/products.json (the most recent photo shoot),
 * newest photo first. Static – rebuilt with the catalogue.
 */
export default function NewArrivalsPage() {
  const products = getNewArrivals();
  const byCollection = new Map<string, { name: string; href: string; count: number }>();
  for (const p of products) {
    const c = byCollection.get(p.collection) ?? { name: p.collectionName, href: p.collectionHref, count: 0 };
    c.count += 1;
    byCollection.set(p.collection, c);
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <nav className="mb-5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gold-dark">Home</Link> / <span className="text-ink">New Arrivals</span>
      </nav>
      <header className="mb-8">
        <p className="eyebrow">Just in</p>
        <h1 className="heading-display mt-1 text-4xl text-brown sm:text-5xl">New Arrivals</h1>
        <p className="mt-3 max-w-xl text-muted">{products.length} new handmade designs, fresh from our latest studio shoot.</p>
        {byCollection.size > 1 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="New arrivals by collection">
            {[...byCollection.values()].map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-ink/80 hover:border-gold hover:text-gold-dark">
                  {c.name} <span className="text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      {products.length > 0 ? (
        <CatalogProductGrid products={products} priorityCount={4} />
      ) : (
        <p className="card px-6 py-16 text-center text-muted">New designs are on their way – check back soon.</p>
      )}
    </div>
  );
}
