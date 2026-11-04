/**
 * Central mapping for the photo collections stored in `public/images/`.
 *
 * Products (names, categories, photos) live in `src/data/products.json` – see `catalog.ts`.
 *
 * Folder layout (rename history: docs/image-rename-manifest*.csv):
 *   public/images/<collection>/                           → top-level collection (e.g. bangles)
 *   public/images/handmade_jewellerycollections/<folder>/ → handmade jewellery category
 *
 * A new folder is discovered automatically by `collections.server.ts` and gets a name
 * derived from the folder. Add an entry to `COLLECTION_META` below to set its name,
 * description and cover image, and add its products to products.json.
 *
 * This file is client-safe (no `fs`), so client components can import the helpers.
 */

export const IMAGE_ROOT = "/images";
export const HANDMADE_FOLDER = "handmade_jewellerycollections";
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
  /** "handmade" for categories inside handmade_jewellerycollections, otherwise "signature". */
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
  silk_thread_jhumka: {
    slug: "silk-thread-jhumka",
    name: "Silk Thread Jhumka",
    tagline: "Hand-wound silk, pearl & kundan detailing",
    description: "Lightweight jhumkas hand-wound in silk thread and finished with pearls, stones and kundan studs – made to match your saree, lehenga or everyday kurti.",
    itemLabel: "jhumka",
    cover: "ivory_pearl_silk_thread_jhumka_01.png",
    order: 1,
  },
  bangles: {
    slug: "bangles",
    name: "Bangles",
    tagline: "Kundan, pearl & mirror-work bangle sets",
    description: "Silk thread bangles wrapped by hand and embellished with kundan stones, pearls and mirror work. Available in sets and custom colours to match your outfit.",
    itemLabel: "bangle set",
    cover: "ruby_emerald_kundan_bangle_set_01.jpg",
    order: 2,
  },
  [`${HANDMADE_FOLDER}/alligator_clips`]: {
    slug: "alligator-clips", name: "Alligator Clips", itemLabel: "alligator clip", cover: "peach_pink_petal_pearl_alligator_clip_01.jpg",
    tagline: "Rose, pearl & petal hair clips",
    description: "Pretty alligator clips with roses, pearls and translucent petals – perfect for little ones, festivals and everyday styling.",
  },
  [`${HANDMADE_FOLDER}/brooch_pins`]: {
    slug: "brooch-pins", name: "Brooch Pins", itemLabel: "brooch pin", cover: "white_pearl_green_kundan_brooch_pin_01.jpg",
    tagline: "Saree pins with stones & pearls",
    description: "Kundan and pearl brooch pins to hold your saree pleats and dupatta in place, with a touch of sparkle.",
  },
  [`${HANDMADE_FOLDER}/haldi_kumkum_sets`]: {
    slug: "haldi-kumkum-sets", name: "Haldi Kumkum Sets", itemLabel: "haldi kumkum set", cover: "lotus_haldi_kumkum_set_01.jpg",
    tagline: "Return gifts for poojas & functions",
    description: "Personalised haldi kumkum return-gift sets – lotus, Ganesha, baby-shower, wedding-couple and family designs, packed and ready to gift.",
  },
  [`${HANDMADE_FOLDER}/headbands`]: {
    slug: "headbands", name: "Headbands", itemLabel: "headband", cover: "white_rose_flower_crown_headband_01.jpg",
    tagline: "Floral crowns & kundan hairbands",
    description: "Floral crowns, bow bands and kundan hairbands for birthdays, weddings and festive dressing.",
  },
  [`${HANDMADE_FOLDER}/invisible_chains`]: {
    slug: "invisible-chains", name: "Invisible Chains", itemLabel: "invisible chain", cover: "crystal_star_pendant_invisible_chain_01.png",
    tagline: "Delicate floating-stone necklaces",
    description: "Minimal invisible-wire chains with floating stones, pearls and lotus pendants – light enough to wear every day.",
  },
  [`${HANDMADE_FOLDER}/jasmine_hair_accessories`]: {
    slug: "jasmine-hair-accessories", name: "Jasmine Hair Accessories", itemLabel: "jasmine hair accessory", cover: "kemp_stone_surya_jasmine_bun_01.jpg",
    tagline: "Everlasting jasmine for bridal hair",
    description: "Artificial jasmine buns, clips and kemp-stone jadai pieces that look fresh all day – loved for weddings, Bharatanatyam and festive looks.",
  },
  [`${HANDMADE_FOLDER}/keychains`]: {
    slug: "keychains", name: "Keychains", itemLabel: "keychain", cover: "red_crystal_butterfly_keychain_01.jpg",
    tagline: "Stone, bead & fluffy keychains",
    description: "Cute handmade keychains – stone flowers, bead grapes and fluffy shapes. A sweet little gift or return favour.",
  },
  [`${HANDMADE_FOLDER}/rings`]: {
    slug: "rings", name: "Rings", itemLabel: "ring", cover: "white_petal_flower_ring_01.png",
    tagline: "Kundan, pearl & enamel rings",
    description: "Gold-tone rings with kundan, pearl and enamel motifs for everyday elegance.",
  },
  [`${HANDMADE_FOLDER}/u_pins`]: {
    slug: "u-pins", name: "U Pins", itemLabel: "U pin", cover: "pink_green_kundan_crystal_bun_u_pin_01.jpg",
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
