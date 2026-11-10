"use client";

import Link from "next/link";
import { AlertCircle, Info, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cartStore, useCart, type CartItem } from "@/lib/store";
import { fetchQuote, placeOrder as submitOrder, ApiError } from "@/lib/client-api";
import type { PlacedOrder, Quote, QuoteLine } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { MAX_QTY } from "@/lib/config";
import { WhatsAppIcon } from "@/components/ui/Icons";
import ProductImage from "./ProductImage";
import CustomerDetailsForm, { useCustomerDetails, validateCustomer } from "./CustomerDetailsForm";
import OrderPlaced from "./OrderPlaced";

export default function CartView() {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  // The form only renders after the cart hydrates on the client, so reading localStorage here is safe.
  const [customer, setCustomer, rememberCustomer] = useCustomerDetails();
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const reqId = useRef(0);

  // Re-quote whenever lines, quantities or options change (not on display-price sync).
  const signature = useMemo(() => JSON.stringify(cart.items.map((i) => [i.key, i.quantity])), [cart.items]);
  const toQuoteItems = (items: CartItem[]) =>
    items.map((i) => ({ key: i.key, product_id: i.productId, variant_id: i.variantId, colour: i.colour, size: i.size, quantity: i.quantity }));

  useEffect(() => {
    const items = cartStore.get();
    if (!items.length) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      setLoading(true);
      fetchQuote(toQuoteItems(items))
        .then((q) => {
          if (id !== reqId.current) return;
          setQuote(q);
          setError(null);
          // Keep last-known display prices in sync with the server.
          cartStore.set((prev) => prev.map((it) => {
            const line = q.items.find((l) => l.key === it.key);
            if (!line || (line.unit_price == null && !line.price_on_request)) return it; // not priced (e.g. option missing)
            return line.unit_price !== it.price || line.price_on_request !== !!it.priceOnRequest
              ? { ...it, price: line.unit_price, priceOnRequest: line.price_on_request } : it;
          }));
        })
        .catch((e) => id === reqId.current && setError(e instanceof ApiError ? e.message : "Could not update prices."))
        .finally(() => id === reqId.current && setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [signature]);

  const lineFor = (key: string): QuoteLine | undefined => quote?.items.find((l) => l.key === key);

  /** Store the order with the delivery details, then hand over to WhatsApp with the order number. */
  const placeOrder = async () => {
    const errs = validateCustomer(customer);
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setError("Please complete your delivery details.");
      return;
    }

    rememberCustomer(customer);
    setOrdering(true);
    setError(null);
    // Open the tab synchronously so popup blockers allow it, then point it at WhatsApp.
    const win = window.open("", "_blank");
    try {
      const order = await submitOrder(toQuoteItems(cart.items), customer, "cart");
      if (win) win.location.href = order.whatsapp_url;
      else window.location.href = order.whatsapp_url;
      setPlaced(order);
      cart.clear();
    } catch (e) {
      win?.close();
      if (e instanceof ApiError && e.errors) setFieldErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])));
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Refresh line errors (e.g. an item sold out meanwhile).
      fetchQuote(toQuoteItems(cart.items)).then(setQuote).catch(() => undefined);
    } finally {
      setOrdering(false);
    }
  };

  if (placed) return <OrderPlaced order={placed} />;

  if (!cart.items.length) {
    return (
      <div className="container-x flex flex-col items-center py-24 text-center">
        <ShoppingBag className="h-12 w-12 text-sand" strokeWidth={1.2} />
        <h1 className="heading-display mt-4 text-4xl">Your cart is empty</h1>
        <p className="mt-2 text-muted">Discover something handmade you will love.</p>
        <Link href="/shop" className="btn-primary mt-6 px-7 py-3">Start shopping</Link>
      </div>
    );
  }

  const hasErrors = quote ? !quote.valid : false;
  const onRequest = quote ? quote.has_price_on_request : cart.hasPriceOnRequest;
  const priced = quote ? quote.total : cart.subtotal;
  const totalText = onRequest ? (priced > 0 ? `${quote ? quote.total_formatted : formatPrice(priced)} + on request` : "On request") : quote ? quote.total_formatted : formatPrice(cart.subtotal);

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mb-8 flex items-end justify-between">
        <h1 className="heading-display text-4xl sm:text-5xl">Your Cart</h1>
        <Link href="/shop" className="text-sm text-gold-dark underline">Continue shopping</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <CartRow key={item.key} item={item} line={lineFor(item.key)} />
          ))}
          <li className="flex justify-end">
            <button className="text-sm text-muted hover:text-rose" onClick={() => cart.clear()}>Clear cart</button>
          </li>
        </ul>

        <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-28">
          <h2 className="heading-display text-2xl">Order Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{cart.count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="text-muted">Confirmed on WhatsApp</dd></div>
            <div className="flex items-center justify-between border-t border-line pt-3 text-base">
              <dt className="font-medium">Subtotal</dt>
              <dd className="flex items-center gap-2 font-semibold">
                {loading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
                {totalText}
              </dd>
            </div>
          </dl>
          {onRequest && <p className="mt-2 text-xs text-muted">Items marked “Price on Request” are priced by the seller on WhatsApp.</p>}

          <div className="mt-6">
            <CustomerDetailsForm value={customer} onChange={setCustomer} errors={fieldErrors} />
          </div>

          {error && <p className="mt-4 flex gap-2 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}

          <button className="btn-whatsapp mt-5 w-full py-3.5 text-base" disabled={ordering || hasErrors || loading} onClick={placeOrder}>
            {ordering ? <Loader2 className="h-5 w-5 animate-spin" /> : <WhatsAppIcon className="h-5 w-5" />} Order via WhatsApp
          </button>
          {hasErrors && <p className="mt-2 text-center text-xs text-rose">Please fix the highlighted items to continue.</p>}

          <p className="mt-4 flex gap-2 rounded-xl bg-cream/80 p-3 text-xs leading-relaxed text-ink/75">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span><strong>Your order is not confirmed yet.</strong> We save your order and open WhatsApp with your order number. {quote?.disclaimer ?? "The seller will confirm availability, delivery charges and payment on WhatsApp."} No payment is collected on this website.</span>
          </p>
        </aside>
      </div>
    </div>
  );
}

function CartRow({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const cart = useCart();
  const onRequest = line ? line.price_on_request : !!item.priceOnRequest || item.price == null;
  const unit = line?.unit_price ?? item.price;
  const max = Math.min(MAX_QTY, line?.available_quantity ?? MAX_QTY);

  return (
    <li className={`card flex gap-4 p-3 sm:p-4 ${line?.error ? "border-rose/50" : ""}`}>
      <Link href={`/products/${item.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream sm:h-28 sm:w-28">
        <ProductImage src={line?.image_url ?? item.imageUrl} alt={item.name} sizes="112px" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.slug}`} className="line-clamp-2 font-medium hover:text-gold-dark">{line?.name ?? item.name}</Link>
            <p className="text-xs text-muted">Code: {line?.sku ?? item.sku}</p>
          </div>
          <button onClick={() => cart.remove(item.key)} className="rounded-full p-1.5 text-muted hover:bg-rose/10 hover:text-rose" aria-label={`Remove ${item.name}`}><Trash2 className="h-4 w-4" /></button>
        </div>

        {(item.colours.length > 0 || item.sizes.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.colours.length > 0 && (
              <select className="input w-auto py-1.5 text-xs" value={item.colour ?? ""} aria-label="Colour"
                onChange={(e) => cart.updateOptions(item.key, { colour: e.target.value || null, variantId: null })}>
                <option value="">Colour…</option>
                {item.colours.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            {item.sizes.length > 0 && (
              <select className="input w-auto py-1.5 text-xs" value={item.size ?? ""} aria-label="Size"
                onChange={(e) => cart.updateOptions(item.key, { size: e.target.value || null, variantId: null })}>
                <option value="">Size…</option>
                {item.sizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <div className="inline-flex items-center rounded-full border border-line bg-white">
            <button className="p-2 disabled:opacity-30" disabled={item.quantity <= 1} onClick={() => cart.updateQuantity(item.key, item.quantity - 1)} aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button className="p-2 disabled:opacity-30" disabled={item.quantity >= max} onClick={() => cart.updateQuantity(item.key, item.quantity + 1)} aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {onRequest || unit == null ? (
            <div className="text-right">
              <p className="text-xs text-muted">Qty {item.quantity}</p>
              <p className="text-sm font-medium text-gold-dark">Price on Request</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-muted">{formatPrice(unit)} × {item.quantity}</p>
              <p className="font-semibold">{formatPrice(line && !line.error ? line.line_total : unit * item.quantity)}</p>
            </div>
          )}
        </div>
        {line?.error && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose"><AlertCircle className="h-3.5 w-3.5" /> {line.error}</p>}
      </div>
    </li>
  );
}
