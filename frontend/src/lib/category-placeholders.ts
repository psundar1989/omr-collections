/**
 * TEMPORARY dummy artwork for the homepage bead & charm category circles
 * (files in public/images/placeholders, keyed by category slug).
 *
 * Used only when a category has no image_url or its image fails to load, so a
 * real image uploaded in the admin replaces it automatically. To retire the
 * dummies, delete this file, its import in CategoryCircleImage and the folder.
 */
const PLACEHOLDERS: Record<string, string> = {
  // Trendset Beads Collection
  "crackle-beads": "/images/placeholders/beads/crackle-beads.svg",
  "jelly-beads": "/images/placeholders/beads/jelly-beads.svg",
  "printed-beads": "/images/placeholders/beads/printed-beads.svg",
  "crystal-beads": "/images/placeholders/beads/crystal-beads.svg",
  "fimo-beads": "/images/placeholders/beads/fimo-beads.svg",
  "matte-beads": "/images/placeholders/beads/matte-beads.svg",
  // Signature Charms Hub
  "butterfly-charms": "/images/placeholders/charms/butterfly-charms.svg",
  "evil-eye-charms": "/images/placeholders/charms/evil-eye-charms.svg",
  "heart-charms": "/images/placeholders/charms/heart-charms.svg",
  "kitty-charms": "/images/placeholders/charms/kitty-charms.svg",
  "magnet-charms": "/images/placeholders/charms/magnet-charms.svg",
  "metal-charms": "/images/placeholders/charms/metal-charms.svg",
  "panda-charms": "/images/placeholders/charms/panda-charms.svg",
  "stone-charms": "/images/placeholders/charms/stone-charms.svg",
};

export function categoryPlaceholder(slug: string): string | null {
  return PLACEHOLDERS[slug] ?? null;
}
