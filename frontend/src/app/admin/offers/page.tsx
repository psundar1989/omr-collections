"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import type { AdminProduct, Category } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Spinner, Toggle, useToast } from "@/components/admin/ui";

type Offer = { id: number; name: string; description: string | null; discount_percentage: number; starts_at: string | null; ends_at: string | null; is_active: boolean; is_running: boolean; product_ids: number[]; category_ids: number[]; products: { id: number; name: string }[]; categories: { id: number; name: string }[] };

export default function OffersPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [items, setItems] = useState<Offer[] | null>(null);
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const load = useCallback(() => {
    api<{ data: Offer[] }>("/offers").then((r) => setItems(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, toast]);
  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Offers & Discounts" description="Percentage discounts on products or whole categories, with optional start/end dates. Customers always get the better of the sale price or the offer." actions={<button className="btn-primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Create offer</button>} />
      {!items ? <Spinner /> : (
        <div className="space-y-3">
          {items.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose/10 font-semibold text-rose">{o.discount_percentage}%</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{o.name} {o.is_running ? <Badge tone="green">Running</Badge> : o.is_active ? <Badge tone="gold">Scheduled / ended</Badge> : <Badge>Disabled</Badge>}</p>
                <p className="text-xs text-muted">{o.starts_at ? formatDate(o.starts_at) : "Now"} → {o.ends_at ? formatDate(o.ends_at) : "No end date"}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {[...o.categories.map((c) => `Category: ${c.name}`), ...o.products.map((p) => p.name)].join(" · ") || "Not applied to anything yet"}
                </p>
              </div>
              <Toggle checked={o.is_active} label="Enabled" onChange={(v) => api(`/offers/${o.id}`, { method: "PUT", body: JSON.stringify({ is_active: v }) }).then(load).catch((e) => toast("error", errorMessage(e)))} />
              <button className="rounded-lg p-2 hover:bg-cream" onClick={() => setEditing(o)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button className="rounded-lg p-2 text-rose hover:bg-rose/10" onClick={() => setDeleting(o)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="rounded-2xl border border-line bg-white py-12 text-center text-muted">No offers yet.</p>}
        </div>
      )}
      {editing && <OfferModal offer={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <ConfirmDialog title="Delete offer?" message={`“${deleting.name}” will be removed and prices return to normal.`} onCancel={() => setDeleting(null)}
        onConfirm={() => api(`/offers/${deleting.id}`, { method: "DELETE" }).then(() => { setDeleting(null); load(); toast("success", "Offer deleted."); }).catch((e) => toast("error", errorMessage(e)))} />}
    </>
  );
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function OfferModal({ offer, onClose, onSaved }: { offer: Offer | null; onClose: () => void; onSaved: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    name: offer?.name ?? "", description: offer?.description ?? "", discount_percentage: String(offer?.discount_percentage ?? "10"),
    starts_at: toLocalInput(offer?.starts_at ?? null), ends_at: toLocalInput(offer?.ends_at ?? null), is_active: offer?.is_active ?? true,
    category_ids: offer?.category_ids ?? [], product_ids: offer?.product_ids ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Category[] }>("/categories").then((r) => setCategories(r.data)).catch(() => undefined);
    api<{ data: AdminProduct[] }>("/products?per_page=200&sort=name").then((r) => setProducts(r.data)).catch(() => undefined);
  }, [api]);

  const toggleId = (k: "category_ids" | "product_ids", id: number) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null };
      await api(offer ? `/offers/${offer.id}` : "/offers", { method: offer ? "PUT" : "POST", body: JSON.stringify(body) });
      toast("success", "Offer saved.");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast("error", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={offer ? "Edit offer" : "Create offer"} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Offer name *" error={errors.name}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali Sale" required /></Field>
          <Field label="Discount % *" error={errors.discount_percentage}><input className="input" type="number" min={1} max={90} step="0.5" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" error={errors.starts_at}><input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Ends" error={errors.ends_at}><input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
          </div>
          <Field label="Description"><textarea className="input min-h-16" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Enabled" />
        </div>
        <div className="space-y-4">
          <div>
            <span className="label">Apply to categories</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button type="button" key={c.id} onClick={() => toggleId("category_ids", c.id)} className={`chip px-3 py-1 text-xs ${form.category_ids.includes(c.id) ? "border-ink bg-ink text-ivory" : "border-line"}`}>{c.name}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Apply to specific products ({form.product_ids.length})</span>
            <input className="input mb-2 py-2" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-56 overflow-y-auto rounded-xl border border-line p-2">
              {products.filter((p) => !filter || `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase())).map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-cream">
                  <input type="checkbox" className="accent-[var(--color-gold)]" checked={form.product_ids.includes(p.id)} onChange={() => toggleId("product_ids", p.id)} />
                  <span className="truncate">{p.name}</span><span className="ml-auto text-xs text-muted">{p.sku}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save offer</button></div>
      </form>
    </Modal>
  );
}
