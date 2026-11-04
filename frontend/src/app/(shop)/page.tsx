import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Gift, HandHeart, MessageCircle, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { getHome, getSettings } from "@/lib/api";
import CategoryCircles from "@/components/home/CategoryCircles";
import GalleryGrid from "@/components/home/GalleryGrid";
import HeroCarousel from "@/components/home/HeroCarousel";
import HomeHero from "@/components/home/HomeHero";
import Section from "@/components/home/Section";
import FeatureCollection from "@/components/collections/FeatureCollection";
import HandmadeCategoryGrid from "@/components/collections/HandmadeCategoryGrid";
import SignatureCollections from "@/components/collections/SignatureCollections";
import ProductGrid from "@/components/shop/ProductGrid";
import RecentlyViewed from "@/components/shop/RecentlyViewed";
import { CatalogProductGrid } from "@/components/shop/CatalogProductCard";
import { HANDMADE_SLUG, collectionHref } from "@/lib/collections";
import { countDesigns, getCollection } from "@/lib/collections.server";
import { getCatalog, getNewArrivalHighlights, imageAlt } from "@/lib/catalog";
import { HOME_IMAGES } from "@/lib/home-content";

/**
 * Homepage. Sections built from the photo collections in public/images are static
 * (prerendered, no API needed); catalogue sections stream in from the API.
 */
export default function HomePage() {
  const jhumka = getCollection("silk-thread-jhumka");
  const bangles = getCollection("bangles");

  return (
    <>
      <HomeHero />

      <Section eyebrow="Signature collections" title="Shop by Collection" subtitle="Hand-wound, hand-stitched, made for you." align="center" href="/collections" linkLabel="View all collections">
        <SignatureCollections />
      </Section>

      <Suspense fallback={<HomeSkeleton />}>
        <CatalogTop />
      </Suspense>

      {jhumka && (
        <FeatureCollection
          eyebrow="Silk thread jhumka collection"
          title="Jhumkas that sway with every step"
          description={jhumka.description}
          highlights={["Lightweight – comfortable all day", "Colour-matched to your outfit on request", "Pearl, kundan & stone-studded tops"]}
          href={jhumka.href}
          count={countDesigns(jhumka)}
          main={HOME_IMAGES.jhumka.main}
          thumbs={HOME_IMAGES.jhumka.thumbs}
        />
      )}

      <Section eyebrow="Handmade jewellery collection" title="Handmade Accessories" subtitle="Bridal jasmine, hair pins, gifting & everyday pieces." align="center" href={collectionHref(HANDMADE_SLUG)} linkLabel="Explore all handmade accessories">
        <HandmadeCategoryGrid />
      </Section>

      {bangles && (
        <FeatureCollection
          eyebrow="Silk thread bangle collection"
          title="Bangles, wrapped by hand"
          description={bangles.description}
          highlights={["Kundan, pearl & mirror-work finishes", "Made in your size and colours", "Perfect for weddings & festive sets"]}
          href={bangles.href}
          count={countDesigns(bangles)}
          main={HOME_IMAGES.bangles.main}
          thumbs={HOME_IMAGES.bangles.thumbs}
          reverse
          tone="cream"
        />
      )}

      <NewArrivals />

      <Suspense fallback={null}>
        <CatalogBottom />
      </Suspense>

      <CustomOrders />

      <Suspense fallback={null}>
        <TrustAndGallery />
      </Suspense>

      <RecentlyViewed />

      <section className="container-x mt-16">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-cream px-6 py-10 text-center" data-reveal>
          <Gift className="h-8 w-8 text-gold" strokeWidth={1.5} />
          <p className="heading-display text-2xl sm:text-3xl">Gifting someone special?</p>
          <p className="max-w-md text-sm text-muted">Add a note in your WhatsApp order and we will gift-wrap it with love.</p>
          <Link href="/categories/gift-collections" className="btn-primary mt-2">Shop Gift Collections</Link>
        </div>
      </section>
    </>
  );
}

