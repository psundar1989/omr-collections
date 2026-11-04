"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import type { AdminProduct, Category, Paginated } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { Badge, ConfirmDialog, Field, Modal, PageHeader, Spinner, Toggle, useToast } from "./ui";

export default function ProductTable({ mode }: { mode: "products" | "stock" }) {
  const api = useAdminApi();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [data, setData] = useState<Paginated<AdminProduct> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(sp.get("search") ?? "");
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [pricing, setPricing] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const qs = sp.toString();

  const load = useCallback(() => {
    const params = new URLSearchParams(qs);
    if (!params.get("per_page")) params.set("per_page", "25");
    if (mode === "stock" && !params.get("sort")) params.set("sort", "stock_asc");
    api<Paginated<AdminProduct>>(`/products?${params}`).then(setData).catch((e) => toast("error", errorMessage(e)));
  }, [api, qs, mode, toast]);

  useEffect(load, [load]);
  useEffect(() => {
    api<{ data: Category[] }>("/categories").then((r) => setCategories(r.data)).catch(() => undefined);
  }, [api]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(qs);
    if (v) p.set(k, v); else p.delete(k);
    if (k !== "page") p.delete("page");
    router.push(`${pathname}?${p}`);
  };

  const replaceRow = (p: AdminProduct) => setData((d) => (d ? { ...d, data: d.data.map((x) => (x.id === p.id ? p : x)) } : d));

  const patch = async (p: AdminProduct, path: string, body: object, msg: string) => {
    try {
      const r = await api<{ data: AdminProduct }>(`/products/${p.id}/${path}`, { method: "PATCH", body: JSON.stringify(body) });
      replaceRow(r.data);
      toast("success", msg);
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/products/${deleting.id}`, { method: "DELETE" });
      toast("success", `${deleting.name} deleted.`);
      setDeleting(null);
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={mode === "stock" ? "Stock Management" : "Products"}
        description={mode === "stock" ? "Update quantities, track stock and see low-stock warnings. Out-of-stock products cannot be ordered." : "Add, edit and organise your catalogue"}
        actions={mode === "products" && <Link href="/admin/products/new" className="btn-primary"><Plus className="h-4 w-4" /> Add product</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <form className="relative min-w-56 flex-1" onSubmit={(e) => { e.preventDefault(); setParam("search", search.trim() || null); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select className="input w-auto" value={sp.get("category_id") ?? ""} onChange={(e) => setParam("category_id", e.target.value || null)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={sp.get("stock") ?? ""} onChange={(e) => setParam("stock", e.target.value || null)} aria-label="Stock">
          <option value="">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        {mode === "products" && (
          <>
            <select className="input w-auto" value={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value || null)} aria-label="Status">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select className="input w-auto" value={sp.get("flag") ?? ""} onChange={(e) => setParam("flag", e.target.value || null)} aria-label="Collection">
              <option value="">All collections</option>
              <option value="featured">Featured</option>
              <option value="best_seller">Best sellers</option>
              <option value="new_arrival">New arrivals</option>
            </select>
          </>
        )}
      </div>

      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                {mode === "products" ? (
                  <>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Active</th>
                    <th className="px-3 py-3">Featured</th>
                    <th className="px-3 py-3">Best seller</th>
                    <th className="px-3 py-3">New</th>
                    <th className="px-3 py-3" />
                  </>
                ) : (
                  <>
                    <th className="px-3 py-3">Track stock</th>
                    <th className="px-3 py-3">Quantity</th>
                    <th className="px-3 py-3">Low-stock alert at</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((p) => (
                <tr key={p.id} className={p.is_active ? "" : "bg-ivory/70 text-muted"}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-gold-dark">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-cream" />}
                      <span className="min-w-0">
                        <span className="block max-w-64 truncate font-medium">{p.name}</span>
                        <span className="text-xs text-muted">{p.sku}{p.category ? ` · ${p.category.name}` : ""}</span>
                      </span>
                    </Link>
                  </td>
                  {mode === "products" ? (
                    <>
                      <td className="px-3 py-2.5">
                        <button className="group text-left" onClick={() => setPricing(p)} title="Edit price">
                          <span className="font-medium">{formatPrice(p.price)}</span>
                          {p.original_price && <span className="ml-1 text-xs text-muted line-through">{formatPrice(p.original_price)}</span>}
                          <Pencil className="ml-1 inline h-3 w-3 text-muted opacity-0 group-hover:opacity-100" />
                          {p.offer && <span className="block text-[11px] text-rose">{p.offer.name}</span>}
                        </button>
                      </td>
                      <td className="px-3 py-2.5"><StockBadge p={p} /></td>
                      <td className="px-3 py-2.5"><Toggle checked={p.is_active} label={`Active: ${p.name}`} onChange={(v) => patch(p, "flags", { is_active: v }, v ? "Product activated." : "Product hidden from store.")} /></td>
                      <td className="px-3 py-2.5"><Toggle checked={p.is_featured} label={`Featured: ${p.name}`} onChange={(v) => patch(p, "flags", { is_featured: v }, "Updated.")} /></td>
                      <td className="px-3 py-2.5"><Toggle checked={p.is_best_seller} label={`Best seller: ${p.name}`} onChange={(v) => patch(p, "flags", { is_best_seller: v }, "Updated.")} /></td>
                      <td className="px-3 py-2.5"><Toggle checked={p.is_new_arrival} label={`New arrival: ${p.name}`} onChange={(v) => patch(p, "flags", { is_new_arrival: v }, "Updated.")} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/products/${p.id}`} className="rounded-lg p-2 hover:bg-cream" aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Link>
                          <button className="rounded-lg p-2 text-rose hover:bg-rose/10" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <StockCells key={`${p.raw_stock_quantity}-${p.low_stock_threshold}`} p={p} onSave={(body, msg) => patch(p, "stock", body, msg)} />
                  )}
                </tr>
              ))}
              {data.data.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">No products match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{data.meta.from}–{data.meta.to} of {data.meta.total}</span>
          <div className="flex gap-1">
            <button className="btn-outline px-3 py-1.5" disabled={data.meta.current_page <= 1} onClick={() => setParam("page", String(data.meta.current_page - 1))} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button className="btn-outline px-3 py-1.5" disabled={data.meta.current_page >= data.meta.last_page} onClick={() => setParam("page", String(data.meta.current_page + 1))} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog title="Delete product?" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove}
          message={<>“{deleting.name}” will be removed from the store. Price history is kept. Tip: switch it to inactive instead if you may sell it again.</>} />
      )}
      {pricing && <PriceModal product={pricing} onClose={() => setPricing(null)} onSaved={(p) => { replaceRow(p); setPricing(null); }} />}
    </>
  );
}

