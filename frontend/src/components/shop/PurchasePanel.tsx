"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "@/lib/store";
import { cn } from "@/lib/format";
import { MAX_QTY } from "@/lib/config";
import { WhatsAppIcon } from "@/components/ui/Icons";
import Price from "./Price";

/** Variation selection + quantity + add to cart. Used on the product page and in Quick View. */
export default function PurchasePanel({ product, onAdded }: { product: Product; onAdded?: () => void }) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = variants.length > 0;
  const [colour, setColour] = useState<string | null>(product.colours.length === 1 ? product.colours[0] : null);
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();
  const router = useRouter();

  const variant = useMemo(
    () => (hasVariants ? variants.find((v) => (v.colour ?? null) === (product.colours.length ? colour : null) && (v.size ?? null) === (product.sizes.length ? size : null)) ?? null : null),
    [hasVariants, variants, colour, size, product.colours.length, product.sizes.length],
  );

  const optionAvailable = (kind: "colour" | "size", value: string) => {
    if (!hasVariants) return true;
    return variants.some((v) => (kind === "colour" ? v.colour === value && (!size || v.size === size) : v.size === value && (!colour || v.colour === colour)) && v.in_stock);
  };

  const price = variant?.price ?? product.price;
  const original = variant ? variant.original_price : product.original_price;
  const stock = hasVariants ? (variant ? variant.stock_quantity : null) : product.stock_quantity;
  const inStock = hasVariants ? (variant ? variant.in_stock : product.in_stock) : product.in_stock;
  const maxQty = Math.min(MAX_QTY, stock ?? MAX_QTY);

  const validate = (): boolean => {
    if (product.colours.length && !colour) return fail("Please select a colour.");
    if (product.sizes.length && !size) return fail("Please select a size.");
    if (hasVariants && !variant) return fail("This combination is not available.");
    if (!inStock) return fail("This option is out of stock.");
    setError(null);
    return true;
  };
  const fail = (m: string) => (setError(m), false);

  const add = () => {
    if (!validate()) return false;
    cart.add({
      productId: product.id, slug: product.slug, name: product.name, sku: variant?.sku || product.sku,
      imageUrl: product.image_url, price, colour: product.colours.length ? colour : null, size: product.sizes.length ? size : null,
      variantId: variant?.id ?? null, quantity: qty, colours: product.colours, sizes: product.sizes, hasVariants,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    onAdded?.();
    return true;
  };

  return (
    <div className="space-y-5">
      <div>
        <Price price={price} original={original} discount={original ? Math.round(((original - price) / original) * 100) : null} currency={product.currency} size="lg" />
        {product.offer && <p className="mt-1 text-xs font-medium text-rose">{product.offer.name}</p>}
      </div>

      {product.colours.length > 0 && (
        <OptionGroup label="Colour" value={colour} options={product.colours} onChange={(v) => { setColour(v); setError(null); }} isAvailable={(v) => optionAvailable("colour", v)} />
      )}
      {product.sizes.length > 0 && (
        <OptionGroup label="Size" value={size} options={product.sizes} onChange={(v) => { setSize(v); setError(null); }} isAvailable={(v) => optionAvailable("size", v)} />
      )}

      <div>
        <p className="label">Quantity</p>
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center rounded-full border border-line bg-white">
            <button className="p-2.5 disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center text-sm font-medium" aria-live="polite">{qty}</span>
            <button className="p-2.5 disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
          </div>
          <StockLabel inStock={inStock} stock={stock} />
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">{error}</p>}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button className="btn-primary flex-1 py-3" onClick={add} disabled={!product.in_stock}>
          {added ? <><Check className="h-4 w-4" /> Added to cart</> : <><ShoppingBag className="h-4 w-4" /> {product.in_stock ? "Add to Cart" : "Out of Stock"}</>}
        </button>
        <button className="btn-whatsapp flex-1 py-3" disabled={!product.in_stock} onClick={() => add() && router.push("/cart")}>
          <WhatsAppIcon className="h-4 w-4" /> Order on WhatsApp
        </button>
      </div>
      {added && (
        <p className="text-sm text-muted">
          Added! <Link href="/cart" className="font-medium text-gold-dark underline">View cart ({cart.count})</Link> or continue shopping.
        </p>
      )}
    </div>
  );
}

function OptionGroup({ label, value, options, onChange, isAvailable }: { label: string; value: string | null; options: string[]; onChange: (v: string) => void; isAvailable: (v: string) => boolean }) {
  return (
    <div>
      <p className="label">{label}{value && <span className="ml-1 normal-case tracking-normal text-ink">: {value}</span>}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const available = isAvailable(o);
          return (
            <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
              className={cn("chip", value === o ? "border-ink bg-ink text-ivory" : "border-line bg-white hover:border-gold", !available && "text-muted line-through opacity-60")}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StockLabel({ inStock, stock }: { inStock: boolean; stock: number | null }) {
  if (!inStock) return <span className="text-sm font-medium text-rose">Out of stock</span>;
  if (stock != null && stock <= 5) return <span className="text-sm font-medium text-gold-dark">Only {stock} left</span>;
  return <span className="text-sm text-whatsapp">In stock</span>;
}
