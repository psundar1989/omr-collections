"use client";

import Link from "next/link";
import { Phone, Plus, Trash2, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import { STATUS_TONE, type AdminOrder, type DeliveryPerson } from "@/lib/admin-orders";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Spinner, Toggle, useToast } from "@/components/admin/ui";

type Form = Pick<DeliveryPerson, "name" | "phone" | "alternate_phone" | "vehicle_type" | "vehicle_number" | "service_area" | "notes" | "is_active">;
const EMPTY: Form = { name: "", phone: "", alternate_phone: "", vehicle_type: "", vehicle_number: "", service_area: "", notes: "", is_active: true };

export default function DeliveryPersonsPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [people, setPeople] = useState<DeliveryPerson[] | null>(null);
  const [editing, setEditing] = useState<DeliveryPerson | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeliveryPerson | null>(null);
  const [viewing, setViewing] = useState<DeliveryPerson | null>(null);

  const load = useCallback(() => {
    api<{ data: DeliveryPerson[] }>("/delivery-persons").then((r) => setPeople(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, toast]);
  useEffect(load, [load]);

  const toggle = async (p: DeliveryPerson, is_active: boolean) => {
    try {
      await api(`/delivery-persons/${p.id}`, { method: "PUT", body: JSON.stringify({ is_active }) });
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/delivery-persons/${deleting.id}`, { method: "DELETE" });
      toast("success", "Delivery person removed.");
      setDeleting(null);
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Delivery Persons" description="People who deliver your orders. Assign them from an order's page." actions={
        <button className="btn-primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add delivery person</button>
      } />
      {!people ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <div key={p.id} className={`rounded-2xl border border-line bg-white p-4 ${p.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-sm text-muted hover:text-ink"><Phone className="h-3.5 w-3.5" /> {p.phone}</a>
                  {p.alternate_phone && <p className="text-xs text-muted">Alt: {p.alternate_phone}</p>}
                </div>
                <Toggle checked={p.is_active} onChange={(v) => toggle(p, v)} label={p.is_active ? "Active" : "Inactive"} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">Vehicle</dt><dd>{[p.vehicle_type, p.vehicle_number].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div><dt className="text-muted">Area</dt><dd>{p.service_area || "—"}</dd></div>
                <div><dt className="text-muted">Open orders</dt><dd className="font-medium">{p.active_orders_count ?? 0}</dd></div>
                <div><dt className="text-muted">Delivered</dt><dd className="font-medium">{p.delivered_orders_count ?? 0}</dd></div>
              </dl>
              {p.notes && <p className="mt-2 rounded-lg bg-ivory p-2 text-xs">{p.notes}</p>}
              <div className="mt-3 flex gap-2">
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setViewing(p)}><Truck className="h-3.5 w-3.5" /> Orders</button>
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditing(p)}>Edit</button>
                <button className="ml-auto rounded-full p-1.5 text-muted hover:bg-rose/10 hover:text-rose" onClick={() => setDeleting(p)} aria-label={`Remove ${p.name}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {people.length === 0 && <p className="rounded-2xl border border-line bg-white py-12 text-center text-muted md:col-span-2 xl:col-span-3">No delivery persons yet.</p>}
        </div>
      )}

      {editing && <PersonForm person={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {viewing && <PersonOrders person={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog title="Remove delivery person" onCancel={() => setDeleting(null)} onConfirm={remove}
          message={<>Remove <strong>{deleting.name}</strong>? Past orders will still show who delivered them. People with open orders cannot be removed; mark them inactive instead.</>} />
      )}
    </>
  );
}

function PersonForm({ person, onClose, onSaved }: { person: DeliveryPerson | null; onClose: () => void; onSaved: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [v, setV] = useState<Form>(() => (person ? { ...EMPTY, ...Object.fromEntries(Object.entries(person).map(([k, x]) => [k, x ?? ""])) } as Form : EMPTY));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]));
    try {
      await api(person ? `/delivery-persons/${person.id}` : "/delivery-persons", { method: person ? "PUT" : "POST", body: JSON.stringify(body) });
      toast("success", person ? "Saved." : "Delivery person added.");
      onSaved();
    } catch (e) {
      setErrs(fieldErrors(e));
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={person ? `Edit ${person.name}` : "Add delivery person"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" error={errs.name}><input className="input" value={v.name} onChange={set("name")} /></Field>
        <Field label="Mobile number *" error={errs.phone}><input className="input" type="tel" value={v.phone} onChange={set("phone")} /></Field>
        <Field label="Alternate number" error={errs.alternate_phone}><input className="input" type="tel" value={v.alternate_phone ?? ""} onChange={set("alternate_phone")} /></Field>
        <Field label="Vehicle type" error={errs.vehicle_type}><input className="input" value={v.vehicle_type ?? ""} onChange={set("vehicle_type")} placeholder="Bike, auto, courier…" /></Field>
        <Field label="Vehicle number" error={errs.vehicle_number}><input className="input" value={v.vehicle_number ?? ""} onChange={set("vehicle_number")} /></Field>
        <Field label="Service area" error={errs.service_area}><input className="input" value={v.service_area ?? ""} onChange={set("service_area")} placeholder="Areas or pincodes covered" /></Field>
        <Field label="Notes" error={errs.notes} className="sm:col-span-2"><textarea className="input min-h-16" value={v.notes ?? ""} onChange={set("notes")} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>Save</button>
      </div>
    </Modal>
  );
}

function PersonOrders({ person, onClose }: { person: DeliveryPerson; onClose: () => void }) {
  const api = useAdminApi();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  useEffect(() => {
    api<{ data: { orders: AdminOrder[] } }>(`/delivery-persons/${person.id}`).then((r) => setOrders(r.data.orders)).catch(() => setOrders([]));
  }, [api, person.id]);
  return (
    <Modal title={`Orders – ${person.name}`} onClose={onClose} wide>
      {!orders ? <Spinner /> : orders.length === 0 ? <p className="text-sm text-muted">No orders assigned yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-gold-dark">
                <div><p className="font-medium">{o.order_number} · {o.customer_name}</p><p className="text-xs text-muted">{o.city} {o.pincode} · assigned {formatDate(o.assigned_at)}</p></div>
                <div className="text-right"><Badge tone={STATUS_TONE[o.status]}>{o.status_label}</Badge><p className="text-xs">{formatPrice(+o.total)}</p></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
