"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageOff, ImagePlus, Loader2, Plus, RefreshCw, Shuffle, Star, Trash2, Upload, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import { AVAILABILITY_LABELS, type AdminProduct, type AvailabilityStatus, type Category, type PricingMode, type Settings, type SizePreset, type Variant } from "@/lib/types";
import { CategoryOptions } from "./BulkActions";
import { formatDate, formatPrice } from "@/lib/format";
import { ConfirmDialog, Field, PageHeader, Panel, Spinner, Toggle, useToast } from "./ui";

type VariantRow = Partial<Variant> & { _key: string };
/** An image chosen in the browser, previewed before it is uploaded. */
type PendingImage = { file: File; url: string; colour: string };

/** Same limits as the API (config/shop.php): JPG/PNG/WEBP, ≤ 8 MB, ≥ 300 × 300 px. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_MB = 8;
const IMAGE_MIN_PX = 300;
type FormState = {
  name: string; slug: string; sku: string; category_id: string; short_description: string; description: string;
  pricing_mode: PricingMode; regular_price: string; sale_price: string; currency: string; track_stock: boolean; stock_quantity: string; low_stock_threshold: string;
  material: string; colours: string[]; sizes: string[]; sizes_enabled: boolean; is_featured: boolean; is_best_seller: boolean; is_new_arrival: boolean; is_active: boolean;
  availability_status: AvailabilityStatus; meta_title: string; meta_description: string;
};

const EMPTY: FormState = {
  name: "", slug: "", sku: "", category_id: "", short_description: "", description: "", pricing_mode: "fixed", regular_price: "", sale_price: "", currency: "INR",
  track_stock: true, stock_quantity: "0", low_stock_threshold: "5", material: "", colours: [], sizes: [], sizes_enabled: true,
  is_featured: false, is_best_seller: false, is_new_arrival: true, is_active: true, availability_status: "available", meta_title: "", meta_description: "",
};

const fromProduct = (p: AdminProduct): FormState => ({
  name: p.name, slug: p.slug, sku: p.sku, category_id: p.category_id ? String(p.category_id) : "", short_description: p.short_description ?? "",
  description: p.description ?? "", pricing_mode: p.pricing_mode,
  regular_price: p.regular_price > 0 ? String(p.regular_price) : "", sale_price: p.sale_price != null ? String(p.sale_price) : "",
  currency: p.currency, track_stock: p.track_stock, stock_quantity: String(p.raw_stock_quantity), low_stock_threshold: String(p.low_stock_threshold),
  material: p.material ?? "", colours: p.colours, sizes: p.sizes, sizes_enabled: p.sizes_enabled ?? true, is_featured: p.is_featured, is_best_seller: p.is_best_seller,
  is_new_arrival: p.is_new_arrival, is_active: p.is_active, availability_status: p.availability_status ?? "available",
  meta_title: p.meta_title ?? "", meta_description: p.meta_description ?? "",
});

let keySeq = 0;
const vkey = () => `v${++keySeq}`;

/** Used until Settings load (or if they fail); the real list is editable in Admin → Settings → Size presets. */
const DEFAULT_SIZE_PRESETS: SizePreset[] = [
  { name: "Bangle sizes", sizes: ["2.2", "2.4", "2.6", "2.8", "10"] },
  { name: "Clothing (S – XXL)", sizes: ["S", "M", "L", "XL", "XXL"] },
  { name: "Free size", sizes: ["Free Size"] },
];

const STATUS_HINTS: Record<AvailabilityStatus, string> = {
  available: "Shown normally – Add to Cart and WhatsApp ordering allowed.",
  sold_out: "Stays in the catalogue with a Sold Out badge – ordering is blocked.",
  discontinued: "Marked discontinued – ordering is blocked. All details are kept here.",
};

const PRICING_MODES: { value: PricingMode; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed price", hint: "Customers see one price, e.g. ₹299." },
  { value: "sale", label: "Sale price", hint: "Regular price struck through next to the sale price." },
  { value: "on_request", label: "Price on request", hint: "No price shown – customers enquire on WhatsApp. Stored prices are kept for later." },
];

