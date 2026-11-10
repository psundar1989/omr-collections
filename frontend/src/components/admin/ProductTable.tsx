"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import { AVAILABILITY_LABELS, type AdminProduct, type AvailabilityStatus, type Category, type Paginated } from "@/lib/types";
import BulkActions, { CategoryOptions } from "./BulkActions";
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
  const [selected, setSelected] = useState<number[]>([]);
  const qs = sp.toString();

  const load = useCallback(() => {
    const params = new URLSearchParams(qs);
    if (!params.get("per_page")) params.set("per_page", "25");
    if (mode === "stock" && !params.get("sort")) params.set("sort", "stock_asc");
    api<Paginated<AdminProduct>>(`/products?${params}`).then((d) => {
      setData(d);
      setSelected([]);
    }).catch((e) => toast("error", errorMessage(e)));
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
          <input className="input pl-9" placeholder="Search name, SKU or variant SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select className="input w-auto" value={sp.get("category_id") ?? ""} onChange={(e) => setParam("category_id", e.target.value || null)} aria-label="Category">
          <option value="">All categories</option>
          <CategoryOptions categories={categories} />
        </select>
        <select className="input w-auto" value={sp.get("stock") ?? ""} onChange={(e) => setParam("stock", e.target.value || null)} aria-label="Stock">
          <option value="">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        {mode === "products" && (
          <>
            <select className="input w-auto" value={sp.get("section") ?? ""} onChange={(e) => setParam("section", e.target.value || null)} aria-label="Collection group">
              <option value="">All collections</option>
              <option value="collections">Photo collections</option>
              <option value="beads">Trendset beads</option>
              <option value="charms">Signature charms</option>
              <option value="general">Other categories</option>
            </select>
            <select className="input w-auto" value={sp.get("availability") ?? ""} onChange={(e) => setParam("availability", e.target.value || null)} aria-label="Sold status">
              <option value="">Any sold status</option>
              <option value="available">Available</option>
              <option value="sold_out">Sold out</option>
              <option value="discontinued">Discontinued</option>
            </select>
            <select className="input w-auto" value={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value || null)} aria-label="Visibility">
              <option value="">Enabled &amp; disabled</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <select className="input w-auto" value={sp.get("flag") ?? ""} onChange={(e) => setParam("flag", e.target.value || null)} aria-label="Homepage flag">
              <option value="">Any flag</option>
              <option value="featured">Featured</option>
              <option value="best_seller">Best sellers</option>
              <option value="new_arrival">New arrivals</option>
            </select>
            <select className="input w-auto" value={sp.get("pricing") ?? ""} onChange={(e) => setParam("pricing", e.target.value || null)} aria-label="Pricing">
              <option value="">Any pricing</option>
              <option value="fixed">Fixed price</option>
              <option value="sale">On sale</option>
              <option value="on_request">Price on request</option>
            </select>
            <PriceRange key={`${sp.get("min_price")}-${sp.get("max_price")}`} min={sp.get("min_price") ?? ""} max={sp.get("max_price") ?? ""}
              onApply={(min, max) => {
                const p = new URLSearchParams(qs);
                for (const [k, v] of [["min_price", min], ["max_price", max]] as const) { if (v) p.set(k, v); else p.delete(k); }
                p.delete("page");
                router.push(`${pathname}?${p}`);
              }} />
            <select className="input w-auto" value={sp.get("source") ?? ""} onChange={(e) => setParam("source", e.target.value || null)} aria-label="Source">
              <option value="">All sources</option>
              <option value="photo_catalogue">Photo catalogue (imported)</option>
              <option value="manual">Added in admin</option>
            </select>
            <select className="input w-auto" value={sp.get("sort") ?? ""} onChange={(e) => setParam("sort", e.target.value || null)} aria-label="Sort">
              <option value="">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="sku">SKU</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="status">Sold out first</option>
              <option value="updated">Recently updated</option>
            </select>
            <select className="input w-auto" value={sp.get("per_page") ?? "25"} onChange={(e) => setParam("per_page", e.target.value === "25" ? null : e.target.value)} aria-label="Per page">
              {["25", "50", "100", "200"].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </>
        )}
      </div>

      {mode === "products" && selected.length > 0 && (
        <BulkActions ids={selected} categories={categories} onDone={load} onClear={() => setSelected([])} />
      )}

      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                {mode === "products" && (
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-gold-dark)]" aria-label="Select all on this page"
                      checked={data.data.length > 0 && data.data.every((p) => selected.includes(p.id))}
                      onChange={(e) => setSelected(e.target.checked ? data.data.map((p) => p.id) : [])} />
                  </th>
                )}
                <th className="px-4 py-3">Product</th>
                {mode === "products" ? (
                  <>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Colours</th>
                    <th className="px-3 py-3">Sizes</th>
                    <th className="px-3 py-3">Sold status</th>
                    <th className="px-3 py-3">Visibility</th>
                    <th className="px-3 py-3">Flags</th>
                    <th className="px-3 py-3 text-right">Actions</th>
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
                  {mode === "products" && (
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--color-gold-dark)]" aria-label={`Select ${p.name}`} checked={selected.includes(p.id)}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-gold-dark">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-cream" />}
                      <span className="min-w-0">
                        <span className="block max-w-64 truncate font-medium">{p.name}</span>
                        <span className="text-xs text-muted">{p.sku}{mode === "stock" && p.category ? ` · ${p.category.name}` : ""}</span>
                      </span>
                    </Link>
                  </td>
                  {mode === "products" ? (
                    <>
                      <td className="max-w-40 px-3 py-2.5 text-xs">{p.category?.name ?? <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <button className="group text-left" onClick={() => setPricing(p)} title="Edit price">
                          {p.price_on_request ? <span className="font-medium text-gold-dark">On request</span> : <span className="font-medium">{formatPrice(p.price)}</span>}
                          {p.original_price && <span className="ml-1 text-xs text-muted line-through">{formatPrice(p.original_price)}</span>}
                          <Pencil className="ml-1 inline h-3 w-3 text-muted opacity-0 group-hover:opacity-100" />
                          {p.offer && <span className="block text-[11px] text-rose">{p.offer.name}</span>}
                        </button>
                      </td>
                      <td className="px-3 py-2.5"><ListCell values={p.colours} /></td>
                      <td className="px-3 py-2.5">{p.sizes_enabled ? <ListCell values={p.sizes} /> : <Badge>Off</Badge>}</td>
                      <td className="px-3 py-2.5">
                        <select className={`input w-auto py-1 text-xs ${STATUS_TONE[p.availability_status]}`} value={p.availability_status} aria-label={`Sold status: ${p.name}`}
                          onChange={(e) => patch(p, "flags", { availability_status: e.target.value }, `${p.name}: ${AVAILABILITY_LABELS[e.target.value as AvailabilityStatus]}.`)}>
                          {(Object.keys(AVAILABILITY_LABELS) as AvailabilityStatus[]).map((k) => <option key={k} value={k}>{AVAILABILITY_LABELS[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Toggle checked={p.is_active} label={`Enabled: ${p.name}`} onChange={(v) => patch(p, "flags", { is_active: v }, v ? "Product enabled – visible on the website." : "Product disabled – hidden from the website.")} />
                          <span className="text-xs">{p.is_active ? "Enabled" : "Disabled"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <FlagChip on={p.is_featured} label="Featured" onClick={() => patch(p, "flags", { is_featured: !p.is_featured }, "Updated.")} />
                          <FlagChip on={p.is_best_seller} label="Best seller" onClick={() => patch(p, "flags", { is_best_seller: !p.is_best_seller }, "Updated.")} />
                          <FlagChip on={p.is_new_arrival} label="New" onClick={() => patch(p, "flags", { is_new_arrival: !p.is_new_arrival }, "Updated.")} />
                        </div>
                      </td>
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
              {data.data.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-muted">No products match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && (data.meta.last_page > 1 || mode === "products") && data.meta.total > 0 && (
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
          message={<>“{deleting.name}” will be removed from the store and the admin list. Price history is kept. Tip: <strong>disable</strong> it instead if you may sell it again.</>} />
      )}
      {pricing && <PriceModal product={pricing} onClose={() => setPricing(null)} onSaved={(p) => { replaceRow(p); setPricing(null); }} />}
    </>
  );
}

const STATUS_TONE: Record<AvailabilityStatus, string> = {
  available: "text-whatsapp",
  sold_out: "border-ink/40 bg-ink/5 font-medium text-ink",
  discontinued: "bg-sand/40 text-muted",
};

function ListCell({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-xs text-muted">—</span>;
  const shown = values.slice(0, 3);
  return (
    <span className="block max-w-36 text-xs leading-snug" title={values.join(", ")}>
      {shown.join(", ")}{values.length > shown.length && <span className="text-muted"> +{values.length - shown.length}</span>}
    </span>
  );
}

function FlagChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={`${on ? "Remove from" : "Add to"} ${label}`}
      className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-gold bg-gold/15 text-gold-dark" : "border-line text-muted hover:border-gold/60"}`}>
      {label}
    </button>
  );
}

function PriceRange({ min, max, onApply }: { min: string; max: string; onApply: (min: string, max: string) => void }) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); onApply(lo.trim(), hi.trim()); }}>
      <input className="input w-24" type="number" min={0} placeholder="Min ₹" value={lo} onChange={(e) => setLo(e.target.value)} aria-label="Minimum price" />
      <span className="text-muted">–</span>
      <input className="input w-24" type="number" min={0} placeholder="Max ₹" value={hi} onChange={(e) => setHi(e.target.value)} aria-label="Maximum price" />
      <button className="btn-outline px-3 py-2 text-xs">Go</button>
    </form>
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
  const [onRequest, setOnRequest] = useState(product.price_on_request);
  const [regular, setRegular] = useState(product.regular_price > 0 ? String(product.regular_price) : "");
  const [sale, setSale] = useState(product.sale_price != null ? String(product.sale_price) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: AdminProduct }>(`/products/${product.id}/price`, { method: "PATCH", body: JSON.stringify({ price_on_request: onRequest, regular_price: regular || null, sale_price: onRequest ? product.sale_price : sale || null, note: note || null }) });
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
        <Toggle checked={onRequest} onChange={setOnRequest} label="Price on request (hide the price, customers enquire on WhatsApp)" />
        {!onRequest && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Regular / original price (₹)"><input className="input" type="number" step="0.01" min="0.01" value={regular} onChange={(e) => setRegular(e.target.value)} required /></Field>
            <Field label="Sale price (₹)" hint="Leave empty for no sale"><input className="input" type="number" step="0.01" min="0.01" value={sale} onChange={(e) => setSale(e.target.value)} /></Field>
          </div>
        )}
        <Field label="Reason (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Gold rate increase" /></Field>
        {error && <p className="text-sm text-rose">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save price</button></div>
      </form>
    </Modal>
  );
}
