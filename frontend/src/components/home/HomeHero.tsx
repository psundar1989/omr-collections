import { HOME_SLIDES } from "@/lib/home-content";
import HomeCarousel, { type CarouselSlide } from "./HomeCarousel";

/**
 * Homepage hero: a carousel of real product photos (see HOME_SLIDES in lib/home-content.ts).
 * Static – the slide data is resolved at build time from the product catalogue, so the
 * product names on the slides always match the product pages.
 */
export default function HomeHero() {
  const slides: CarouselSlide[] = HOME_SLIDES.map((s) => ({
    key: s.product.id,
    eyebrow: s.eyebrow,
    headline: s.headline,
    accent: s.accent,
    text: s.text,
    image: { src: s.image.src, alt: s.image.alt },
    productName: s.product.name,
    productHref: s.product.href,
    collectionName: s.product.collectionName,
    primary: s.primary,
    secondary: s.secondary,
  }));
  return <HomeCarousel slides={slides} />;
}
