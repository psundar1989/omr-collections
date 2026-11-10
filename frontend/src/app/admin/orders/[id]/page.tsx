"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, ImageOff, MapPin, MessageSquare, Pencil, Phone, Printer, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import {
  ACTION_LABELS, PAYMENT_METHODS, STATUS_TONE, customerMessage, deliveryMessage, fullAddress,
  type AdminOrder, type DeliveryPerson, type OrderHistory,
} from "@/lib/admin-orders";
import { cn, formatDate, formatPrice, whatsappLink } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { Badge, Field, Modal, PageHeader, Panel, Spinner, useToast } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/ui/Icons";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useAdminApi();
  const toast = useToast();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [people, setPeople] = useState<DeliveryPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<OrderStatus | null>(null);
  const [editCustomer, setEditCustomer] = useState(false);

  useEffect(() => {
    api<{ data: AdminOrder }>(`/orders/${id}`).then((r) => setOrder(r.data)).catch((e) => setError(errorMessage(e)));
    api<{ data: DeliveryPerson[] }>("/delivery-persons?active=1").then((r) => setPeople(r.data)).catch(() => undefined);
  }, [api, id]);

  /** PATCH / POST helper that refreshes the order from the response. Returns field errors on 422. */
  const send = useCallback(async (path: string, method: string, body: object, ok: string): Promise<Record<string, string> | null> => {
    try {
      const r = await api<{ data: AdminOrder }>(`/orders/${id}${path}`, { method, body: JSON.stringify(body) });
      setOrder(r.data);
      toast("success", ok);
      return null;
    } catch (e) {
      toast("error", errorMessage(e));
      return fieldErrors(e);
    }
  }, [api, id, toast]);

  if (error) return <p className="text-rose">{error}</p>;
  if (!order) return <Spinner />;

  const closed = ["delivered", "cancelled", "returned"].includes(order.status);
  const forward = order.next_statuses.filter((s) => !["cancelled", "returned"].includes(s));
  const backward = order.next_statuses.filter((s) => ["cancelled", "returned"].includes(s));

  return (
    <div className="print:text-xs">
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink print:hidden"><ArrowLeft className="h-4 w-4" /> All orders</Link>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${formatDate(order.created_at)} · ${order.source === "buy_now" ? "Buy now" : "Cart"} · via WhatsApp`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Badge tone={STATUS_TONE[order.status]}>{order.status_label}</Badge>
            {forward.map((s) => <button key={s} className="btn-primary" onClick={() => setAction(s)}>{ACTION_LABELS[s]}</button>)}
            {backward.map((s) => <button key={s} className="btn-outline text-rose" onClick={() => setAction(s)}>{ACTION_LABELS[s]}</button>)}
            <button className="btn-outline" onClick={() => window.print()} aria-label="Print"><Printer className="h-4 w-4" /></button>
          </div>
        }
      />

      <Progress order={order} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <ItemsPanel key={`${order.delivery_charge}|${order.discount}|${order.total}`} order={order} closed={closed} send={send} />
          <Timeline order={order} send={send} />
        </div>

        <div className="space-y-6">
          <Panel title="Customer" actions={!editCustomer && <button className="text-xs text-gold-dark underline print:hidden" onClick={() => setEditCustomer(true)}><Pencil className="mr-1 inline h-3 w-3" />Edit</button>}>
            {editCustomer ? <CustomerEditor order={order} send={send} onDone={() => setEditCustomer(false)} /> : <CustomerCard order={order} />}
          </Panel>
          <DeliveryPanel key={[order.courier_name, order.tracking_number, order.expected_delivery_date, order.delivery_notes].join("|")} order={order} people={people} closed={closed} send={send} />
          <PaymentPanel key={order.payment_reference ?? ""} order={order} send={send} />
          <Panel title="Private notes" className="print:hidden">
            <textarea className="input min-h-20 text-sm" placeholder="Only visible to admins" defaultValue={order.admin_notes ?? ""} key={order.updated_at}
              onBlur={(e) => e.target.value !== (order.admin_notes ?? "") && send("", "PATCH", { admin_notes: e.target.value }, "Notes saved.")} />
          </Panel>
        </div>
      </div>

      {action && <StatusDialog order={order} status={action} onClose={() => setAction(null)} send={send} />}
    </div>
  );
}

