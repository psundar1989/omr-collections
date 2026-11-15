"use client";

import { useState } from "react";
import Image from "next/image";
import { categoryPlaceholder } from "@/lib/category-placeholders";

/**
 * Category image for the circular tiles. Falls back to the slug's dummy artwork
 * when the category has no image or the image fails to load (e.g. a 404 from storage),
 * so a broken-image icon is never shown.
 */
export default function CategoryCircleImage({ src, slug, alt, sizes, className }: { src: string | null; slug: string; alt: string; sizes: string; className?: string }) {
  const placeholder = categoryPlaceholder(slug);
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? placeholder : src;
  if (!url) return null;

  return (
    <Image
      key={url}
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={url.endsWith(".svg")}
      onError={url === src ? () => setFailed(true) : undefined}
      className={className}
    />
  );
}
