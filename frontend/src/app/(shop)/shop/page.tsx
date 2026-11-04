import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CatalogListing from "@/components/shop/CatalogListing";
import ShopListing, { ListingSkeleton, pickQuery } from "@/components/shop/ShopListing";
import { getCatalogCategories } from "@/lib/catalog";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = pickQuery(await searchParams);
  const category = getCatalogCategories().find((c) => c.slug === q.category);
  const title = q.search ? `Search: ${q.search}` : q.new ? "New Arrivals" : q.best_seller ? "Best Sellers" : q.on_sale ? "Special Offers" : category ? `${category.name} – Shop Handmade` : "Shop All Handmade Jewellery";
  return {
    title,
    description: `Browse handmade ${getCatalogCategories().map((c) => c.name.toLowerCase()).join(", ")}. Enquire easily on WhatsApp with delivery across India.`,
    alternates: { canonical: "/shop" },
    robots: q.search ? { index: false } : undefined,
  };
}

export default function ShopPage({ searchParams }: Props) {
  return (
    <div className="container-x py-8 sm:py-12">
      <header className="mb-8">
        <p className="eyebrow">The collection</p>
        <h1 className="heading-display mt-1 text-4xl sm:text-5xl">Shop Handmade</h1>
      </header>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listing({ searchParams }: Props) {
  const q = pickQuery(await searchParams);
  // Old "New Arrivals" link: the new arrivals page lists the photographed catalogue.
  if (q.new && Object.entries(q).every(([k, v]) => k === "new" || !v)) redirect("/new-arrivals");
  // Best sellers / featured / offers are backend flags on priced API products – keep that
  // listing (with its prices) but hide the old API category names from the sidebar.
  if (q.best_seller || q.featured || q.on_sale) return <ShopListing query={{ ...q, category: undefined }} basePath="/shop" hideCategories />;
  // Shop All: the photographed catalogue, filtered by its real collections.
  return <CatalogListing query={q} basePath="/shop" />;
}
