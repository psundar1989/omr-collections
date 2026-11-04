import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Gem, Hash, MessageCircle, Package, Truck } from "lucide-react";
import { getProduct, getSettings } from "@/lib/api";
import { getCatalogProduct, imageAlt } from "@/lib/catalog";
import { apiReviewKey } from "@/lib/reviews";
import { SITE_URL } from "@/lib/config";
import { formatPrice, whatsappLink } from "@/lib/format";
import CatalogProductView from "@/components/shop/CatalogProductView";
import Gallery from "@/components/shop/Gallery";
import ProductGrid from "@/components/shop/ProductGrid";
import ProductReviews from "@/components/shop/ProductReviews";
import PurchasePanel from "@/components/shop/PurchasePanel";
import RecentlyViewed from "@/components/shop/RecentlyViewed";
import ViewTracker from "@/components/shop/ViewTracker";
import WishlistButton from "@/components/shop/WishlistButton";
import { WhatsAppIcon } from "@/components/ui/Icons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Photographed catalogue products (src/data/products.json) take precedence over API products.
  const c = getCatalogProduct(slug);
  if (c) {
    const description = `${c.name} from our ${c.collectionName} collection – handmade. Enquire on WhatsApp for price and availability.`;
    const images = c.images.slice(0, 4).map((url, i) => ({ url, alt: imageAlt(c, i) }));
    return {
      title: c.name,
      description,
      alternates: { canonical: c.href },
      openGraph: { title: c.name, description, type: "website", url: c.href, images },
      twitter: { card: "summary_large_image", title: c.name, description, images: images.map((i) => i.url) },
    };
  }
  const r = await getProduct(slug);
  if (!r) return { title: "Product not found", robots: { index: false } };
  const p = r.product;
  const description = p.meta_description || p.short_description || `${p.name} – handmade, ${formatPrice(p.price)}. Order on WhatsApp.`;
  const images = (p.images ?? []).slice(0, 4).map((i) => ({ url: i.url, alt: i.alt_text ?? p.name }));
  return {
    title: p.meta_title || p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description, type: "website", url: `/products/${p.slug}`, images },
    twitter: { card: "summary_large_image", title: p.name, description, images: images.map((i) => i.url) },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: Props) {
  const { slug } = await params;
  const catalogProduct = getCatalogProduct(slug);
  if (catalogProduct) return <CatalogProductView product={catalogProduct} settings={await getSettings().catch(() => null)} />;

  const [r, s] = await Promise.all([getProduct(slug), getSettings()]);
  if (!r) notFound();
  const { product: p, related } = r;
  const images = p.images?.length ? p.images : p.image_url ? [{ id: 0, url: p.image_url, alt_text: p.name, is_primary: true, sort_order: 0 }] : [];
  const url = `${SITE_URL}/products/${p.slug}`;
  const shareText = `Look at this handmade piece from ${s.business_name}: ${p.name} – ${formatPrice(p.price)}\n${url}`;
  const askText = `Hello! I have a question about ${p.name} (Code: ${p.sku}).\n${url}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description: p.short_description || p.description || undefined,
    image: images.map((i) => i.url),
    category: p.category?.name,
    material: p.material || undefined,
    brand: { "@type": "Brand", name: s.business_name },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: p.currency,
      price: p.price.toFixed(2),
      availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: s.business_name },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ViewTracker productId={p.id} />

      <div className="container-x py-6 sm:py-10">
        <nav className="mb-5 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gold-dark">Home</Link> / <Link href="/shop" className="hover:text-gold-dark">Shop</Link>
          {p.category && <> / <Link href={`/categories/${p.category.slug}`} className="hover:text-gold-dark">{p.category.name}</Link></>}
          {" "}/ <span className="text-ink">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <Gallery images={images} name={p.name} />

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                {p.category && <p className="eyebrow">{p.category.name}</p>}
                <h1 className="heading-display mt-1 text-4xl leading-tight sm:text-5xl">{p.name}</h1>
              </div>
              <WishlistButton productId={p.id} className="mt-2 shrink-0 border border-line" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.is_new_arrival && <span className="rounded-full bg-cream px-3 py-1 text-xs">New Arrival</span>}
              {p.is_best_seller && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-gold-dark">Best Seller</span>}
            </div>
            {p.short_description && <p className="mt-4 leading-relaxed text-ink/80">{p.short_description}</p>}
            {s.price_note && <p className="mt-2 text-xs text-muted">{s.price_note}</p>}

            <div className="mt-6 border-t border-line pt-6">
              <PurchasePanel product={p} />
            </div>

            <p className="mt-4 rounded-xl bg-cream/70 px-4 py-3 text-xs leading-relaxed text-muted">
              <MessageCircle className="mr-1 inline h-3.5 w-3.5" /> {s.order_disclaimer}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <Detail icon={Hash} label="Product code" value={p.sku} />
              {p.material && <Detail icon={Gem} label="Material" value={p.material} />}
              <Detail icon={Package} label="Availability" value={p.in_stock ? (p.stock_quantity != null ? `In stock (${p.stock_quantity})` : "Made to order") : "Out of stock"} />
              <Detail icon={Truck} label="Delivery" value="Across India" />
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <WhatsAppIcon className="h-4 w-4 text-whatsapp" /> Share on WhatsApp
              </a>
              <a href={whatsappLink(s.whatsapp_number, askText)} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle className="h-4 w-4" /> Ask a question
              </a>
            </div>

            {p.description && (
              <section className="mt-8 border-t border-line pt-6">
                <h2 className="heading-display text-2xl">Description</h2>
                <div className="mt-3 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{p.description}</div>
              </section>
            )}
            <p className="mt-6 flex items-center gap-2 text-xs text-muted"><BadgeCheck className="h-4 w-4 text-gold" /> Handmade – slight variations make each piece unique.</p>
          </div>
        </div>
      </div>

      <ProductReviews reviewKey={apiReviewKey(p.id)} productName={p.name} whatsappNumber={s.whatsapp_number} />

      {related.length > 0 && (
        <section className="container-x mt-12">
          <h2 className="heading-display mb-6 text-3xl">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
      <RecentlyViewed excludeId={p.id} />
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted"><Icon className="h-3.5 w-3.5" /> {label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-x grid animate-pulse gap-8 py-10 lg:grid-cols-2">
      <div className="aspect-square rounded-3xl bg-cream" />
      <div className="space-y-4">
        <div className="h-10 w-3/4 rounded bg-cream" />
        <div className="h-6 w-1/4 rounded bg-cream" />
        <div className="h-24 rounded bg-cream" />
      </div>
    </div>
  );
}
