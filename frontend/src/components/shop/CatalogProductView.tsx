import Link from "next/link";
import { BadgeCheck, Hash, Layers, MessageCircle, Sparkles, Tag, Truck } from "lucide-react";
import { SITE_URL } from "@/lib/config";
import { whatsappLink } from "@/lib/format";
import { getRelatedProducts, imageAlt, type CatalogItem } from "@/lib/catalog";
import { catalogReviewKey } from "@/lib/reviews";
import type { Settings } from "@/lib/types";
import Gallery from "./Gallery";
import WishlistButton from "./WishlistButton";
import { CatalogProductGrid } from "./CatalogProductCard";
import ProductReviews from "./ProductReviews";
import { WhatsAppIcon } from "@/components/ui/Icons";

/** Detail page for a photographed catalogue product. No price is stored – enquire on WhatsApp. */
export default function CatalogProductView({ product: p, settings: s }: { product: CatalogItem; settings: Settings | null }) {
  const url = `${SITE_URL}${p.href}`;
  const images = p.images.map((src, i) => ({ id: i, url: src, alt_text: imageAlt(p, i), is_primary: i === 0, sort_order: i }));
  const enquiry = s?.whatsapp_number
    ? whatsappLink(s.whatsapp_number, `Hello! I'm interested in ${p.name} (${p.collectionName}, code ${p.id}). Could you share the price and availability?\n${url}`)
    : null;
  const related = getRelatedProducts(p, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.id,
    image: p.images.map((src) => `${SITE_URL}${src}`),
    category: p.category,
    brand: s ? { "@type": "Brand", name: s.business_name } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x py-6 sm:py-10">
        <nav className="mb-5 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gold-dark">Home</Link> / <Link href="/shop" className="hover:text-gold-dark">Shop</Link>
          {" "}/ <Link href={`/shop?category=${p.collection}`} className="hover:text-gold-dark">{p.collectionName}</Link> / <span className="text-ink">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <Gallery images={images} name={p.name} />

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow"><Link href={p.collectionHref} className="hover:text-gold-dark">{p.collectionName}</Link></p>
                <h1 className="heading-display mt-1 text-4xl leading-tight text-brown sm:text-5xl">{p.name}</h1>
              </div>
              <WishlistButton catalogId={p.id} className="mt-2 shrink-0 border border-line" />
            </div>
            {p.isNewArrival && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-gold-dark">New Arrival</span>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-line bg-white p-5">
              <p className="text-sm text-muted">Price on request</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/80">
                Each piece is handmade, and colours and sizes can be matched to your outfit. Message us on WhatsApp for the price and availability of this design.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {enquiry && (
                  <a href={enquiry} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-6 py-3">
                    <WhatsAppIcon className="h-4 w-4" /> Enquire on WhatsApp
                  </a>
                )}
                <Link href="/custom-order" className="btn-outline px-6 py-3"><Sparkles className="h-4 w-4 text-gold" /> Request a custom piece</Link>
              </div>
            </div>

            {s?.order_disclaimer && (
              <p className="mt-4 rounded-xl bg-cream/70 px-4 py-3 text-xs leading-relaxed text-muted">
                <MessageCircle className="mr-1 inline h-3.5 w-3.5" /> {s.order_disclaimer}
              </p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <Detail icon={Hash} label="Product code" value={p.id} />
              <Detail icon={Layers} label="Collection" value={p.collectionName} />
              <Detail icon={Tag} label="Price" value="On request" />
              <Detail icon={Truck} label="Delivery" value="Across India" />
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Look at this handmade piece${s ? ` from ${s.business_name}` : ""}: ${p.name}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <WhatsAppIcon className="h-4 w-4 text-whatsapp" /> Share on WhatsApp
              </a>
              <Link href={p.collectionHref} className="btn-outline">More from {p.collectionName}</Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted"><BadgeCheck className="h-4 w-4 text-gold" /> Handmade – slight variations make each piece unique.</p>
          </div>
        </div>
      </div>

      <ProductReviews reviewKey={catalogReviewKey(p.id)} productName={p.name} whatsappNumber={s?.whatsapp_number} />

      {related.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="heading-display mb-6 text-3xl">You may also like</h2>
          <CatalogProductGrid products={related} />
        </section>
      )}
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
