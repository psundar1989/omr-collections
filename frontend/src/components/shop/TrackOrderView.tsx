"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2, Phone, Truck, XCircle } from "lucide-react";
import { useState } from "react";
import { ApiError, trackOrder } from "@/lib/client-api";
import { cn, formatDate, formatPrice } from "@/lib/format";
import { ORDER_FLOW, ORDER_STATUS_LABELS, type TrackedOrder } from "@/lib/types";
import ProductImage from "./ProductImage";

export default function TrackOrderView() {
  const sp = useSearchParams();
  const [number, setNumber] = useState(sp.get("order") ?? "");
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return JSON.parse(localStorage.getItem("hm_customer_v2") || "{}").phone ?? "";
    } catch {
      return "";
    }
  });
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim() || !phone.trim()) return setError("Please enter both your order number and mobile number.");
    setLoading(true);
    setError(null);
    try {
      setOrder(await trackOrder(number, phone));
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError ? err.message : "Could not check your order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="label">Order number</span>
          <input className="input uppercase" value={number} placeholder="ORD-000123" onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Mobile number</span>
          <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn-primary px-6 py-3" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Track</button>
      </form>
      {error && <p className="mt-4 flex gap-2 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
      {order && <OrderStatusCard order={order} />}
    </>
  );
}

function OrderStatusCard({ order }: { order: TrackedOrder }) {
  const stopped = order.status === "cancelled" || order.status === "returned";
  const reached = ORDER_FLOW.indexOf(order.status);
  const at = (s: string) => [...order.timeline].reverse().find((t) => t.status === s)?.at;

  return (
    <section className="card mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{order.order_number}</h2>
          <p className="text-sm text-muted">Placed {formatDate(order.placed_at)} · {order.city} {order.pincode}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", stopped ? "bg-rose/10 text-rose" : order.status === "delivered" ? "bg-whatsapp/10 text-whatsapp" : "bg-gold/15 text-gold-dark")}>
          {order.status_label}
        </span>
      </div>

      {stopped ? (
        <p className="mt-5 flex gap-2 rounded-xl bg-rose/5 p-3 text-sm text-ink/80">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
          This order was {order.status_label.toLowerCase()}{order.cancellation_reason ? `: ${order.cancellation_reason}` : "."}
        </p>
      ) : (
        <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Order progress">
          {ORDER_FLOW.map((s, i) => {
            const done = i <= reached;
            return (
              <li key={s} className="flex flex-col items-center text-center">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2", done ? "border-whatsapp bg-whatsapp text-white" : "border-line bg-white text-muted")}>
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn("mt-1.5 text-[11px] leading-tight sm:text-xs", done ? "font-medium" : "text-muted")}>{ORDER_STATUS_LABELS[s]}</span>
                {at(s) && <span className="mt-0.5 hidden text-[10px] text-muted sm:block">{formatDate(at(s))}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {order.expected_delivery_date && !stopped && order.status !== "delivered" && (
        <p className="mt-5 text-sm">Expected delivery: <strong>{new Date(order.expected_delivery_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong></p>
      )}
      {order.delivery && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-cream/70 p-3 text-sm">
          <Truck className="h-4 w-4 text-gold-dark" />
          {order.delivery.person_name && <span>Delivery by <strong>{order.delivery.person_name}</strong></span>}
          {order.delivery.person_phone && <a className="inline-flex items-center gap-1 underline" href={`tel:${order.delivery.person_phone}`}><Phone className="h-3.5 w-3.5" /> {order.delivery.person_phone}</a>}
          {order.delivery.courier_name && <span>Courier: {order.delivery.courier_name}</span>}
          {order.delivery.tracking_number && <span>Tracking no: <strong>{order.delivery.tracking_number}</strong></span>}
        </div>
      )}

      <ul className="mt-6 divide-y divide-line border-t border-line">
        {order.items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream"><ProductImage src={it.image_url} alt={it.product_name} sizes="56px" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.product_name}</p>
              <p className="text-xs text-muted">{[it.colour, it.size, `Qty ${it.quantity}`].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="text-sm">{it.unit_price == null ? "On request" : formatPrice(Number(it.line_total))}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line pt-3 text-sm">
        {order.delivery_charge > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatPrice(order.delivery_charge)}</dd></div>}
        {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>−{formatPrice(order.discount)}</dd></div>}
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatPrice(order.total)}{order.has_price_on_request ? " + on request" : ""}</dd></div>
      </dl>
    </section>
  );
}
