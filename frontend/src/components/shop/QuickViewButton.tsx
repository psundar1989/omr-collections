"use client";

import Link from "next/link";
import { Eye, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProduct } from "@/lib/client-api";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/format";
import ProductImage from "./ProductImage";
import PurchasePanel from "./PurchasePanel";

export default function QuickViewButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Quick view"
        className={cn(compact ? "btn-outline h-full px-3 py-2" : "btn w-full bg-white/95 py-2 text-xs text-ink shadow-sm hover:bg-white")}>
        <Eye className="h-4 w-4" />{!compact && "Quick View"}
      </button>
      {open && <QuickViewModal slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickViewModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchProduct(slug).then((p) => alive && setProduct(p)).catch((e) => alive && setError(e.message));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [slug, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Quick view">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-ivory p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <button className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        {!product && !error && <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>}
        {error && <p className="p-8 text-center text-rose">{error}</p>}
        {product && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
              <ProductImage src={product.images?.[0]?.url ?? product.image_url} alt={product.name} sizes="(min-width:640px) 360px, 90vw" />
            </div>
            <div>
              {product.category && <p className="eyebrow">{product.category.name}</p>}
              <h2 className="heading-display mt-1 text-3xl">{product.name}</h2>
              <p className="mt-1 text-xs text-muted">Code: {product.sku}</p>
              {product.short_description && <p className="mt-3 text-sm text-ink/80">{product.short_description}</p>}
              <div className="mt-5"><PurchasePanel product={product} /></div>
              <Link href={`/products/${product.slug}`} className="mt-4 inline-block text-sm text-gold-dark underline" onClick={onClose}>View full details</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
