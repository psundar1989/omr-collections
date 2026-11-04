import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCategory } from "@/lib/api";
import ShopListing, { ListingSkeleton, pickQuery } from "@/components/shop/ShopListing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) return { title: "Category not found" };
  return {
    title: c.name,
    description: c.description ?? `Shop handmade ${c.name.toLowerCase()} online. Order on WhatsApp with delivery across India.`,
    alternates: { canonical: `/categories/${c.slug}` },
    openGraph: { title: c.name, images: c.image_url ? [c.image_url] : undefined },
  };
}

export default function CategoryPage(props: Props) {
  return (
    <div className="container-x py-8 sm:py-12">
      <Suspense fallback={<ListingSkeleton />}>
        <CategoryContent {...props} />
      </Suspense>
    </div>
  );
}

async function CategoryContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const query = pickQuery(await searchParams);

  return (
    <>
      <nav className="mb-4 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gold-dark">Home</Link> / <Link href="/shop" className="hover:text-gold-dark">Shop</Link> / <span className="text-ink">{category.name}</span>
      </nav>
      <header className="mb-8">
        <h1 className="heading-display text-4xl sm:text-5xl">{category.name}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-muted">{category.description}</p>}
      </header>
      <ShopListing query={query} basePath={`/categories/${category.slug}`} lockedCategory={category.slug} />
    </>
  );
}