function StockBadge({ p }: { p: AdminProduct }) {
  if (!p.track_stock) return <Badge tone="blue">Not tracked</Badge>;
  if (p.raw_stock_quantity <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (p.is_low_stock) return <Badge tone="gold">Low · {p.raw_stock_quantity}</Badge>;
  return <Badge tone="green">{p.raw_stock_quantity}</Badge>;
}

function StockCells({ p, onSave }: { p: AdminProduct; onSave: (body: object, msg: string) => Promise<void> }) {
  const [qty, setQty] = useState(String(p.raw_stock_quantity));
  const [low, setLow] = useState(String(p.low_stock_threshold));
  const variantManaged = p.has_variants;
  const dirty = qty !== String(p.raw_stock_quantity) || low !== String(p.low_stock_threshold);

  return (
    <>
      <td className="px-3 py-2.5"><Toggle checked={p.track_stock} label={`Track stock: ${p.name}`} onChange={(v) => onSave({ track_stock: v }, v ? "Stock tracking on." : "Stock tracking off – always orderable.")} /></td>
      <td className="px-3 py-2.5">
        {variantManaged ? (
          <Link href={`/admin/products/${p.id}#variants`} className="text-xs text-gold-dark underline">{p.raw_stock_quantity} (per variant)</Link>
        ) : (
          <input className="input w-24 py-1.5" type="number" min={0} value={qty} disabled={!p.track_stock} onChange={(e) => setQty(e.target.value)} aria-label={`Quantity for ${p.name}`} />
        )}
      </td>
      <td className="px-3 py-2.5"><input className="input w-20 py-1.5" type="number" min={0} value={low} onChange={(e) => setLow(e.target.value)} aria-label={`Low stock threshold for ${p.name}`} /></td>
      <td className="px-3 py-2.5"><StockBadge p={p} /></td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-2">
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={!dirty}
            onClick={() => onSave(variantManaged ? { low_stock_threshold: +low } : { stock_quantity: +qty, low_stock_threshold: +low }, "Stock updated.")}>Save</button>
          <button className="btn-outline px-3 py-1.5 text-xs" disabled={p.track_stock && p.raw_stock_quantity <= 0}
            onClick={() => onSave({ mark_out_of_stock: true }, "Marked out of stock.")}>Mark sold out</button>
        </div>
      </td>
    </>
  );
}

export function PriceModal({ product, onClose, onSaved }: { product: AdminProduct; onClose: () => void; onSaved: (p: AdminProduct) => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [regular, setRegular] = useState(String(product.regular_price));
  const [sale, setSale] = useState(product.sale_price != null ? String(product.sale_price) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: AdminProduct }>(`/products/${product.id}/price`, { method: "PATCH", body: JSON.stringify({ regular_price: regular, sale_price: sale || null, note: note || null }) });
      toast("success", "Price updated – live on the store now.");
      onSaved(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit price · ${product.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Regular / original price (₹)"><input className="input" type="number" step="0.01" min="0.01" value={regular} onChange={(e) => setRegular(e.target.value)} required /></Field>
          <Field label="Sale price (₹)" hint="Leave empty for no sale"><input className="input" type="number" step="0.01" min="0.01" value={sale} onChange={(e) => setSale(e.target.value)} /></Field>
        </div>
        <Field label="Reason (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Gold rate increase" /></Field>
        {error && <p className="text-sm text-rose">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save price</button></div>
      </form>
    </Modal>
  );
}