type Send = (path: string, method: string, body: object, ok: string) => Promise<Record<string, string> | null>;

/* ------------------------------------------------------------- progress */

function Progress({ order }: { order: AdminOrder }) {
  const steps: { s: OrderStatus; at: string | null }[] = [
    { s: "pending", at: order.created_at },
    { s: "confirmed", at: order.confirmed_at },
    { s: "packed", at: lastAt(order.histories, "packed") },
    { s: "out_for_delivery", at: order.dispatched_at },
    { s: "delivered", at: order.delivered_at },
  ];
  if (order.status === "cancelled" || order.status === "returned") {
    return (
      <div className="rounded-2xl border border-rose/30 bg-rose/5 p-4 text-sm">
        <strong>{order.status_label}</strong> {formatDate(order.status === "cancelled" ? order.cancelled_at : lastAt(order.histories, "returned"))}
        {order.cancellation_reason && <> – {order.cancellation_reason}</>}
      </div>
    );
  }
  const reached = steps.findIndex((x) => x.s === order.status);
  return (
    <ol className="grid grid-cols-5 gap-2 rounded-2xl border border-line bg-white p-4">
      {steps.map((x, i) => (
        <li key={x.s} className="text-center">
          <div className={cn("mx-auto h-1.5 rounded-full", i <= reached ? "bg-whatsapp" : "bg-line")} />
          <p className={cn("mt-2 text-xs", i <= reached ? "font-medium" : "text-muted")}>{ORDER_STATUS_LABELS[x.s]}</p>
          {i <= reached && x.at && <p className="text-[11px] text-muted">{formatDate(x.at)}</p>}
        </li>
      ))}
    </ol>
  );
}

const lastAt = (h: OrderHistory[] | undefined, status: OrderStatus) =>
  [...(h ?? [])].reverse().find((x) => x.event === "status_changed" && x.status === status)?.created_at ?? null;

/* ---------------------------------------------------------------- items */

