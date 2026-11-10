"use client";

import Link from "next/link";
import { Check, Loader2, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AVAILABILITY_LABELS, type ColourOption, type PlacedOrder, type Product } from "@/lib/types";
import { useCart } from "@/lib/store";
import { cn } from "@/lib/format";
import { MAX_QTY } from "@/lib/config";
import { ApiError, placeOrder } from "@/lib/client-api";
import { customPieceLink } from "@/lib/custom-order";
import { WhatsAppIcon } from "@/components/ui/Icons";
import Price from "./Price";
import CustomerDetailsForm, { useCustomerDetails, validateCustomer } from "./CustomerDetailsForm";
import OrderPlaced from "./OrderPlaced";
import { colourImageUrl, useProductSelection } from "./ProductSelection";

/**
 * Colour / size / quantity selection with Add to Cart, Order via WhatsApp and Request a
 * Custom Piece. Used on the product page and in Quick View.
 *
 * Nothing here decides a price: the displayed price comes from the API. "Order via WhatsApp"
 * asks for the delivery details, then POST /orders re-prices the selection, stores the order
 * and returns the WhatsApp message (with the order number) built from server values.
 */
export default function PurchasePanel({ product, onAdded, customPieceHref }: { product: Product; onAdded?: () => void; customPieceHref?: string }) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = variants.length > 0;
  const colourOptions: ColourOption[] = product.colour_options?.length ? product.colour_options : product.colours.map((name) => ({ name, hex: null }));
  // On the product page the colour is shared with the gallery (choosing a colour shows its photo).
  const selection = useProductSelection();
  const [ownColour, setOwnColour] = useState<string | null>(product.colours.length === 1 ? product.colours[0] : null);
  const colour = selection ? selection.colour : ownColour;
  const setColour = selection ? selection.setColour : setOwnColour;
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [customer, setCustomer, rememberCustomer] = useCustomerDetails();
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const cart = useCart();

  const variant = useMemo(
    () => (hasVariants ? variants.find((v) => (v.colour ?? null) === (product.colours.length ? colour : null) && (v.size ?? null) === (product.sizes.length ? size : null)) ?? null : null),
    [hasVariants, variants, colour, size, product.colours.length, product.sizes.length],
  );

  const optionAvailable = (kind: "colour" | "size", value: string) => {
    if (!hasVariants) return true;
    return variants.some((v) => (kind === "colour" ? v.colour === value && (!size || v.size === size) : v.size === value && (!colour || v.colour === colour)) && v.in_stock);
  };

  const onRequest = product.price_on_request;
  // Sold out / discontinued (admin status) – shown, never orderable. The server enforces this too.
  const status = product.availability_status ?? "available";
  const unavailable = status !== "available";
  const canOrder = !unavailable && product.in_stock;
  const price = variant ? variant.price : product.price;
  const original = variant ? variant.original_price : product.original_price;
  const stock = hasVariants ? (variant ? variant.stock_quantity : null) : product.stock_quantity;
  const inStock = hasVariants ? (variant ? variant.in_stock : product.in_stock) : product.in_stock;
  const maxQty = Math.max(1, Math.min(MAX_QTY, stock ?? MAX_QTY));
  const selectedColour = product.colours.length ? colour : null;
  const selectedSize = product.sizes.length ? size : null;
  // SKU of exactly what is chosen: the variant's, else the colour × size SKU, else the product SKU.
  const selectedSku = variant?.sku
    || product.option_skus?.find((o) => (o.colour ?? null) === selectedColour && (o.size ?? null) === selectedSize)?.sku
    || product.sku;
  const colourPhoto = (name: string) => colourImageUrl(product.images, name);

  const fail = (m: string) => (setError(m), false);
  const validate = (): boolean => {
    if (unavailable) return fail(status === "sold_out" ? "This product is sold out." : "This product has been discontinued.");
    if (product.colours.length && !colour) return fail("Please select a colour.");
    if (product.sizes.length && !size) return fail("Please select a size.");
    if (hasVariants && !variant) return fail("This combination is not available.");
    if (!inStock) return fail("This option is out of stock.");
    if (qty < 1 || qty > maxQty) return fail(stock != null ? `Only ${stock} left in stock.` : `You can order at most ${MAX_QTY}.`);
    setError(null);
    return true;
  };

  const add = () => {
    if (!validate()) return;
    cart.add({
      productId: product.id, slug: product.slug, name: product.name, sku: selectedSku,
      imageUrl: colourPhoto(selectedColour ?? "") ?? product.image_url, price, priceOnRequest: onRequest, colour: selectedColour, size: selectedSize,
      variantId: variant?.id ?? null, quantity: qty, colours: product.colours, sizes: product.sizes, hasVariants,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    onAdded?.();
  };

  /** Step 1: check the selection, then ask for delivery details. */
  const startCheckout = () => {
    if (!validate()) return;
    setPlaced(null);
    setCheckout(true);
  };

  /** Step 2: store the order on the server and open WhatsApp with the server-built message. */
  const orderOnWhatsApp = async () => {
    if (!validate()) return;
    const errs = validateCustomer(customer);
    setCustomerErrors(errs);
    if (Object.keys(errs).length) return;
    rememberCustomer(customer);
    setOrdering(true);
    // Open the tab synchronously so popup blockers allow it; on mobile this hands over to the app.
    const win = window.open("", "_blank");
    try {
      const order = await placeOrder([{ key: "buy-now", product_id: product.id, variant_id: variant?.id ?? null, colour: selectedColour, size: selectedSize, quantity: qty }], customer, "buy_now");
      if (win) win.location.href = order.whatsapp_url;
      else window.location.href = order.whatsapp_url;
      setPlaced(order);
      setCheckout(false);
    } catch (e) {
      win?.close();
      if (e instanceof ApiError && Object.keys(e.errors).length) {
        setCustomerErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])));
      }
      setError(e instanceof ApiError ? (e.status === 422 && e.errors.items ? "This item is not available right now." : e.message) : "Could not reach WhatsApp. Please try again.");
    } finally {
      setOrdering(false);
    }
  };

  const customHref = customPieceHref ?? customPieceLink({ name: product.name, code: product.sku, type: product.category?.name }, selectedColour, selectedSize);

  return (
    <div className="space-y-5">
      <div>
        <Price price={onRequest ? null : price} original={original} discount={price != null && original ? Math.round(((original - price) / original) * 100) : null} currency={product.currency} size="lg" />
        {onRequest && !unavailable && <p className="mt-1 text-xs text-muted">Choose your options and message us – we will share the price and availability on WhatsApp.</p>}
        {unavailable && (
          <p className="mt-3 rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink" role="status">
            <strong>{AVAILABILITY_LABELS[status]}</strong> – {status === "sold_out" ? "this piece cannot be ordered right now. You can request a similar custom piece below." : "this design is no longer made. You can request a similar custom piece below."}
          </p>
        )}
        {product.offer && <p className="mt-1 text-xs font-medium text-rose">{product.offer.name}</p>}
        <p className="mt-2 text-xs text-muted">SKU: <span className="font-medium text-ink" aria-live="polite">{selectedSku}</span></p>
      </div>

      {colourOptions.length > 0 && (
        <ColourGroup value={colour} options={colourOptions} onChange={(v) => { setColour(v); setError(null); }} isAvailable={(v) => optionAvailable("colour", v)} photo={colourPhoto} />
      )}
      {product.sizes.length > 0 && (
        <OptionGroup label="Available Sizes" value={size} options={product.sizes} onChange={(v) => { setSize(v); setError(null); }} isAvailable={(v) => optionAvailable("size", v)} />
      )}

      <div>
        <p className="label">Quantity</p>
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center rounded-full border border-line bg-white">
            <button type="button" className="p-2.5 disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={unavailable || qty <= 1} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center text-sm font-medium" aria-live="polite">{qty}</span>
            <button type="button" className="p-2.5 disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={unavailable || qty >= maxQty} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
          </div>
          {!unavailable && <StockLabel inStock={inStock} stock={stock} />}
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose" role="alert">{error}</p>}

      <div className="space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button type="button" className="btn-primary flex-1 py-3" onClick={add} disabled={!canOrder}>
            {added ? <><Check className="h-4 w-4" /> Added to cart</> : <><ShoppingBag className="h-4 w-4" /> {unavailable ? AVAILABILITY_LABELS[status] : product.in_stock ? "Add to Cart" : "Out of Stock"}</>}
          </button>
          <button type="button" className="btn-whatsapp flex-1 py-3" disabled={!canOrder || ordering} onClick={startCheckout} aria-expanded={checkout}>
            <WhatsAppIcon className="h-4 w-4" /> Order via WhatsApp
          </button>
        </div>
        {checkout && canOrder && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <CustomerDetailsForm value={customer} onChange={setCustomer} errors={customerErrors} />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline px-4 py-3" onClick={() => setCheckout(false)} disabled={ordering}>Cancel</button>
              <button type="button" className="btn-whatsapp flex-1 py-3" onClick={orderOnWhatsApp} disabled={ordering}>
                {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />} Send order on WhatsApp
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">We save your order and open WhatsApp with your order number. No payment is collected on this website.</p>
          </div>
        )}
        {placed && <OrderPlaced order={placed} compact />}
        <Link href={customHref} className="btn-outline w-full py-3"><Sparkles className="h-4 w-4 text-gold" /> Request a Custom Piece</Link>
      </div>
      {added && (
        <p className="text-sm text-muted">
          Added! <Link href="/cart" className="font-medium text-gold-dark underline">View cart ({cart.count})</Link> or continue shopping.
        </p>
      )}
    </div>
  );
}

