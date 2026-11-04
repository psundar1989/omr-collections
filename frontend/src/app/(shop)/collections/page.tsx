import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/home/Section";
import SignatureCollections from "@/components/collections/SignatureCollections";
import HandmadeCategoryGrid from "@/components/collections/HandmadeCategoryGrid";

export const metadata: Metadata = {
  title: "Collections",
  description: "Explore handmade silk thread jhumkas, silk thread bangles and handmade accessories – jasmine hair accessories, headbands, U pins, brooches, rings and more.",
  alternates: { canonical: "/collections" },
};

export default function CollectionsPage() {
  return (
    <div className="pb-4">
      <header className="container-x pt-8 text-center sm:pt-12">
        <nav className="mb-6 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gold-dark">Home</Link> / <span className="text-ink">Collections</span>
        </nav>
        <p className="eyebrow animate-fade-up">Handmade in small batches</p>
        <h1 className="heading-display animate-fade-up mt-3 text-5xl text-brown [animation-delay:100ms] sm:text-6xl">Our Collections</h1>
        <p className="animate-fade-up mx-auto mt-4 max-w-xl text-muted [animation-delay:200ms]">
          Every design below is photographed from our studio. Tap any piece to see it closer and enquire on WhatsApp.
        </p>
      </header>

      <section className="container-x mt-12">
        <SignatureCollections />
      </section>

      <Section id="handmade" title="Handmade Accessories" subtitle="Hair accessories, gifting and everyday pieces." align="center">
        <HandmadeCategoryGrid />
      </Section>
    </div>
  );
}
