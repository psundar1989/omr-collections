/**
 * Central mapping for the photo collections stored in `public/images/`.
 *
 * Products (names, categories, photos) live in `src/data/products.json` – see `catalog.ts`.
 *
 * Folder layout (rename history: docs/image-rename-manifest*.csv):
 *   public/images/<collection>/          → top-level collection (e.g. bangles)
 *   public/images/handmade/<collection>/ → handmade jewellery category (e.g. handmade/u-pins)
 * Folder names are the collection slugs. Photos are named after the product slug:
 *   <product-slug>.jpg, <product-slug>-2.jpg … and <product-slug>-<colour>.jpg for colour photos.
 *
 * A new folder is discovered automatically by `collections.server.ts` and gets a name
 * derived from the folder. Add an entry to `COLLECTION_META` below to set its name,
 * description and cover image, and add its products to products.json.
 *
 * This file is client-safe (no `fs`), so client components can import the helpers.
 */

export const IMAGE_ROOT = "/images";
export const HANDMADE_FOLDER = "handmade";
export const HANDMADE_SLUG = "handmade-jewellery";

export type CollectionImage = { src: string; alt: string; file: string };

export type Collection = {
  slug: string;
  name: string;
  /** Short line used on cards. */
  tagline: string;
  description: string;
  /** Folder relative to `public/images`. */
  folder: string;
  /** "handmade" for categories inside public/images/handmade, otherwise "signature". */
  group: "signature" | "handmade";
  cover: CollectionImage;
  /** Singular noun used for alt text and enquiry messages, e.g. "jhumka". */
  itemLabel: string;
  href: string;
};

type Meta = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  itemLabel: string;
  cover: string;
  /** Display order; lower first. Undefined sorts alphabetically after ordered ones. */
  order?: number;
};