/** Snapshot photo of an ordered product; a placeholder when it is missing or no longer loads. */
function OrderItemImage({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span role="img" aria-label="No product image" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream text-sand"><ImageOff className="h-5 w-5" strokeWidth={1.5} /></span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setBroken(true)} className="h-12 w-12 shrink-0 rounded-lg object-cover" />;
}

function ItemsPanel({ order, closed, send }: { order: AdminOrder; closed: boolean; send: Send }) {
  const items = order.items ?? [];
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [charges, setCharges] = useState({ delivery_charge: order.delivery_charge, discount: order.discount });

  const dirtyPrices = Object.entries(prices).filter(([, v]) => v !== "");
  const chargesDirty = +charges.delivery_charge !== +order.delivery_charge || +charges.discount !== +order.discount;

  const save = async () => {
    const err = await send("", "PATCH", {
      ...(chargesDirty ? { delivery_charge: +charges.delivery_charge || 0, discount: +charges.discount || 0 } : {}),
      ...(dirtyPrices.length ? { items: dirtyPrices.map(([id, v]) => ({ id: +id, unit_price: +v })) } : {}),
    }, "Order total updated.");
    if (!err) setPrices({});
  };

  return (
    <Panel title={`Items (${items.reduce((a, i) => a + i.quantity, 0)})`}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr><th className="pb-2">Product</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit price</th><th className="pb-2 text-right">Total</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <OrderItemImage src={i.image_url} name={i.product_name} />
                  <div className="min-w-0">
                    {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:text-gold-dark">{i.product_name}</Link> : <p className="font-medium">{i.product_name}</p>}
                    <p className="text-xs text-muted">{[i.sku && `SKU ${i.sku}`, i.colour && `Colour: ${i.colour}`, i.size && `Size: ${i.size}`].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 text-center">{i.quantity}</td>
              <td className="py-3 text-right">
                {i.unit_price == null || (i.price_on_request && !closed) ? (
                  closed ? <span className="text-gold-dark">On request</span> : (
                    <input type="number" min={0} step="0.01" className="input ml-auto w-28 py-1 text-right text-sm" aria-label={`Price for ${i.product_name}`}
                      placeholder={i.unit_price == null ? "Set price" : i.unit_price} value={prices[i.id] ?? ""} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} />
                  )
                ) : (
                  <>{formatPrice(+i.unit_price)}{i.original_price && <p className="text-xs text-muted line-through">{formatPrice(+i.original_price)}</p>}</>
                )}
              </td>
              <td className="py-3 text-right font-medium">{i.unit_price == null ? "—" : formatPrice(+i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(+order.subtotal)}</dd></div>
        <div className="flex items-center justify-between"><dt className="text-muted">Delivery charge</dt>
          <dd>{closed ? formatPrice(+order.delivery_charge) : <input type="number" min={0} className="input w-28 py-1 text-right text-sm" value={charges.delivery_charge} onChange={(e) => setCharges({ ...charges, delivery_charge: e.target.value })} aria-label="Delivery charge" />}</dd></div>
        <div className="flex items-center justify-between"><dt className="text-muted">Discount</dt>
          <dd>{closed ? `−${formatPrice(+order.discount)}` : <input type="number" min={0} className="input w-28 py-1 text-right text-sm" value={charges.discount} onChange={(e) => setCharges({ ...charges, discount: e.target.value })} aria-label="Discount" />}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(+order.total)}{order.has_price_on_request && <span className="ml-1 text-xs font-normal text-gold-dark">+ items on request</span>}</dd></div>
      </dl>
      {(dirtyPrices.length > 0 || chargesDirty) && <div className="mt-3 flex justify-end print:hidden"><button className="btn-primary" onClick={save}>Save prices & total</button></div>}
      {order.customer_notes && <p className="mt-4 rounded-xl bg-gold/10 p-3 text-sm"><strong>Customer note:</strong> {order.customer_notes}</p>}
    </Panel>
  );
}

/* ------------------------------------------------------------- customer */

function CustomerCard({ order }: { order: AdminOrder }) {
  const toast = useToast();
  const copy = () => navigator.clipboard.writeText(`${order.customer_name}\n${order.phone}\n${fullAddress(order)}`).then(() => toast("success", "Address copied."));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-base font-medium">{order.customer_name}</p>
      <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted" /><a href={`tel:${order.phone}`} className="underline">{order.phone}</a></p>
      <p className="flex items-center gap-2"><WhatsAppIcon className="h-4 w-4 text-whatsapp" />{order.whatsapp_number}</p>
      {order.email && <p className="text-muted">{order.email}</p>}
      <div className="flex gap-2 rounded-xl bg-ivory p-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p className="flex-1 whitespace-pre-line">{fullAddress(order)}</p>
        <button onClick={copy} aria-label="Copy address" className="self-start text-muted hover:text-ink print:hidden"><Copy className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <a className="btn-whatsapp px-3 py-1.5 text-xs" target="_blank" rel="noopener noreferrer" href={whatsappLink(order.whatsapp_number, customerMessage(order, ""))}>
          <WhatsAppIcon className="h-3.5 w-3.5" /> Send status update
        </a>
        <a className="btn-outline px-3 py-1.5 text-xs" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.city} ${order.pincode}`)}`}>
          <MapPin className="h-3.5 w-3.5" /> Map
        </a>
      </div>
    </div>
  );
}

