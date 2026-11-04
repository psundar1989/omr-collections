import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  COLLECTION_META, HANDMADE_FOLDER, collectionHref, img, imageSrc, slugFromFolder, titleFromFolder,
  type Collection, type CollectionImage,
} from "./collections";
import { getCollectionProducts, getProductByImage, imageAlt } from "./catalog";
import unlisted from "@/data/unlisted-images.json";

/**
 * Discovers collections from `public/images` at build/render time. Reads are synchronous,
 * so pages using them are fully prerendered. A new folder appears after the next build.
 */
const PUBLIC_IMAGES = path.join(process.cwd(), "public", "images");
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name);
}

/** Image files in a folder, natural filename order (locale-independent). */
function listImages(folder: string): string[] {
  const dir = path.join(PUBLIC_IMAGES, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
}

/**
 * Photos on disk that no catalogue product uses yet (newly added, not catalogued) – shown
 * after the catalogued products so a new photo is never hidden. Photos deliberately left
 * out of the catalogue are listed in src/data/unlisted-images.json.
 */
const UNLISTED = new Set<string>(unlisted.images);

function uncatalogued(folder: string): string[] {
  return listImages(folder).filter((f) => {
    const src = imageSrc(folder, f);
    return !UNLISTED.has(src) && !getProductByImage(src);
  });
}

function coverImage(folder: string, file: string, fallbackAlt: string): CollectionImage {
  const p = getProductByImage(imageSrc(folder, file));
  return img(folder, file, p ? imageAlt(p) : fallbackAlt);
}

function build(folder: string, group: Collection["group"]): Collection | null {
  const files = listImages(folder);
  if (files.length === 0) return null;
  const meta = COLLECTION_META[folder];
  const name = meta?.name ?? titleFromFolder(folder);
  const itemLabel = meta?.itemLabel ?? name.toLowerCase();
  const slug = meta?.slug ?? slugFromFolder(folder);
  const coverFile = meta?.cover && files.includes(meta.cover) ? meta.cover : files[0];
  return {
    slug,
    name,
    tagline: meta?.tagline ?? "Handmade designs",
    description: meta?.description ?? `Handmade ${name.toLowerCase()} crafted in small batches.`,
    folder,
    group,
    cover: coverImage(folder, coverFile, `${name} – handmade ${itemLabel}`),
    itemLabel,
    href: collectionHref(slug),
  };
}

function sortCollections(list: Collection[]): Collection[] {
  const ord = (c: Collection) => COLLECTION_META[c.folder]?.order ?? Number.MAX_SAFE_INTEGER;
  return list.sort((a, b) => ord(a) - ord(b) || a.name.localeCompare(b.name, "en"));
}

/** Top-level collections (every folder in public/images except the handmade root). */
export function getSignatureCollections(): Collection[] {
  return sortCollections(
    listDirs(PUBLIC_IMAGES).filter((d) => d !== HANDMADE_FOLDER).map((d) => build(d, "signature")).filter((c): c is Collection => c !== null),
  );
}

/** Handmade jewellery categories, alphabetical by display name. */
export function getHandmadeCategories(): Collection[] {
  return sortCollections(
    listDirs(path.join(PUBLIC_IMAGES, HANDMADE_FOLDER)).map((d) => build(`${HANDMADE_FOLDER}/${d}`, "handmade")).filter((c): c is Collection => c !== null),
  );
}

export function getAllCollections(): Collection[] {
  return [...getSignatureCollections(), ...getHandmadeCategories()];
}

export function getCollection(slug: string): Collection | null {
  return getAllCollections().find((c) => c.slug === slug) ?? null;
}

export type GalleryItem = CollectionImage & {
  /** Catalogue product shown by this photo (null for a photo not yet catalogued). */
  name: string | null;
  href: string | null;
};

/** One tile per catalogue product (primary photo), then any uncatalogued photos. */
export function getCollectionGallery(c: Collection): GalleryItem[] {
  const products: GalleryItem[] = getCollectionProducts(c.slug).map((p) => ({ src: p.image, alt: imageAlt(p), file: p.image.split("/").pop()!, name: p.name, href: p.href }));
  const extra: GalleryItem[] = uncatalogued(c.folder).map((f, i) => ({ ...img(c.folder, f, `${c.name} – handmade ${c.itemLabel} design ${products.length + i + 1}`), name: null, href: null }));
  return [...products, ...extra];
}

/** Number of designs shown for a collection (catalogue products + uncatalogued photos). */
export function countDesigns(c: Collection): number {
  return getCollectionProducts(c.slug).length + uncatalogued(c.folder).length;
}