function ColourGroup({ value, options, onChange, isAvailable, photo }: { value: string | null; options: ColourOption[]; onChange: (v: string) => void; isAvailable: (v: string) => boolean; photo?: (name: string) => string | null }) {
  return (
    <div>
      <p className="label">Available Colours{value && <span className="ml-1 normal-case tracking-normal text-ink">: {value}</span>}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
        {options.map((o) => {
          const available = isAvailable(o.name);
          const selected = value === o.name;
          return (
            <button key={o.name} type="button" role="radio" aria-checked={selected} onClick={() => onChange(o.name)}
              className={cn("chip gap-2 pl-1.5", selected ? "border-ink bg-ink text-ivory ring-2 ring-gold/40" : "border-line bg-white hover:border-gold", !available && "text-muted line-through opacity-60")}>
              <Swatch hex={o.hex} image={o.hex ? null : photo?.(o.name)} />
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Round colour dot. Colours without a palette entry show their photo when there is one
 * (e.g. "Purple & White"), else a neutral striped dot.
 */
export function Swatch({ hex, image, className }: { hex: string | null; image?: string | null; className?: string }) {
  const style = hex ? { backgroundColor: hex }
    : image ? { backgroundImage: `url("${image.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage: "repeating-linear-gradient(45deg,#efe6d8 0 3px,#fff 3px 6px)" };
  return <span aria-hidden className={cn("inline-block h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-inner", className)} style={style} />;
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
              className={cn("chip min-w-12 justify-center", value === o ? "border-ink bg-ink text-ivory ring-2 ring-gold/40" : "border-line bg-white hover:border-gold", !available && "text-muted line-through opacity-60")}>
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
  return <span className="text-sm text-whatsapp">{stock == null ? "Made to order" : "In stock"}</span>;
}