function CustomerEditor({ order, send, onDone }: { order: AdminOrder; send: Send; onDone: () => void }) {
  const keys = ["customer_name", "phone", "whatsapp_number", "email", "address", "landmark", "city", "state", "pincode"] as const;
  const labels: Record<(typeof keys)[number], string> = { customer_name: "Name", phone: "Phone", whatsapp_number: "WhatsApp", email: "Email", address: "Address", landmark: "Landmark", city: "City", state: "State", pincode: "Pincode" };
  const [v, setV] = useState(() => Object.fromEntries(keys.map((k) => [k, order[k] ?? ""])) as Record<(typeof keys)[number], string>);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const save = async () => {
    const body = Object.fromEntries(keys.filter((k) => v[k] !== (order[k] ?? "")).map((k) => [k, v[k] === "" ? null : v[k]]));
    if (!Object.keys(body).length) return onDone();
    const e = await send("", "PATCH", body, "Customer details updated.");
    if (e) setErrs(e);
    else onDone();
  };
  return (
    <div className="space-y-2">
      {keys.map((k) => (
        <Field key={k} label={labels[k]} error={errs[k]}>
          {k === "address" ? <textarea className="input min-h-16 text-sm" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            : <input className="input text-sm" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
        </Field>
      ))}
      <div className="flex justify-end gap-2 pt-1"><button className="btn-outline" onClick={onDone}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></div>
    </div>
  );
}

/* ------------------------------------------------------------- delivery */

function DeliveryPanel({ order, people, closed, send }: { order: AdminOrder; people: DeliveryPerson[]; closed: boolean; send: Send }) {
  const [form, setForm] = useState(() => ({
    courier_name: order.courier_name ?? "", tracking_number: order.tracking_number ?? "",
    expected_delivery_date: order.expected_delivery_date ?? "", delivery_notes: order.delivery_notes ?? "",
  }));
  const dirty = form.courier_name !== (order.courier_name ?? "") || form.tracking_number !== (order.tracking_number ?? "")
    || form.expected_delivery_date !== (order.expected_delivery_date ?? "") || form.delivery_notes !== (order.delivery_notes ?? "");
  const p = order.delivery_person;
  // Keep a deactivated / removed assignee visible in the picker.
  const options = p && !people.some((x) => x.id === p.id) ? [...people, p] : people;

  return (
    <Panel title="Delivery" actions={<Truck className="h-4 w-4 text-muted" />}>
      <Field label="Delivery person">
        <select className="input text-sm" disabled={closed} value={order.delivery_person_id ?? ""}
          onChange={(e) => send("/assign", "POST", { delivery_person_id: e.target.value ? +e.target.value : null }, e.target.value ? "Delivery person assigned." : "Delivery person removed.")}>
          <option value="">— Not assigned —</option>
          {options.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.phone}{x.service_area ? ` · ${x.service_area}` : ""}{x.active_orders_count ? ` (${x.active_orders_count} open)` : ""}</option>)}
        </select>
      </Field>
      {people.length === 0 && <p className="mt-1 text-xs text-muted">No delivery persons yet. <Link href="/admin/delivery-persons" className="underline">Add one</Link>.</p>}
      {p && (
        <div className="mt-3 rounded-xl bg-ivory p-3 text-sm">
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted">{[p.phone, p.alternate_phone, p.vehicle_type, p.vehicle_number].filter(Boolean).join(" · ")}</p>
          {order.assigned_at && <p className="text-xs text-muted">Assigned {formatDate(order.assigned_at)}</p>}
          <div className="mt-2 flex flex-wrap gap-2 print:hidden">
            <a className="btn-whatsapp px-3 py-1.5 text-xs" target="_blank" rel="noopener noreferrer" href={whatsappLink(p.phone, deliveryMessage(order))}><WhatsAppIcon className="h-3.5 w-3.5" /> Send delivery details</a>
            <a className="btn-outline px-3 py-1.5 text-xs" href={`tel:${p.phone}`}><Phone className="h-3.5 w-3.5" /> Call</a>
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Field label="Courier (if shipped)"><input className="input text-sm" disabled={closed} value={form.courier_name} onChange={(e) => setForm({ ...form, courier_name: e.target.value })} placeholder="India Post, DTDC…" /></Field>
        <Field label="Tracking no."><input className="input text-sm" disabled={closed} value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} /></Field>
      </div>
      <Field label="Expected delivery" className="mt-2"><input type="date" className="input text-sm" disabled={closed} value={form.expected_delivery_date} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} /></Field>
      <Field label="Delivery instructions" className="mt-2"><textarea className="input min-h-14 text-sm" disabled={closed} value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} placeholder="Call before arriving, gate code…" /></Field>
      {dirty && <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={() => send("", "PATCH", Object.fromEntries(Object.entries(form).map(([k, x]) => [k, x || null])), "Delivery details saved.")}>Save delivery details</button></div>}
      {order.delivered_at && <p className="mt-3 flex items-center gap-1.5 text-sm text-whatsapp"><CheckCircle2 className="h-4 w-4" /> Delivered {formatDate(order.delivered_at)}</p>}
    </Panel>
  );
}

/* -------------------------------------------------------------- payment */