/** API catalogue: bead & charm collections, categories and featured products. */
async function CatalogTop() {
  const home = await getHome();
  const general = home.categories.filter((c) => !c.section);
  const beads = home.categories.filter((c) => c.section === "beads");
  const charms = home.categories.filter((c) => c.section === "charms");

  return (
    <>
      {beads.length > 0 && (
        <Section title="Trendset Beads Collection" subtitle="Set the trend with every bead." align="center">
          <CategoryCircles categories={beads} variant="double" />
        </Section>
      )}

      {charms.length > 0 && (
        <Section title="Signature Charms Hub" subtitle="Your go-to place for iconic charms." align="center">
          <CategoryCircles categories={charms} variant="gold" />
        </Section>
      )}

      {general.length > 0 && (
        <Section eyebrow="Explore" title="Shop by Category" href="/shop">
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
            {general.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className="group w-28 shrink-0 snap-start text-center sm:w-auto">
                <div className="relative mx-auto aspect-square overflow-hidden rounded-full border border-line bg-cream">
                  {c.image_url && <Image src={c.image_url} alt={c.name} fill sizes="140px" className="object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <p className="mt-3 text-[13px] leading-tight text-ink/85 group-hover:text-gold-dark">{c.name}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {home.featured.length > 0 && (
        <Section eyebrow="Curated for you" title="Featured Pieces" href="/shop?featured=1">
          <ProductGrid products={home.featured} />
        </Section>
      )}
    </>
  );
}

/** Latest photographed products (src/data/products.json) – one per collection in turn. */
function NewArrivals() {
  const items = getNewArrivalHighlights(8);
  if (items.length === 0) return null;
  return (
    <Section eyebrow="Just in" title="New Arrivals" href="/new-arrivals" linkLabel="View all new arrivals">
      <CatalogProductGrid products={items} />
    </Section>
  );
}

/** API catalogue: admin banners (as a promo strip), best sellers, offers. */
async function CatalogBottom() {
  const [home, s] = await Promise.all([getHome(), getSettings()]);

  return (
    <>
      {home.banners.length > 0 && (
        <HeroCarousel compact banners={home.banners} fallback={{ title: s.tagline || "Handmade With Love", subtitle: s.hero_description }} />
      )}

      {home.best_sellers.length > 0 && (
        <Section eyebrow="Loved by customers" title="Best Sellers" href="/shop?best_seller=1">
          <ProductGrid products={home.best_sellers.slice(0, 4)} />
        </Section>
      )}

      {home.special_offers.length > 0 && (
        <Section eyebrow="Limited time" title="Special Offers" href="/shop?on_sale=1">
          <ProductGrid products={home.special_offers.slice(0, 4)} />
        </Section>
      )}
    </>
  );
}

/** Real product photos for the gallery when no Instagram images are set: the newest product of each collection. */
function galleryFallback() {
  const seen = new Set<string>();
  return [...getCatalog()]
    .filter((p) => p.photographedAt && !p.homepageBanner)
    .sort((a, b) => b.photographedAt!.localeCompare(a.photographedAt!))
    .filter((p) => !seen.has(p.collection) && seen.add(p.collection))
    .slice(0, 12)
    .map((p) => ({ src: p.image, alt: imageAlt(p), link: p.href }));
}

/** Settings-driven sections: promise, testimonials and the Instagram gallery. */
async function TrustAndGallery() {
  const s = await getSettings();
  const gallery = s.instagram_images.length > 0
    ? s.instagram_images.slice(0, 12).map((img, i) => ({ src: img.image_url, alt: `Acrylic beads jewellery ${i + 1}`, link: img.link }))
    : galleryFallback();

  return (
    <>
      {/* Why choose us */}
      <Section eyebrow="Our promise" title="Why Choose Us">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { icon: HandHeart, t: "100% Handmade", d: "Every piece is crafted by hand in small batches." },
            { icon: ShieldCheck, t: "Skin-friendly", d: "Nickel-safe materials and quality plating." },
            { icon: Truck, t: "Pan-India Delivery", d: s.free_shipping_threshold ? `Free shipping above ₹${Number(s.free_shipping_threshold).toLocaleString("en-IN")}.` : "Delivered across India." },
            { icon: MessageCircle, t: "Easy WhatsApp Ordering", d: "Chat directly with the maker – no sign-up needed." },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="card p-5 sm:p-6" data-reveal style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}>
              <Icon className="h-7 w-7 text-gold" strokeWidth={1.5} />
              <p className="mt-4 font-medium">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      {s.testimonials.length > 0 && (
        <Section eyebrow="Kind words" title="What Our Customers Say">
          <div className="grid gap-4 md:grid-cols-3">
            {s.testimonials.map((t, i) => (
              <figure key={i} className="card p-6" data-reveal style={{ "--reveal-delay": `${i * 110}ms` } as React.CSSProperties}>
                <div className="flex gap-0.5 text-gold">
                  {Array.from({ length: t.rating ?? 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}
                </div>
                <blockquote className="mt-4 text-[15px] leading-relaxed text-ink/85">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm text-muted">— {t.name}{t.location ? `, ${t.location}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* Acrylic Beads Gallery – images managed in Admin → Settings → Instagram images */}
      {gallery.length > 0 && (
        <Section title="Acrylic Beads Gallery" subtitle="Handmade pieces, fresh from our studio." align="center" href={s.instagram_url ?? undefined} linkLabel="Follow us on Instagram">
          <GalleryGrid items={gallery} instagramUrl={s.instagram_url} />
        </Section>
      )}
    </>
  );
}

/** Custom orders promo, illustrated with real custom work (return gifts & bridal jasmine). */
function CustomOrders() {
  const [a, b] = HOME_IMAGES.customOrder;
  return (
    <section className="container-x mt-16 sm:mt-24">
      <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-ivory sm:px-12 lg:grid-cols-[1.2fr_1fr] lg:py-14">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sand" data-reveal>Made just for you</p>
          <h2 className="heading-display mt-2 text-4xl text-ivory sm:text-5xl" data-reveal style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>Custom Handmade Orders</h2>
          <p className="mt-4 max-w-lg text-ivory/75" data-reveal style={{ "--reveal-delay": "200ms" } as React.CSSProperties}>Name bracelets, matching sets for the bridal party, return gifts or a piece in your favourite colours – tell us your idea and we will handcraft it for you.</p>
          <ul className="mt-7 grid grid-cols-2 gap-3 text-sm" data-reveal style={{ "--reveal-delay": "300ms" } as React.CSSProperties}>
            {["Name & initial bracelets", "Bridesmaid gift sets", "Rakhi & festive hampers", "Colour-matched jewellery"].map((t) => (
              <li key={t} className="rounded-2xl border border-ivory/15 p-4 text-ivory/85">{t}</li>
            ))}
          </ul>
          <Link href="/custom-order" className="btn-gold mt-8 px-7 py-3"><Sparkles className="h-4 w-4" /> Request a Custom Piece</Link>
        </div>
        <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4" data-reveal="zoom">
          <div className="relative mt-10 aspect-[3/4] overflow-hidden rounded-t-full rounded-b-3xl ring-1 ring-ivory/15">
            <Image src={a.src} alt={a.alt} fill sizes="(min-width:1024px) 220px, 44vw" className="object-cover" />
          </div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-3xl ring-1 ring-ivory/15">
            <Image src={b.src} alt={b.alt} fill sizes="(min-width:1024px) 220px, 44vw" className="object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="container-x mt-16 animate-pulse sm:mt-20">
      <div className="mx-auto h-9 w-64 rounded-full bg-cream" />
      <div className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-cream" />)}
      </div>
    </div>
  );
}