export default function ProductForm({ productId }: { productId?: number }) {
  const api = useAdminApi();
  const toast = useToast();
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [palette, setPalette] = useState<Settings["colour_swatches"]>([]);
  const [sizePresets, setSizePresets] = useState<SizePreset[]>(DEFAULT_SIZE_PRESETS);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [suggestedSku, setSuggestedSku] = useState("");
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
    api<{ data: Settings }>("/settings").then((r) => {
      setPalette(r.data.colour_swatches ?? []);
      if (r.data.size_presets?.length) setSizePresets(r.data.size_presets);
    }).catch(() => undefined);
    if (!productId) return;
    api<{ data: AdminProduct }>(`/products/${productId}`)
      .then((r) => load(r.data))
      .catch((e) => toast("error", errorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, productId]);

  // New products: show the SKU that will be generated for the chosen category.
  useEffect(() => {
    if (productId) return;
    let cancelled = false;
    api<{ data: { sku: string } }>(`/products/next-sku${form.category_id ? `?category_id=${form.category_id}` : ""}`)
      .then((r) => { if (!cancelled) setSuggestedSku(r.data.sku); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api, productId, form.category_id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const { pricing_mode: mode, ...fields } = form;
    if (mode === "sale" && !form.sale_price) {
      setSaving(false);
      setErrors({ sale_price: "Enter the sale price, or choose Fixed price." });
      return;
    }
    const payload = {
      ...fields,
      sku: form.sku.trim() || null, // empty = generated (OMR-<CATEGORY>-<NUMBER>)
      slug: form.slug || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      price_on_request: mode === "on_request",
      regular_price: form.regular_price || null,
      // On request keeps any stored sale price; fixed clears it.
      ...(mode === "on_request" ? {} : { sale_price: mode === "sale" ? form.sale_price : null }),
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
        saved = await uploadPending(api, saved.id, pendingImages);
        pendingImages.forEach((p) => URL.revokeObjectURL(p.url));
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
        description={product ? `Code ${product.sku}${product.source === "photo_catalogue" ? " · imported from the photo catalogue" : ""} · ${product.views_count} views · updated ${formatDate(product.updated_at)}` : "Fill in the details – you can add images now or later."}
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
              <Field label={productId ? "SKU *" : "SKU"} error={errors.sku}
                hint={productId ? "Letters, numbers, - and _. Variant SKUs are not changed when you edit this." : `Leave empty to generate it automatically${suggestedSku ? ` (${suggestedSku})` : ""}.`}>
                <div className="flex gap-2">
                  <input className="input font-mono" value={form.sku} onChange={(e) => set("sku", e.target.value.replace(/\s+/g, ""))} required={!!productId} placeholder={suggestedSku || "OMR-BG-001"} />
                  {!productId && suggestedSku && (
                    <button type="button" className="btn-outline shrink-0 px-3" title="Use the generated SKU" onClick={() => set("sku", suggestedSku)}><Wand2 className="h-4 w-4" /></button>
                  )}
                </div>
              </Field>
              <Field label="URL slug" error={errors.slug} hint="Auto-generated from the name if empty"><input className="input" value={form.slug} onChange={text("slug")} placeholder="pearl-handmade-bracelet" /></Field>
              <Field label="Category / collection" error={errors.category_id}>
                <select className="input" value={form.category_id} onChange={text("category_id")}>
                  <option value="">Uncategorised</option>
                  <CategoryOptions categories={categories} />
                </select>
              </Field>
              <Field label="Material" error={errors.material}><input className="input" value={form.material} onChange={text("material")} placeholder="e.g. Gold plated brass, freshwater pearls" /></Field>
              <Field label="Short description" error={errors.short_description} className="sm:col-span-2"><textarea className="input min-h-16" maxLength={500} value={form.short_description} onChange={text("short_description")} /></Field>
              <Field label="Full description" error={errors.description} className="sm:col-span-2"><textarea className="input min-h-40" value={form.description} onChange={text("description")} /></Field>
            </div>
          </Panel>

          <Panel title="Images">
            <ImageManager product={product} colours={form.colours} pending={pendingImages} setPending={setPendingImages} onChange={load} />
          </Panel>

          <Panel title="Options & variations">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <TagInput label="Available colours" values={form.colours} onChange={(v) => set("colours", v)} placeholder="Type a colour and press Enter" disabled={variants.length > 0}
                  suggestions={palette.map((c) => c.name)} swatch={(name) => swatchFor(palette, name)} />
                <p className="mt-1 text-xs text-muted">Swatch colours come from <Link href="/admin/settings#colours" className="underline">Settings → Colour swatches</Link>.</p>
              </div>
              <div>
                <TagInput label="Available sizes" values={form.sizes} onChange={(v) => set("sizes", v)} placeholder="e.g. 2.4, M, Free Size" disabled={variants.length > 0} />
                {variants.length === 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sizePresets.map((p) => (
                      <button key={p.name} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-gold" title={p.sizes.join(", ")}
                        onClick={() => set("sizes", [...form.sizes, ...p.sizes.filter((x) => !form.sizes.includes(x))])}>+ {p.name}</button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted">Presets come from <Link href="/admin/settings#sizes" className="underline">Settings → Size presets</Link>. Leave empty for products without sizes.</p>
                {variants.length === 0 && (
                  <div className="mt-3">
                    <Toggle checked={form.sizes_enabled} onChange={(v) => set("sizes_enabled", v)} label="Customers must choose a size" />
                    {!form.sizes_enabled && form.sizes.length > 0 && <p className="mt-1 text-xs text-gold-dark">Size selection is off – the sizes above are kept but not shown to customers.</p>}
                  </div>
                )}
              </div>
            </div>
            <div id="variants" className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Variants (optional)</p>
                  <p className="text-xs text-muted">Use variants when each colour/size combination has its own stock or price. Colours and sizes above are then taken from the variants. Leave a variant SKU empty to generate it (e.g. {product?.sku ?? suggestedSku ?? "OMR-BG-001"}-24-RED).</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {variants.length === 0 && (form.colours.length > 0 || form.sizes.length > 0) && (
                    <button type="button" className="btn-outline px-3 py-1.5 text-xs" title="One variant per colour × size combination"
                      onClick={() => setVariants(combinations(form.colours, form.sizes).map(([colour, size]) => ({ _key: vkey(), colour, size, sku: "", additional_price: 0, stock_quantity: 0, is_active: true })))}>
                      <Shuffle className="h-3.5 w-3.5" /> Create combinations
                    </button>
                  )}
                  <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setVariants((v) => [...v, { _key: vkey(), colour: "", size: "", sku: "", additional_price: 0, stock_quantity: 0, is_active: true }])}><Plus className="h-3.5 w-3.5" /> Add variant</button>
                </div>
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
                            <td className="pr-2"><input className="input py-1.5 font-mono text-xs" value={v.sku ?? ""} placeholder="Auto" onChange={(e) => upd({ sku: e.target.value.replace(/\s+/g, "") })} aria-label="Variant SKU" />{errors[`variants.${i}.sku`] && <p className="mt-0.5 text-[11px] text-rose">{errors[`variants.${i}.sku`]}</p>}</td>
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
              <div role="radiogroup" aria-label="Pricing" className="grid gap-2">
                {PRICING_MODES.map((m) => (
                  <label key={m.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${form.pricing_mode === m.value ? "border-gold bg-cream/60" : "border-line hover:border-gold/60"}`}>
                    <input type="radio" name="pricing_mode" className="mt-0.5 accent-[var(--color-gold-dark)]" checked={form.pricing_mode === m.value} onChange={() => set("pricing_mode", m.value)} />
                    <span><span className="font-medium">{m.label}</span><span className="block text-xs text-muted">{m.hint}</span></span>
                  </label>
                ))}
              </div>
              {form.pricing_mode !== "on_request" ? (
                <>
                  <Field label="Regular price (₹) *" error={errors.regular_price} hint={form.pricing_mode === "sale" ? "Original / MRP – shown struck through" : undefined}><input className="input" type="number" step="0.01" min="0.01" value={form.regular_price} onChange={text("regular_price")} required /></Field>
                  {form.pricing_mode === "sale" && (
                    <Field label="Sale price (₹) *" error={errors.sale_price} hint="Must be lower than the regular price"><input className="input" type="number" step="0.01" min="0.01" value={form.sale_price} onChange={text("sale_price")} required /></Field>
                  )}
                </>
              ) : errors.regular_price ? <p className="text-xs text-rose">{errors.regular_price}</p> : null}
              {product && (
                <p className="rounded-lg bg-cream p-3 text-xs">
                  {product.price_on_request ? <>Customers currently see <strong>Price on Request</strong>.</> : <>Customers currently pay <strong>{formatPrice(product.price)}</strong>{product.offer ? ` (offer: ${product.offer.name})` : ""}.</>}
                </p>
              )}
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

          <Panel title="Availability">
            <div className="space-y-2" role="radiogroup" aria-label="Sold status">
              {(Object.keys(AVAILABILITY_LABELS) as AvailabilityStatus[]).map((k) => (
                <label key={k} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${form.availability_status === k ? "border-gold bg-cream/60" : "border-line hover:border-gold/60"}`}>
                  <input type="radio" name="availability_status" className="mt-0.5 accent-[var(--color-gold-dark)]" checked={form.availability_status === k} onChange={() => set("availability_status", k)} />
                  <span><span className="font-medium">{AVAILABILITY_LABELS[k]}</span><span className="block text-xs text-muted">{STATUS_HINTS[k]}</span></span>
                </label>
              ))}
              <p className="text-xs text-muted">Independent of stock: a made-to-order product without stock tracking stays Available.</p>
            </div>
          </Panel>

          <Panel title="Visibility">
            <div className="space-y-3">
              <Toggle checked={form.is_active} onChange={(v) => set("is_active", v)} label="Enabled (shown on the website, in collections and search)" />
              {!form.is_active && <p className="text-xs text-gold-dark">Disabled – hidden from the website and not orderable. It stays here in the admin.</p>}
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

/** Every colour × size pair (a missing list counts as one empty option). */
function combinations(colours: string[], sizes: string[]): [string, string][] {
  const cs = colours.length ? colours : [""];
  const ss = sizes.length ? sizes : [""];
  return cs.flatMap((c) => ss.map((s) => [c, s] as [string, string]));
}

function swatchFor(palette: Settings["colour_swatches"], name: string): string | null {
  const key = name.trim().toLowerCase();
  const exact = palette.find((c) => c.name.toLowerCase() === key);
  if (exact) return exact.hex;
  // Same rule as the API: longest palette name contained in the colour name.
  const contained = [...palette].sort((a, b) => b.name.length - a.name.length)
    .find((c) => new RegExp(`\\b${c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(key));
  return contained?.hex ?? null;
}

let listSeq = 0;

function TagInput({ label, values, onChange, placeholder, disabled, suggestions, swatch }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean; suggestions?: string[]; swatch?: (v: string) => string | null }) {
  const [v, setV] = useState("");
  const [listId] = useState(() => `tags-${++listSeq}`);
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
            {swatch && <span className="h-3 w-3 rounded-full border border-black/10" style={swatch(x) ? { backgroundColor: swatch(x)! } : { backgroundImage: "repeating-linear-gradient(45deg,#efe6d8 0 2px,#fff 2px 4px)" }} />}
            {x}{!disabled && <button type="button" onClick={() => onChange(values.filter((y) => y !== x))} aria-label={`Remove ${x}`}><X className="h-3 w-3" /></button>}
          </span>
        ))}
        {!disabled && <input className="min-w-28 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none" value={v} placeholder={values.length ? "" : placeholder} list={suggestions?.length ? listId : undefined}
          onChange={(e) => setV(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />}
      </div>
      {suggestions && suggestions.length > 0 && <datalist id={listId}>{suggestions.filter((x) => !values.includes(x)).map((x) => <option key={x} value={x} />)}</datalist>}
      {disabled && <p className="mt-1 text-xs text-muted">Managed by variants below.</p>}
    </div>
  );
}

type AdminApi = ReturnType<typeof useAdminApi>;

/** Upload previewed images – one request per colour (≤ 10 files each), so each image is tagged with its colour. */
async function uploadPending(api: AdminApi, productId: number, pending: PendingImage[]): Promise<AdminProduct> {
  const groups = new Map<string, File[]>();
  pending.forEach((p) => groups.set(p.colour, [...(groups.get(p.colour) ?? []), p.file]));
  let saved: AdminProduct | null = null;
  for (const [colour, files] of groups) {
    for (let i = 0; i < files.length; i += 10) {
      const fd = new FormData();
      files.slice(i, i + 10).forEach((f) => fd.append("images[]", f));
      if (colour) fd.append("colour", colour);
      saved = (await api<{ data: AdminProduct }>(`/products/${productId}/images`, { method: "POST", body: fd })).data;
    }
  }
  return saved!;
}

/** Checked in the browser before previewing (the API checks again): type, file size and dimensions. */
async function checkImage(file: File): Promise<string | null> {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WEBP images can be uploaded.`;
  if (file.size > IMAGE_MAX_MB * 1024 * 1024) return `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB – the limit is ${IMAGE_MAX_MB} MB.`;
  const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
  if (!size) return `${file.name}: this file could not be opened as an image.`;
  if (size.w < IMAGE_MIN_PX || size.h < IMAGE_MIN_PX) return `${file.name}: ${size.w} × ${size.h} px – images must be at least ${IMAGE_MIN_PX} × ${IMAGE_MIN_PX} px.`;
  return null;
}

const MAX_PENDING = 20;

function ImageManager({ product, colours, pending, setPending, onChange }: { product: AdminProduct | null; colours: string[]; pending: PendingImage[]; setPending: (p: PendingImage[]) => void; onChange: (p: AdminProduct) => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [newColour, setNewColour] = useState("");
  const savedColours = product?.colours ?? [];

  const run = async (fn: () => Promise<{ data: AdminProduct }>, msg: string) => {
    setBusy(true);
    try {
      onChange((await fn()).data);
      toast("success", msg);
      return true;
    } catch (e) {
      toast("error", errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Validate and preview; nothing is uploaded until "Upload" (or Save for a new product). */
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const problems: string[] = [];
    const ok: PendingImage[] = [];
    for (const file of Array.from(files)) {
      const err = await checkImage(file);
      if (err) problems.push(err);
      else ok.push({ file, url: URL.createObjectURL(file), colour: colours.includes(newColour) ? newColour : "" });
    }
    const room = Math.max(0, MAX_PENDING - pending.length);
    if (ok.length > room) {
      ok.slice(room).forEach((p) => URL.revokeObjectURL(p.url));
      problems.push(`Only ${MAX_PENDING} images can wait for upload at once – upload these first.`);
    }
    setRejected(problems);
    setPending([...pending, ...ok.slice(0, room)]);
  };

  const discard = (i: number) => {
    URL.revokeObjectURL(pending[i].url);
    setPending(pending.filter((_, j) => j !== i));
  };

  const uploadNow = async () => {
    if (!product || !pending.length) return;
    const count = pending.length;
    const done = await run(async () => ({ data: await uploadPending(api, product.id, pending) }), `${count} image(s) uploaded.`);
    if (done) {
      pending.forEach((p) => URL.revokeObjectURL(p.url));
      setPending([]);
    }
  };

  const replace = async (id: number, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const err = await checkImage(file);
    if (err) return toast("error", err);
    const fd = new FormData();
    fd.append("image", file);
    run(() => api(`/product-images/${id}/replace`, { method: "POST", body: fd }), "Image replaced.");
  };

  const tag = (id: number, colour: string) =>
    run(() => api(`/product-images/${id}`, { method: "PATCH", body: JSON.stringify({ colour: colour || null }) }), colour ? `Image shows ${colour}.` : "Colour removed from image.");

  const move = (id: number, dir: -1 | 1) => {
    if (!product?.images) return;
    const ids = product.images.map((i) => i.id);
    const idx = ids.indexOf(id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(() => api(`/products/${product.id}/images/reorder`, { method: "POST", body: JSON.stringify({ ids }) }), "Order updated.");
  };

  const unsavedColours = product ? pending.some((p) => p.colour && !savedColours.includes(p.colour)) : false;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {product?.images?.map((img, i) => (
          <div key={img.id} className="space-y-1">
            <div className={`group relative aspect-square overflow-hidden rounded-xl border-2 ${img.is_primary ? "border-gold" : "border-line"}`}>
              <StoredImage key={img.url} src={img.url} alt={img.alt_text ?? ""} />
              {img.is_primary && <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium text-white">Primary</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/60 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <div className="flex">
                  <button type="button" disabled={busy || i === 0} onClick={() => move(img.id, -1)} className="rounded px-1.5 text-xs text-white disabled:opacity-30" aria-label="Move left">‹</button>
                  <button type="button" disabled={busy || i === product.images!.length - 1} onClick={() => move(img.id, 1)} className="rounded px-1.5 text-xs text-white disabled:opacity-30" aria-label="Move right">›</button>
                </div>
                <div className="flex">
                  {!img.is_primary && <button type="button" disabled={busy} title="Set as primary" aria-label="Set as primary" onClick={() => run(() => api(`/product-images/${img.id}/primary`, { method: "POST" }), "Primary image set.")} className="rounded p-1 text-white"><Star className="h-3.5 w-3.5" /></button>}
                  <label title="Replace this image" className={`cursor-pointer rounded p-1 text-white ${busy ? "pointer-events-none opacity-40" : ""}`}>
                    <RefreshCw className="h-3.5 w-3.5" /><span className="sr-only">Replace image</span>
                    <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => { replace(img.id, e.target.files); e.target.value = ""; }} />
                  </label>
                  <button type="button" disabled={busy} title="Delete" aria-label="Delete image" onClick={() => run(() => api(`/product-images/${img.id}`, { method: "DELETE" }), "Image deleted.")} className="rounded p-1 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
            {savedColours.length > 0 && (
              <select className="input py-1 text-xs" value={img.colour ?? ""} disabled={busy} onChange={(e) => tag(img.id, e.target.value)} aria-label="Colour shown in this image">
                <option value="">Any colour</option>
                {savedColours.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        ))}
        {pending.map((p, i) => (
          <div key={p.url} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-gold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Preview of ${p.file.name}`} className="h-full w-full object-cover opacity-90" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] text-white">Not uploaded</span>
              <button type="button" onClick={() => discard(i)} className="absolute right-1 top-1 rounded-full bg-ink p-1 text-white" aria-label={`Remove ${p.file.name}`}><X className="h-3 w-3" /></button>
            </div>
            {colours.length > 0 && (
              <select className="input py-1 text-xs" value={p.colour} onChange={(e) => setPending(pending.map((x, j) => (j === i ? { ...x, colour: e.target.value } : x)))} aria-label={`Colour shown in ${p.file.name}`}>
                <option value="">Any colour</option>
                {colours.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sand bg-ivory p-2 text-center text-xs text-muted hover:border-gold">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5 text-gold" />} Add images
          <input type="file" multiple accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {colours.length > 0 && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          New images show colour
          <select className="input w-auto py-1 text-xs" value={newColour} onChange={(e) => setNewColour(e.target.value)}>
            <option value="">Any colour</option>
            {colours.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      {rejected.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose" role="alert">
          {rejected.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      {product && pending.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream/70 p-3">
          <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={uploadNow}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload {pending.length} image{pending.length === 1 ? "" : "s"}
          </button>
          <button type="button" className="btn-outline px-4 py-2 text-sm" disabled={busy} onClick={() => { pending.forEach((p) => URL.revokeObjectURL(p.url)); setPending([]); }}>Discard</button>
          {unsavedColours && <span className="text-xs text-gold-dark">Save the product first – some chosen colours are not saved yet.</span>}
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        JPG, PNG or WEBP, up to {IMAGE_MAX_MB} MB and at least {IMAGE_MIN_PX} × {IMAGE_MIN_PX} px. {product ? "Check the preview, then upload. " : "Images upload when you save the product; the first becomes the primary image. "}
        {colours.length > 0 ? "Tag a photo with a colour and customers see it when they choose that colour." : "Add colours under Options to link photos to colours."}
      </p>
    </div>
  );
}

/** Product image with a visible fallback if the file can't be loaded (missing file, broken storage link, CDN error). */
function StoredImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false); // reset via `key` when the URL changes
  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-ivory p-2 text-center text-[10px] text-muted" title={src ?? undefined}>
        <ImageOff className="h-5 w-5" /> Image unavailable
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
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
                  <td className="capitalize">{h.price_type === "on_request" ? "On request" : h.price_type}</td>
                  <td className="text-muted">{h.old_price ? formatPrice(+h.old_price) : h.price_type === "on_request" ? "On request" : "—"}</td>
                  <td className="font-medium">{h.new_price ? formatPrice(+h.new_price) : h.price_type === "on_request" ? "On request" : "removed"}</td>
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