function PaymentPanel({ order, send }: { order: AdminOrder; send: Send }) {
  const [ref, setRef] = useState(order.payment_reference ?? "");
  return (
    <Panel title="Payment">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Status">
          <select className="input text-sm" value={order.payment_status} onChange={(e) => send("", "PATCH", { payment_status: e.target.value }, "Payment updated.")}>
            <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
          </select>
        </Field>
        <Field label="Method">
          <select className="input text-sm" value={order.payment_method ?? ""} onChange={(e) => send("", "PATCH", { payment_method: e.target.value || null }, "Payment updated.")}>
            <option value="">—</option>{Object.entries(PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Reference / UPI txn ID" className="mt-2">
        <input className="input text-sm" value={ref} onChange={(e) => setRef(e.target.value)} onBlur={() => ref !== (order.payment_reference ?? "") && send("", "PATCH", { payment_reference: ref || null }, "Payment updated.")} />
      </Field>
    </Panel>
  );
}

/* ------------------------------------------------------------- timeline */

const EVENT_TITLE: Record<OrderHistory["event"], (h: OrderHistory) => string> = {
  placed: () => "Order placed",
  status_changed: (h) => `${h.from_status ? ORDER_STATUS_LABELS[h.from_status] : ""} → ${ORDER_STATUS_LABELS[h.status]}`,
  assigned: () => "Delivery person assigned",
  unassigned: () => "Delivery person removed",
  updated: () => "Order updated",
  payment: () => "Payment",
  note: () => "Note",
};

function Timeline({ order, send }: { order: AdminOrder; send: Send }) {
  const [note, setNote] = useState("");
  const add = async () => {
    if (!note.trim()) return;
    if (!(await send("/notes", "POST", { note: note.trim() }, "Note added."))) setNote("");
  };
  const items = [...(order.histories ?? [])].reverse();
  return (
    <Panel title="Status history">
      <div className="mb-4 flex gap-2 print:hidden">
        <input className="input text-sm" placeholder="Add a note to the timeline (customer called, payment promised…)" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-outline" onClick={add} disabled={!note.trim()}><MessageSquare className="h-4 w-4" /> Add</button>
      </div>
      <ol className="relative space-y-4 border-l border-line pl-5">
        {items.map((h) => (
          <li key={h.id} className="relative">
            <span className={cn("absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white", h.event === "status_changed" || h.event === "placed" ? "bg-whatsapp" : "bg-sand")} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium">{EVENT_TITLE[h.event](h)}</p>
              <p className="text-xs text-muted">{formatDate(h.created_at)} · {h.user?.name ?? (h.event === "placed" ? "Customer" : "System")}</p>
            </div>
            {h.note && <p className="mt-0.5 whitespace-pre-line text-sm text-ink/75">{h.note}</p>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* --------------------------------------------------------- status modal */

function StatusDialog({ order, status, onClose, send }: { order: AdminOrder; status: OrderStatus; onClose: () => void; send: Send }) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [paid, setPaid] = useState(order.payment_status === "unpaid" && order.payment_method === "cod");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const submit = async () => {
    if (status === "cancelled" && !reason.trim()) return setErrs({ cancellation_reason: "Please give a reason." });
    setBusy(true);
    const e = await send("/status", "POST", {
      status, note: note.trim() || null,
      ...(status === "cancelled" ? { cancellation_reason: reason.trim() } : {}),
      ...(status === "delivered" ? { mark_paid: paid } : {}),
    }, `Order ${ORDER_STATUS_LABELS[status].toLowerCase()}.`);
    setBusy(false);
    if (e) setErrs(e);
    else onClose();
  };

  return (
    <Modal title={ACTION_LABELS[status]} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {status === "confirmed" && <p className="text-muted">Confirming takes the ordered quantities out of stock. Make sure you have agreed the price and delivery with the customer on WhatsApp.</p>}
        {status === "out_for_delivery" && !order.delivery_person && !order.courier_name && <p className="rounded-lg bg-gold/10 p-2 text-gold-dark">Assign a delivery person or enter a courier first.</p>}
        {(status === "cancelled" || status === "returned") && order.status !== "pending" && <p className="text-muted">The stock taken for this order will be put back.</p>}
        {status === "cancelled" && (
          <Field label="Reason for cancelling *" error={errs.cancellation_reason}>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer did not respond, out of stock…" />
          </Field>
        )}
        {status === "delivered" && order.payment_status === "unpaid" && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Payment received ({formatPrice(+order.total)})</label>
        )}
        <Field label="Note (optional, shown in the history)">
          <textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {errs.status && <p className="text-rose">{errs.status}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose} disabled={busy}>Back</button>
        <button className={status === "cancelled" || status === "returned" ? "btn bg-rose text-white hover:bg-rose/90" : "btn-primary"} onClick={submit} disabled={busy}>{ACTION_LABELS[status]}</button>
      </div>
    </Modal>
  );
}
