import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { getSettings } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { HANDMADE_SLUG, type Collection, type CollectionImage } from "@/lib/collections";
import { countDesigns, getAllCollections, getCollection, getCollectionGallery, getHandmadeCategories, getSignatureCollections, type GalleryItem } from "@/lib/collections.server";
import { HOME_IMAGES } from "@/lib/home-content";
import CollectionGallery from "@/components/collections/CollectionGallery";
import HandmadeCategoryGrid from "@/components/collections/HandmadeCategoryGrid";
import Section from "@/components/home/Section";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [{ slug: HANDMADE_SLUG }, ...getAllCollections().map((c) => ({ slug: c.slug }))];
}

const HANDMADE_GROUP = {
  name: "Handmade Accessories",
  description: "Jasmine hair accessories, headbands, U pins, alligator clips, brooch pins, rings, invisible chains, keychains and haldi kumkum return gifts – all handmade in small batches.",
  cover: HOME_IMAGES.signatureHandmadeCover as CollectionImage,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug === HANDMADE_SLUG) {
    return { title: HANDMADE_GROUP.name, description: HANDMADE_GROUP.description, alternates: { canonical: `/collections/${slug}` }, openGraph: { title: HANDMADE_GROUP.name, images: [HANDMADE_GROUP.cover.src] } };
  }
  const c = getCollection(slug);
  if (!c) return { title: "Collection not found" };
  return {
    title: c.name,
    description: c.description,
    alternates: { canonical: c.href },
    openGraph: { title: c.name, description: c.description, images: [c.cover.src] },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;

  if (slug === HANDMADE_SLUG) {
    return (
      <>
        <CollectionHeader name={HANDMADE_GROUP.name} description={HANDMADE_GROUP.description} cover={HANDMADE_GROUP.cover}
          meta={`${getHandmadeCategories().length} categories`} />
        <section className="container-x mt-12">
          <HandmadeCategoryGrid />
        </section>
        <Related items={getSignatureCollections()} />
      </>
    );
  }

  const c = getCollection(slug);
  if (!c) notFound();
  const images = getCollectionGallery(c);
  const siblings = c.group === "handmade" ? getHandmadeCategories() : getSignatureCollections();

  return (
    <>
      <CollectionHeader
        name={c.name}
        description={c.description}
        cover={c.cover}
        meta={`${images.length} handmade designs`}
        parent={c.group === "handmade" ? { name: "Handmade Accessories", href: `/collections/${HANDMADE_SLUG}` } : undefined}
      />
      <section className="container-x mt-12" aria-label={`${c.name} designs`}>
        {/* The static grid ships in the prerendered shell; the WhatsApp enquiry buttons stream in once settings load. */}
        <Suspense fallback={<CollectionGallery images={images} collectionName={c.name} itemLabel={c.itemLabel} />}>
          <GalleryWithEnquiry collection={c} images={images} />
        </Suspense>
      </section>
      <Related items={siblings.filter((s) => s.slug !== c.slug)} />
    </>
  );
}

async function GalleryWithEnquiry({ collection, images }: { collection: Collection; images: GalleryItem[] }) {
  const s = await getSettings().catch(() => null);
  return <CollectionGallery images={images} collectionName={collection.name} itemLabel={collection.itemLabel} whatsappNumber={s?.whatsapp_number} siteUrl={SITE_URL} />;
}

function CollectionHeader({ name, description, cover, meta, parent }: { name: string; description: string; cover: CollectionImage; meta: string; parent?: { name: string; href: string } }) {
  return (
    <header className="container-x pt-6 sm:pt-10">
      <nav className="mb-6 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gold-dark">Home</Link> / <Link href="/collections" className="hover:text-gold-dark">Collections</Link>
        {parent && <> / <Link href={parent.href} className="hover:text-gold-dark">{parent.name}</Link></>} / <span className="text-ink">{name}</span>
      </nav>
      <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-linear-to-br from-ivory via-cream to-blush px-6 py-10 ring-1 ring-line sm:px-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow animate-fade-up">{meta}</p>
          <h1 className="heading-display animate-fade-up mt-3 text-5xl leading-[1.05] text-brown [animation-delay:100ms] sm:text-6xl">{name}</h1>
          <p className="animate-fade-up mt-5 max-w-lg leading-relaxed text-ink/70 [animation-delay:200ms]">{description}</p>
          <div className="animate-fade-up mt-7 flex flex-wrap gap-3 [animation-delay:300ms]">
            <Link href="/custom-order" className="btn-primary px-6 py-3">Request a Custom Piece</Link>
            <Link href="/collections" className="btn-outline px-6 py-3">All Collections</Link>
          </div>
        </div>
        <div className="animate-soft-zoom relative mx-auto aspect-[4/5] w-full max-w-[16rem] overflow-hidden rounded-t-full rounded-b-3xl bg-cream shadow-[0_30px_60px_-35px_rgba(74,46,31,0.6)] md:max-w-[18rem]">
          <Image src={cover.src} alt={cover.alt} fill preload sizes="288px" className="object-cover" />
        </div>
      </div>
    </header>
  );
}

function Related({ items }: { items: Collection[] }) {
  if (items.length === 0) return null;
  return (
    <Section eyebrow="Keep exploring" title="More Collections" href="/collections" linkLabel="All collections">
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        {items.slice(0, 4).map((r) => (
          <Link key={r.slug} href={r.href} className="group w-44 shrink-0 snap-start sm:w-auto" data-reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream ring-1 ring-line">
              <Image src={r.cover.src} alt={r.cover.alt} fill sizes="(min-width:640px) 25vw, 176px" className="object-cover transition duration-700 group-hover:scale-105" />
            </div>
            <p className="mt-3 flex items-center gap-1 font-display text-lg text-brown group-hover:text-gold-dark">{r.name} <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></p>
            <p className="text-xs text-muted">{countDesigns(r)} designs</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
