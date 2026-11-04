"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import type { AdminProduct, Category, Variant } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/format";
import { ConfirmDialog, Field, PageHeader, Panel, Spinner, Toggle, useToast } from "./ui";

type VariantRow = Partial<Variant> & { _key: string };
type FormState = {
  name: string; slug: string; sku: string; category_id: string; short_description: string; description: string;
  regular_price: string; sale_price: string; currency: string; track_stock: boolean; stock_quantity: string; low_stock_threshold: string;
  material: string; colours: string[]; sizes: string[]; is_featured: boolean; is_best_seller: boolean; is_new_arrival: boolean; is_active: boolean;
  meta_title: string; meta_description: string;
};

const EMPTY: FormState = {
  name: "", slug: "", sku: "", category_id: "", short_description: "", description: "", regular_price: "", sale_price: "", currency: "INR",
  track_stock: true, stock_quantity: "0", low_stock_threshold: "5", material: "", colours: [], sizes: [],
  is_featured: false, is_best_seller: false, is_new_arrival: true, is_active: true, meta_title: "", meta_description: "",
};

const fromProduct = (p: AdminProduct): FormState => ({
  name: p.name, slug: p.slug, sku: p.sku, category_id: p.category_id ? String(p.category_id) : "", short_description: p.short_description ?? "",
  description: p.description ?? "", regular_price: String(p.regular_price), sale_price: p.sale_price != null ? String(p.sale_price) : "",
  currency: p.currency, track_stock: p.track_stock, stock_quantity: String(p.raw_stock_quantity), low_stock_threshold: String(p.low_stock_threshold),
  material: p.material ?? "", colours: p.colours, sizes: p.sizes, is_featured: p.is_featured, is_best_seller: p.is_best_seller,
  is_new_arrival: p.is_new_arrival, is_active: p.is_active, meta_title: p.meta_title ?? "", meta_description: p.meta_description ?? "",
});

let keySeq = 0;
const vkey = () => `v${++keySeq}`;

