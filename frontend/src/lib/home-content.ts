import { HANDMADE_SLUG, collectionHref, type CollectionImage } from "./collections";
import { getProductByImage, imageAlt, requireProduct, type CatalogItem } from "./catalog";

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

/** A specific product photo (e.g. one colour of a bracelet), named after its product. Fails the build if the file is not in products.json. */
function photo(src: string): CollectionImage & { href: string } {
  const p = getProductByImage(src);
  if (!p) throw new Error(`Unknown catalogue photo "${src}" – check src/data/products.json`);
  return { src, alt: `${p.name} – ${p.collectionName}`, file: src.split("/").pop()!, href: p.href };
}

/**
 * Real product photos for the "Shop by Category" circles, keyed by category slug. They replace the
 * generated bead-ring artwork the demo seeder stored for these categories; an image uploaded for the
 * category in the admin still takes precedence (see categoryCirclePhoto).
 */
export const CATEGORY_PHOTOS: Record<string, CollectionImage & { href: string }> = {
  "handmade-bracelets": photo("/images/handmade/bracelets/evil-eye-bead-bracelet-red-white.jpg"),
  "beaded-bracelets": photo("/images/handmade/bracelets/crackle-glass-bead-bracelet-with-gold-spacers-pink.jpg"),
  "gold-plated-jewellery": photo("/images/handmade/traditional-earrings/antique-gold-mango-ruby-emerald-jhumka.jpg"),
  necklaces: photo("/images/handmade/invisible-chains/red-lotus-pearl-invisible-chain.jpg"),
  earrings: photo("/images/handmade/traditional-earrings/ruby-emerald-pearl-chandbali-earrings.png"),
  "handmade-accessories": photo("/images/handmade/alligator-clips/iridescent-pink-petal-red-rose-alligator-clip.jpg"),
  "gift-collections": photo("/images/handmade/haldi-kumkum-sets/assorted-haldi-kumkum-return-gift-collection.jpg"),
  "customised-products": photo("/images/handmade/bracelets/personalised-name-bead-bracelet-baby-pink.jpg"),
};

/**
 * Image for a category circle: the admin-uploaded image if there is one, otherwise the real product
 * photo above. The demo seeder's generated artwork (stored as categories/<slug>.jpg) counts as "none".
 */
export function categoryCirclePhoto(c: { slug: string; image_url: string | null }): string | null {
  const real = CATEGORY_PHOTOS[c.slug]?.src;
  const seeded = !c.image_url || c.image_url.split("?")[0].endsWith(`/categories/${c.slug}.jpg`);
  return seeded && real ? real : c.image_url;
}

/**
 * Real photographed products that fill "Featured Pieces" after the products featured in the admin
 * (none of these photos appears elsewhere on the homepage). Validated at build time.
 */
export const FEATURED_PICKS: string[] = [
  "bottle-green-pearl-and-kundan-silk-thread-jhumka",
  "royal-blue-and-gold-kundan-silk-thread-bangle-pair",
  "green-kundan-jasmine-hair-flower-design-2",
  "pink-and-green-lotus-ring",
  "lilac-silk-thread-jhumka-with-purple-stone-stud",
  "purple-kundan-stone-silk-thread-bangle-set",
  "kundan-flower-crystal-hairband",
  "champagne-heart-and-green-kundan-brooch-pin",
].map((slug) => requireProduct(slug).slug);
