"use client";

import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import type { AdminProduct, Category } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { Field, Modal, PageHeader, Panel, Toggle, useToast } from "@/components/admin/ui";

type Row = { product_id: number; name: string; sku: string; category: string | null; old_regular_price: number; new_regular_price: number; old_sale_price: number | null; new_sale_price: number | null; changed: boolean; warnings: string[] };
type Preview = { summary: string; matched: number; will_change: number; rows: Row[] };

const OPS = [
  { v: "increase_percent", l: "Increase by %" },
  { v: "decrease_percent", l: "Decrease by %" },
  { v: "increase_fixed", l: "Increase by ₹ amount" },
  { v: "decrease_fixed", l: "Decrease by ₹ amount" },
  { v: "set_fixed", l: "Set to fixed ₹ price" },
  { v: "clear_sale", l: "Remove sale price" },
];

export default function BulkPricesPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [rule, setRule] = useState({ scope: "category", category_id: "", product_ids: [] as number[], target: "regular", operation: "increase_percent", value: "10", rounding: "none", only_active: false, note: "" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api<{ data: Category[] }>("/categories").then((r) => setCategories(r.data)).catch(() => undefined);
    api<{ data: AdminProduct[] }>("/products?per_page=200&sort=name").then((r) => setProducts(r.data)).catch(() => undefined);
  }, [api]);

  const set = (patch: Partial<typeof rule>) => { setRule((r) => ({ ...r, ...patch })); setPreview(null); };
  const payload = () => ({
    ...rule,
    category_id: rule.scope === "category" ? Number(rule.category_id) || null : null,
    product_ids: rule.scope === "products" ? rule.product_ids : null,
    value: rule.operation === "clear_sale" ? null : rule.value,
    note: rule.note || null,
  });

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview((await api<{ data: Preview }>("/prices/bulk/preview", { method: "POST", body: JSON.stringify(payload()) })).data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/prices/bulk/apply", { method: "POST", body: JSON.stringify({ ...payload(), confirm: true }) });
      toast("success", `${r.message} New prices are live.`);
      setConfirm(false);
      setPreview(null);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const isPercent = rule.operation.endsWith("percent");
  const visibleProducts = products.filter((p) => !filter || `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader title="Bulk Price Update" description="Change many prices at once – for example when material costs change. You will see a preview before anything is saved." />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel title="1. Choose the rule">
          <div className="space-y-4">
            <Field label="Apply to">
              <select className="input" value={rule.scope} onChange={(e) => set({ scope: e.target.value })}>
                <option value="category">A category</option>
                <option value="products">Selected products</option>
                <option value="all">All products</option>
              </select>
            </Field>
            {rule.scope === "category" && (
              <Field label="Category">
                <select className="input" value={rule.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.products_count ?? 0})</option>)}
                </select>
              </Field>
            )}
            {rule.scope === "products" && (
              <div>
                <span className="label">Products ({rule.product_ids.length} selected)</span>
                <input className="input mb-2 py-2" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-line p-2">
                  {visibleProducts.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-cream">
                      <input type="checkbox" className="accent-[var(--color-gold)]" checked={rule.product_ids.includes(p.id)}
                        onChange={(e) => set({ product_ids: e.target.checked ? [...rule.product_ids, p.id] : rule.product_ids.filter((x) => x !== p.id) })} />
                      <span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted">{formatPrice(p.regular_price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Field label="Price to change">
              <select className="input" value={rule.target} onChange={(e) => set({ target: e.target.value })} disabled={rule.operation === "clear_sale"}>
                <option value="regular">Regular (original) price</option>
                <option value="sale">Sale price</option>
                <option value="both">Both regular and sale price</option>
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Change">
                <select className="input" value={rule.operation} onChange={(e) => set({ operation: e.target.value })}>
                  {OPS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              {rule.operation !== "clear_sale" && (
                <Field label={isPercent ? "Percent" : "Amount ₹"}>
                  <input className="input" type="number" min={0} step="0.01" value={rule.value} onChange={(e) => set({ value: e.target.value })} />
                </Field>
              )}
            </div>
            {rule.operation !== "clear_sale" && (
              <Field label="Rounding" hint="Round new prices to clean amounts like ₹549 or ₹550">
                <select className="input" value={rule.rounding} onChange={(e) => set({ rounding: e.target.value })}>
                  <option value="none">No rounding (paise allowed)</option>
                  <option value="1">Nearest ₹1</option>
                  <option value="5">Nearest ₹5</option>
                  <option value="10">Nearest ₹10</option>
                </select>
              </Field>
            )}
            <Toggle checked={rule.only_active} onChange={(v) => set({ only_active: v })} label="Only active products" />
            <Field label="Reason (saved in history)"><input className="input" value={rule.note} onChange={(e) => setRule({ ...rule, note: e.target.value })} placeholder="e.g. Silver rate increase – Nov 2026" /></Field>
            {error && <p className="text-sm text-rose">{error}</p>}
            <button className="btn-primary w-full" onClick={runPreview} disabled={busy}>{busy && !confirm ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Preview changes</button>
          </div>
        </Panel>

        <Panel title="2. Review & confirm" actions={preview && preview.will_change > 0 && <button className="btn-gold" onClick={() => setConfirm(true)}>Apply to {preview.will_change} product(s)</button>}>
          {!preview ? (
            <p className="py-10 text-center text-sm text-muted">Set up a rule and press <strong>Preview changes</strong>. Nothing is saved until you confirm.</p>
          ) : (
            <>
              <p className="mb-3 text-sm"><strong>{preview.summary}</strong> · {preview.matched} matched · {preview.will_change} will change</p>
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-white text-left text-xs uppercase text-muted"><tr><th className="py-2">Product</th><th>Regular</th><th>Sale</th><th /></tr></thead>
                  <tbody className="divide-y divide-line">
                    {preview.rows.map((r) => (
                      <tr key={r.product_id} className={r.changed ? "" : "text-muted"}>
                        <td className="py-2"><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.sku}{r.category ? ` · ${r.category}` : ""}</p></td>
                        <td><Change from={r.old_regular_price} to={r.new_regular_price} /></td>
                        <td><Change from={r.old_sale_price} to={r.new_sale_price} /></td>
                        <td className="max-w-56">{r.warnings.map((w) => <p key={w} className="flex gap-1 text-xs text-gold-dark"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}</p>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>

      {confirm && preview && (
        <Modal title="Confirm bulk price update" onClose={() => setConfirm(false)}>
          <p className="text-sm">You are about to update <strong>{preview.will_change}</strong> product price(s): <strong>{preview.summary}</strong>.</p>
          <p className="mt-2 text-sm text-muted">New prices go live on the store immediately. Every change is recorded in Price History.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
            <button className="btn-gold" onClick={apply} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Yes, update prices</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Change({ from, to }: { from: number | null; to: number | null }) {
  if (from === to) return <span>{from != null ? formatPrice(from) : "—"}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-muted line-through">{from != null ? formatPrice(from) : "—"}</span>
      <ArrowRight className="h-3 w-3 text-muted" />
      <span className={`font-semibold ${to != null && from != null && to > from ? "text-rose" : "text-whatsapp"}`}>{to != null ? formatPrice(to) : "removed"}</span>
    </span>
  );
}