export default function ProductForm({ productId }: { productId?: number }) {
  const api = useAdminApi();
  const toast = useToast();
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = (p: AdminProduct) => {
    setProduct(p);
    setForm(fromProduct(p));
    setVariants((p.variants ?? []).map((v) => ({ ...v, _key: vkey() })));
  };

  useEffect(() => {
    api<{ data: Category[] }>("/categories").then((r) => setCategories(r.data)).catch(() => undefined);
    if (!productId) return;
    api<{ data: AdminProduct }>(`/products/${productId}`)
      .then((r) => load(r.data))
      .catch((e) => toast("error", errorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, productId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      ...form,
      slug: form.slug || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      sale_price: form.sale_price || null,
      stock_quantity: Number(form.stock_quantity || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      variants: variants.filter((v) => v.colour || v.size).map((v) => ({
        id: v.id, colour: v.colour || null, size: v.size || null, sku: v.sku || null,
        additional_price: Number(v.additional_price || 0), stock_quantity: Number(v.stock_quantity || 0), is_active: v.is_active ?? true,
      })),
    };
    try {
      const r = await api<{ data: AdminProduct }>(productId ? `/products/${productId}` : "/products", { method: productId ? "PUT" : "POST", body: JSON.stringify(payload) });
      let saved = r.data;
      if (pendingImages.length) {
        const fd = new FormData();
        pendingImages.forEach((f) => fd.append("images[]", f));
        saved = (await api<{ data: AdminProduct }>(`/products/${saved.id}/images`, { method: "POST", body: fd })).data;
        setPendingImages([]);
      }
      toast("success", productId ? "Product saved." : "Product created.");
      if (!productId) router.replace(`/admin/products/${saved.id}`);
      else load(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api(`/products/${productId}`, { method: "DELETE" });
    toast("success", "Product deleted.");
    router.replace("/admin/products");
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={save}>
      <PageHeader
        title={productId ? form.name || "Edit product" : "Add product"}
        description={product ? `SKU ${product.sku} · ${product.views_count} views · updated ${formatDate(product.updated_at)}` : "Fill in the details – you can add images now or later."}
        actions={<>
          <Link href="/admin/products" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Back</Link>
          {product && <Link href={`/products/${product.slug}`} target="_blank" className="btn-outline"><ExternalLink className="h-4 w-4" /> View</Link>}
          <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name *" error={errors.name} className="sm:col-span-2"><input className="input" value={form.name} onChange={text("name")} required /></Field>
              <Field label="SKU / product code *" error={errors.sku} hint="Letters, numbers, - and _"><input className="input uppercase" value={form.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} required /></Field>
              <Field label="URL slug" error={errors.slug} hint="Auto-generated from the name if empty"><input className="input" value={form.slug} onChange={text("slug")} placeholder="pearl-handmade-bracelet" /></Field>
              <Field label="Category" error={errors.category_id}>
                <select className="input" value={form.category_id} onChange={text("category_id")}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inactive)"}</option>)}
                </select>
              </Field>
              <Field label="Material" error={errors.material}><input className="input" value={form.material} onChange={text("material")} placeholder="e.g. Gold plated brass, freshwater pearls" /></Field>
              <Field label="Short description" error={errors.short_description} className="sm:col-span-2"><textarea className="input min-h-16" maxLength={500} value={form.short_description} onChange={text("short_description")} /></Field>
              <Field label="Full description" error={errors.description} className="sm:col-span-2"><textarea className="input min-h-40" value={form.description} onChange={text("description")} /></Field>
            </div>
          </Panel>

          <Panel title="Images">
            <ImageManager product={product} pending={pendingImages} setPending={setPendingImages} onChange={load} />
          </Panel>

          <Panel title="Options & variations">
            <div className="grid gap-4 sm:grid-cols-2">
              <TagInput label="Available colours" values={form.colours} onChange={(v) => set("colours", v)} placeholder="Type a colour and press Enter" disabled={variants.length > 0} />
              <TagInput label="Available sizes" values={form.sizes} onChange={(v) => set("sizes", v)} placeholder="e.g. Small, 2.4, Free Size" disabled={variants.length > 0} />
            </div>
            <div id="variants" className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Variants (optional)</p>
                  <p className="text-xs text-muted">Use variants when each colour/size combination has its own stock or price. Colours and sizes above are then taken from the variants.</p>
                </div>
                <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setVariants((v) => [...v, { _key: vkey(), colour: "", size: "", sku: "", additional_price: 0, stock_quantity: 0, is_active: true }])}><Plus className="h-3.5 w-3.5" /> Add variant</button>
              </div>
              {variants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs text-muted"><tr><th className="py-2">Colour</th><th>Size</th><th>Variant SKU</th><th>Extra price (₹)</th><th>Stock</th><th>Active</th><th /></tr></thead>
                    <tbody>
                      {variants.map((v, i) => {
                        const upd = (patch: Partial<VariantRow>) => setVariants((all) => all.map((x) => (x._key === v._key ? { ...x, ...patch } : x)));
                        return (
                          <tr key={v._key}>
                            <td className="py-1 pr-2"><input className="input py-1.5" value={v.colour ?? ""} onChange={(e) => upd({ colour: e.target.value })} aria-label="Variant colour" /></td>
                            <td className="pr-2"><input className="input py-1.5" value={v.size ?? ""} onChange={(e) => upd({ size: e.target.value })} aria-label="Variant size" /></td>
                            <td className="pr-2"><input className="input py-1.5" value={v.sku ?? ""} onChange={(e) => upd({ sku: e.target.value })} aria-label="Variant SKU" /></td>
                            <td className="pr-2"><input className="input w-24 py-1.5" type="number" step="0.01" value={v.additional_price ?? 0} onChange={(e) => upd({ additional_price: e.target.value as unknown as number })} aria-label="Extra price" /></td>
                            <td className="pr-2"><input className="input w-20 py-1.5" type="number" min={0} value={v.stock_quantity ?? 0} onChange={(e) => upd({ stock_quantity: e.target.value as unknown as number })} aria-label="Variant stock" /></td>
                            <td className="pr-2"><Toggle checked={v.is_active ?? true} onChange={(x) => upd({ is_active: x })} label={`Variant ${i + 1} active`} /></td>
                            <td><button type="button" className="rounded-lg p-1.5 text-rose hover:bg-rose/10" onClick={() => setVariants((all) => all.filter((x) => x._key !== v._key))} aria-label="Remove variant"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="SEO (optional)">
            <div className="grid gap-4">
              <Field label="Meta title" error={errors.meta_title}><input className="input" value={form.meta_title} onChange={text("meta_title")} placeholder={form.name} /></Field>
              <Field label="Meta description" error={errors.meta_description}><textarea className="input min-h-16" maxLength={500} value={form.meta_description} onChange={text("meta_description")} placeholder={form.short_description} /></Field>
            </div>
          </Panel>

          {product && <PriceHistory productId={product.id} key={product.updated_at} />}
        </div>

        <div className="space-y-6">
          <Panel title="Pricing">
            <div className="space-y-4">
              <Field label="Regular price (₹) *" error={errors.regular_price} hint="Original / MRP – shown struck through when on sale"><input className="input" type="number" step="0.01" min="0.01" value={form.regular_price} onChange={text("regular_price")} required /></Field>
              <Field label="Sale price (₹)" error={errors.sale_price} hint="Optional – must be lower than the regular price"><input className="input" type="number" step="0.01" min="0.01" value={form.sale_price} onChange={text("sale_price")} /></Field>
              {product && <p className="rounded-lg bg-cream p-3 text-xs">Customers currently pay <strong>{formatPrice(product.price)}</strong>{product.offer ? ` (offer: ${product.offer.name})` : ""}.</p>}
            </div>
          </Panel>

          <Panel title="Stock">
            <div className="space-y-4">
              <Toggle checked={form.track_stock} onChange={(v) => set("track_stock", v)} label="Track stock quantity" />
              {form.track_stock && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" error={errors.stock_quantity} hint={variants.length ? "Sum of variant stock" : undefined}>
                    <input className="input" type="number" min={0} value={variants.length ? variants.reduce((n, v) => n + Number(v.is_active === false ? 0 : v.stock_quantity || 0), 0) : form.stock_quantity} disabled={variants.length > 0} onChange={text("stock_quantity")} />
                  </Field>
                  <Field label="Low-stock alert at" error={errors.low_stock_threshold}><input className="input" type="number" min={0} value={form.low_stock_threshold} onChange={text("low_stock_threshold")} /></Field>
                </div>
              )}
              {!form.track_stock && <p className="text-xs text-muted">Stock not tracked – product is always orderable (good for made-to-order items).</p>}
            </div>
          </Panel>

          <Panel title="Visibility">
            <div className="space-y-3">
              <Toggle checked={form.is_active} onChange={(v) => set("is_active", v)} label="Active (visible on store)" />
              <Toggle checked={form.is_featured} onChange={(v) => set("is_featured", v)} label="Featured" />
              <Toggle checked={form.is_best_seller} onChange={(v) => set("is_best_seller", v)} label="Best seller" />
              <Toggle checked={form.is_new_arrival} onChange={(v) => set("is_new_arrival", v)} label="New arrival" />
            </div>
          </Panel>

          {productId && <button type="button" className="btn w-full border border-rose/30 text-rose hover:bg-rose/5" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Delete product</button>}
        </div>
      </div>

      {confirmDelete && <ConfirmDialog title="Delete product?" message="It will be removed from the store. Price history is kept." onCancel={() => setConfirmDelete(false)} onConfirm={remove} />}
    </form>
  );
}

function TagInput({ label, values, onChange, placeholder, disabled }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean }) {
  const [v, setV] = useState("");
  const add = () => {
    const parts = v.split(",").map((x) => x.trim()).filter(Boolean).filter((x) => !values.includes(x));
    if (parts.length) onChange([...values, ...parts]);
    setV("");
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white p-1.5 ${disabled ? "opacity-60" : ""}`}>
        {values.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs">
            {x}{!disabled && <button type="button" onClick={() => onChange(values.filter((y) => y !== x))} aria-label={`Remove ${x}`}><X className="h-3 w-3" /></button>}
          </span>
        ))}
        {!disabled && <input className="min-w-28 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none" value={v} placeholder={values.length ? "" : placeholder}
          onChange={(e) => setV(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />}
      </div>
      {disabled && <p className="mt-1 text-xs text-muted">Managed by variants below.</p>}
    </div>
  );
}

function ImageManager({ product, pending, setPending, onChange }: { product: AdminProduct | null; pending: File[]; setPending: (f: File[]) => void; onChange: (p: AdminProduct) => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ data: AdminProduct }>, msg: string) => {
    setBusy(true);
    try {
      onChange((await fn()).data);
      toast("success", msg);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    if (!product) return setPending([...pending, ...list].slice(0, 10));
    const fd = new FormData();
    list.forEach((f) => fd.append("images[]", f));
    run(() => api(`/products/${product.id}/images`, { method: "POST", body: fd }), `${list.length} image(s) uploaded.`);
  };

  const move = (id: number, dir: -1 | 1) => {
    if (!product?.images) return;
    const ids = product.images.map((i) => i.id);
    const idx = ids.indexOf(id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(() => api(`/products/${product.id}/images/reorder`, { method: "POST", body: JSON.stringify({ ids }) }), "Order updated.");
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {product?.images?.map((img, i) => (
          <div key={img.id} className={`group relative aspect-square overflow-hidden rounded-xl border-2 ${img.is_primary ? "border-gold" : "border-line"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt_text ?? ""} className="h-full w-full object-cover" />
            {img.is_primary && <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium text-white">Primary</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/60 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <div className="flex">
                <button type="button" disabled={busy || i === 0} onClick={() => move(img.id, -1)} className="rounded px-1.5 text-xs text-white disabled:opacity-30" aria-label="Move left">‹</button>
                <button type="button" disabled={busy || i === product.images!.length - 1} onClick={() => move(img.id, 1)} className="rounded px-1.5 text-xs text-white disabled:opacity-30" aria-label="Move right">›</button>
              </div>
              <div className="flex">
                {!img.is_primary && <button type="button" disabled={busy} title="Set as primary" onClick={() => run(() => api(`/product-images/${img.id}/primary`, { method: "POST" }), "Primary image set.")} className="rounded p-1 text-white"><Star className="h-3.5 w-3.5" /></button>}
                <button type="button" disabled={busy} title="Delete" onClick={() => run(() => api(`/product-images/${img.id}`, { method: "DELETE" }), "Image deleted.")} className="rounded p-1 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {pending.map((f, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-gold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover opacity-80" />
            <button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-ink p-1 text-white" aria-label="Remove"><X className="h-3 w-3" /></button>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sand bg-ivory text-xs text-muted hover:border-gold">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5 text-gold" />} Add images
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">{product ? "JPG, PNG or WEBP up to 5 MB each. Hover an image to set it as primary, reorder or delete." : "Images will upload when you save the product. The first image becomes the primary image."}</p>
    </div>
  );
}

type History = { id: number; price_type: string; old_price: string | null; new_price: string | null; change_source: string; note: string | null; created_at: string; user: { name: string } | null };

function PriceHistory({ productId }: { productId: number }) {
  const api = useAdminApi();
  const [rows, setRows] = useState<History[] | null>(null);
  useEffect(() => {
    api<{ data: History[] }>(`/products/${productId}/price-history`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [api, productId]);
  return (
    <Panel title="Price history">
      {!rows ? <Spinner className="py-6" /> : rows.length === 0 ? <p className="text-sm text-muted">No changes yet.</p> : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Date</th><th>Type</th><th>Previous</th><th>Updated</th><th>By</th><th>Source</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="py-1.5 text-xs">{formatDate(h.created_at)}</td>
                  <td className="capitalize">{h.price_type}</td>
                  <td className="text-muted">{h.old_price ? formatPrice(+h.old_price) : "—"}</td>
                  <td className="font-medium">{h.new_price ? formatPrice(+h.new_price) : "removed"}</td>
                  <td className="text-xs">{h.user?.name ?? "System"}</td>
                  <td className="text-xs text-muted" title={h.note ?? ""}>{h.change_source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