/** Keyed by folder path relative to `public/images`. Covers are file names inside the folder. */
export const COLLECTION_META: Record<string, Meta> = {
  "silk-thread-jhumka": {
    slug: "silk-thread-jhumka",
    name: "Silk Thread Jhumka",
    tagline: "Hand-wound silk, pearl & kundan detailing",
    description: "Lightweight jhumkas hand-wound in silk thread and finished with pearls, stones and kundan studs – made to match your saree, lehenga or everyday kurti.",
    itemLabel: "jhumka",
    cover: "ivory-pearl-silk-thread-jhumka.png",
    order: 1,
  },
  bangles: {
    slug: "bangles",
    name: "Bangles",
    tagline: "Kundan, pearl & mirror-work bangle sets",
    description: "Silk thread bangles wrapped by hand and embellished with kundan stones, pearls and mirror work. Available in sets and custom colours to match your outfit.",
    itemLabel: "bangle set",
    cover: "ruby-and-emerald-kundan-silk-thread-bangle-set.jpg",
    order: 2,
  },
  [`${HANDMADE_FOLDER}/alligator-clips`]: {
    slug: "alligator-clips", name: "Alligator Clips", itemLabel: "alligator clip", cover: "peach-pink-petal-pearl-alligator-clip.jpg",
    tagline: "Rose, pearl & petal hair clips",
    description: "Pretty alligator clips with roses, pearls and translucent petals – perfect for little ones, festivals and everyday styling.",
  },
  [`${HANDMADE_FOLDER}/bracelets`]: {
    slug: "bracelets", name: "Bracelets", itemLabel: "bracelet", cover: "jade-bead-bracelet-with-gold-spacers-purple.jpg",
    tagline: "Evil-eye, crackle & jade bead bracelets",
    description: "Stretchable bead bracelets in jade, crackle glass and evil-eye designs, plus personalised name bracelets – pick your favourite colour.",
  },
  [`${HANDMADE_FOLDER}/brooch-pins`]: {
    slug: "brooch-pins", name: "Brooch Pins", itemLabel: "brooch pin", cover: "white-pearl-and-green-kundan-brooch-pin.jpg",
    tagline: "Saree pins with stones & pearls",
    description: "Kundan and pearl brooch pins to hold your saree pleats and dupatta in place, with a touch of sparkle.",
  },
  [`${HANDMADE_FOLDER}/centre-clips`]: {
    slug: "centre-clips", name: "Centre Clips", itemLabel: "centre clip", cover: "lily-flower-red-rose-centre-clip-pink.jpg",
    tagline: "Kundan, pearl & flower barrettes",
    description: "Gold-tone centre clips with kundan stones, pearls, petals and roses to hold a half-up style or finish a braid.",
  },
  [`${HANDMADE_FOLDER}/coin-alligator-clips`]: {
    slug: "coin-alligator-clips", name: "Coin Alligator Clips", itemLabel: "coin alligator clip", cover: "lakshmi-coin-alligator-clip-blue.jpg",
    tagline: "Temple coin hair clips",
    description: "Alligator clips layered with gold-tone temple coins and set with Lakshmi, peacock, lotus and kundan motifs – made for festive and bridal looks.",
  },
  [`${HANDMADE_FOLDER}/fabric-hair-accessories`]: {
    slug: "fabric-hair-accessories", name: "Fabric Hair Accessories", itemLabel: "fabric hair accessory", cover: "pearl-tulle-long-tail-hair-bow-blush-pink.jpg",
    tagline: "Tulle bows & satin scrunchie clips",
    description: "Soft tulle bows with pearl drops, tulle flower clips and satin scrunchie clips in pastel shades.",
  },
  [`${HANDMADE_FOLDER}/fancy-earrings`]: {
    slug: "fancy-earrings", name: "Fancy Earrings", itemLabel: "pair of earrings", cover: "tulip-bud-drop-earrings-mint-green.jpg",
    tagline: "Drops, hoops & huggie earrings",
    description: "Playful everyday earrings – tulip drops, cherries, seashells, pearl hearts and kundan danglers in many colours.",
  },
  [`${HANDMADE_FOLDER}/hairbands`]: {
    slug: "hairbands", name: "Hairbands", itemLabel: "hairband", cover: "lotus-petal-pearl-hairband-sky-blue.jpg",
    tagline: "Flower ponytail hairbands",
    description: "Elastic ponytail hairbands topped with roses, lotus petals, jasmine buds and kundan flowers.",
  },
  [`${HANDMADE_FOLDER}/haldi-kumkum-sets`]: {
    slug: "haldi-kumkum-sets", name: "Haldi Kumkum Sets", itemLabel: "haldi kumkum set", cover: "lotus-haldi-kumkum-return-gift-set.jpg",
    tagline: "Return gifts for poojas & functions",
    description: "Personalised haldi kumkum return-gift sets – lotus, Ganesha, baby-shower, wedding-couple and family designs, packed and ready to gift.",
  },
  [`${HANDMADE_FOLDER}/headbands`]: {
    slug: "headbands", name: "Headbands", itemLabel: "headband", cover: "white-rose-flower-crown-headband.jpg",
    tagline: "Floral crowns & kundan hairbands",
    description: "Floral crowns, bow bands and kundan hairbands for birthdays, weddings and festive dressing.",
  },
  [`${HANDMADE_FOLDER}/invisible-chains`]: {
    slug: "invisible-chains", name: "Invisible Chains", itemLabel: "invisible chain", cover: "crystal-star-pendant-invisible-chain.png",
    tagline: "Delicate floating-stone necklaces",
    description: "Minimal invisible-wire chains with floating stones, pearls and lotus pendants – light enough to wear every day.",
  },
  [`${HANDMADE_FOLDER}/jasmine-hair-accessories`]: {
    slug: "jasmine-hair-accessories", name: "Jasmine Hair Accessories", itemLabel: "jasmine hair accessory", cover: "kemp-stone-surya-jasmine-bun.jpg",
    tagline: "Everlasting jasmine for bridal hair",
    description: "Artificial jasmine buns, clips and kemp-stone jadai pieces that look fresh all day – loved for weddings, Bharatanatyam and festive looks.",
  },
  [`${HANDMADE_FOLDER}/keychains`]: {
    slug: "keychains", name: "Keychains", itemLabel: "keychain", cover: "red-crystal-butterfly-keychain.jpg",
    tagline: "Stone, bead & fluffy keychains",
    description: "Cute handmade keychains – stone flowers, bead grapes and fluffy shapes. A sweet little gift or return favour.",
  },
  [`${HANDMADE_FOLDER}/rakhis`]: {
    slug: "rakhis", name: "Rakhis", itemLabel: "rakhi", cover: "pink-lotus-pearl-rakhi.jpg",
    tagline: "Kundan & pearl rakhis",
    description: "Handmade rakhis with kundan flowers, pearls and lotus motifs on pearl and bead strings.",
  },
  [`${HANDMADE_FOLDER}/rings`]: {
    slug: "rings", name: "Rings", itemLabel: "ring", cover: "white-petal-flower-ring.png",
    tagline: "Kundan, pearl & enamel rings",
    description: "Gold-tone rings with kundan, pearl and enamel motifs for everyday elegance.",
  },
  [`${HANDMADE_FOLDER}/saree-pins`]: {
    slug: "saree-pins", name: "Saree Pins", itemLabel: "saree pin", cover: "kundan-star-silk-thread-saree-pin-green.jpg",
    tagline: "Silk thread & kundan saree pins",
    description: "Silk-thread-wrapped saree pins set with kundan stones to keep your pleats neat in style.",
  },
  [`${HANDMADE_FOLDER}/stud-earrings`]: {
    slug: "stud-earrings", name: "Stud Earrings", itemLabel: "pair of studs", cover: "swirl-flower-stud-earrings-emerald-green.jpg",
    tagline: "Kundan & swirl flower studs",
    description: "Small kundan and enamel swirl-flower studs in a rainbow of colours – easy to wear every day.",
  },
  [`${HANDMADE_FOLDER}/traditional-earrings`]: {
    slug: "traditional-earrings", name: "Traditional Earrings", itemLabel: "pair of earrings", cover: "teal-kundan-pearl-square-jhumka.jpg",
    tagline: "Antique gold jhumkas & chandbalis",
    description: "Antique gold jhumkas, kundan danglers and pearl chandbalis to complete a saree or lehenga.",
  },
  [`${HANDMADE_FOLDER}/u-pins`]: {
    slug: "u-pins", name: "U Pins", itemLabel: "U pin", cover: "pink-and-green-kundan-crystal-bun-u-pin.jpg",
    tagline: "Statement bun pins & juda pins",
    description: "Statement U pins and bun pins with kundan and pearl work to finish a bun or braid beautifully.",
  },
};

/** Encode each path segment – some filenames contain spaces and commas. */
export function imageSrc(folder: string, file: string): string {
  return `${IMAGE_ROOT}/${folder.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(file)}`;
}

export function img(folder: string, file: string, alt: string): CollectionImage {
  return { src: imageSrc(folder, file), alt, file };
}

export function titleFromFolder(folder: string): string {
  const base = folder.split("/").pop() ?? folder;
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugFromFolder(folder: string): string {
  return (folder.split("/").pop() ?? folder).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function collectionHref(slug: string): string {
  return `/collections/${slug}`;
}

/** Name and page of a photographed collection by its slug (e.g. "bangles"), or null. */
export function collectionBySlug(slug: string): { name: string; href: string } | null {
  const meta = Object.values(COLLECTION_META).find((m) => m.slug === slug);
  return meta ? { name: meta.name, href: collectionHref(meta.slug) } : null;
}
