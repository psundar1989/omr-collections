import { HANDMADE_SLUG, collectionHref, type CollectionImage } from "./collections";
import { imageAlt, requireProduct, type CatalogItem } from "./catalog";

/**
 * Hand-picked homepage imagery, referenced by catalogue product slug so names always
 * match the product pages. Each photo is used once on the homepage – no section repeats
 * another section's image. A stale slug fails the build (see requireProduct).
 */
function pick(slug: string): CollectionImage & { href: string; product: CatalogItem } {
  const p = requireProduct(slug);
  return { src: p.image, alt: imageAlt(p), file: p.image.split("/").pop()!, href: p.href, product: p };
}

export type HomeSlide = {
  product: CatalogItem;
  image: CollectionImage;
  eyebrow: string;
  headline: string;
  /** Emphasised (italic, rose-gold) end of the headline. */
  accent: string;
  text: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

function slide(slug: string, s: Omit<HomeSlide, "product" | "image" | "secondary"> & { secondary?: HomeSlide["secondary"] }): HomeSlide {
  const im = pick(slug);
  return { ...s, product: im.product, image: im, secondary: s.secondary ?? { label: "View this piece", href: im.product.href } };
}

/** Homepage carousel – one strong studio photo per slide, covering all three collection groups. */
export const HOME_SLIDES: HomeSlide[] = [
  slide("blush-pink-pearl-silk-thread-jhumka", {
    eyebrow: "Silk thread jhumka collection",
    headline: "Jhumkas woven by hand,",
    accent: "made to be treasured",
    text: "Hand-wound silk thread jhumkas finished with pearls and kundan – colour-matched to your saree or lehenga.",
    primary: { label: "Shop Jhumkas", href: collectionHref("silk-thread-jhumka") },
  }),
  slide("blue-and-ruby-kundan-silk-thread-bangle-set", {
    eyebrow: "Silk thread bangle collection",
    headline: "Bangles wrapped by hand,",
    accent: "set with kundan",
    text: "Stackable silk thread bangles with kundan, pearl and mirror work – made in your size and colours.",
    primary: { label: "Shop Bangles", href: collectionHref("bangles") },
  }),
  slide("kemp-stone-surya-jasmine-bun-design-3", {
    eyebrow: "Handmade jewellery collection",
    headline: "Bridal jasmine that",
    accent: "stays fresh all day",
    text: "Everlasting jasmine buns with kemp-stone centres for weddings, Bharatanatyam and festive looks.",
    primary: { label: "Shop Jasmine Accessories", href: collectionHref("jasmine-hair-accessories") },
  }),
  slide("emerald-green-swirl-stud-silk-thread-jhumka", {
    eyebrow: "Festive silk thread jhumkas",
    headline: "Rich jewel tones for",
    accent: "every celebration",
    text: "Emerald, ruby, royal blue and more – lightweight jhumkas you can wear from morning pooja to evening reception.",
    primary: { label: "Explore Jhumkas", href: collectionHref("silk-thread-jhumka") },
  }),
  slide("emerald-three-stone-paisley-ring", {
    eyebrow: "Handmade accessories",
    headline: "Little luxuries,",
    accent: "handcrafted for you",
    text: "Rings, invisible chains, hair accessories and return gifts – finished by hand in small batches.",
    primary: { label: "Shop Handmade Accessories", href: collectionHref(HANDMADE_SLUG) },
  }),
];

export const HOME_IMAGES = {
  jhumka: {
    main: pick("ruby-red-star-stud-silk-thread-jhumka"),
    thumbs: [
      pick("orange-and-pink-kundan-silk-thread-jhumka"),
      pick("sky-blue-swirl-stud-silk-thread-jhumka"),
      pick("golden-yellow-and-green-kundan-silk-thread-jhumka"),
      pick("hot-pink-star-stud-silk-thread-jhumka"),
    ],
  },
  bangles: {
    main: pick("ruby-and-green-kundan-bangle-pair"),
    thumbs: [
      pick("navy-lotus-kundan-silk-thread-bangle-pair"),
      pick("lime-green-kundan-flower-silk-thread-bangle-pair"),
      pick("yellow-gold-flower-silk-thread-bangle-pair"),
      pick("lilac-purple-flower-silk-thread-bangle-pair"),
      pick("red-gold-flower-silk-thread-bangle-pair"),
      pick("magenta-and-gold-kundan-silk-thread-bangle-set"),
    ],
  },
  signatureHandmadeCover: pick("kemp-stone-surya-jasmine-bun-design-2"),
  customOrder: [
    pick("baby-shower-red-saree-haldi-kumkum-return-gift-set"),
    pick("kemp-stone-bridal-jasmine-bun"),
  ],
};
