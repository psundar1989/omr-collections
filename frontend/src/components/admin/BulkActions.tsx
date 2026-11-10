"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import type { Category } from "@/lib/types";
import { ConfirmDialog, Field, Modal, useToast } from "./ui";

/** Bulk actions handled by POST /admin/products/bulk (the server re-validates every id). */
const ACTIONS: { value: string; label: string; group: string; danger?: boolean }[] = [
  { value: "enable", label: "Enable (show on website)", group: "Visibility" },
  { value: "disable", label: "Disable (hide from website)", group: "Visibility" },
  { value: "mark_available", label: "Mark Available", group: "Sold status" },
  { value: "mark_sold_out", label: "Mark Sold Out", group: "Sold status" },
  { value: "mark_discontinued", label: "Mark Discontinued", group: "Sold status" },
  { value: "assign_category", label: "Assign category / collection…", group: "Organise" },
  { value: "feature", label: "Add to Featured", group: "Organise" },
  { value: "unfeature", label: "Remove from Featured", group: "Organise" },
  { value: "best_seller", label: "Add to Best Sellers", group: "Organise" },
  { value: "unbest_seller", label: "Remove from Best Sellers", group: "Organise" },
  { value: "new_arrival", label: "Add to New Arrivals", group: "Organise" },
  { value: "unnew_arrival", label: "Remove from New Arrivals", group: "Organise" },
  { value: "prices", label: "Update prices…", group: "Prices" },
  { value: "delete", label: "Delete products", group: "Danger", danger: true },
];

export default function BulkActions({ ids, categories, onDone, onClear }: { ids: number[]; categories: Category[]; onDone: () => void; onClear: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [action, setAction] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = ACTIONS.find((a) => a.value === action);
  const n = ids.length;

  const start = () => {
    if (!action) return;
    if (action === "prices") return setPricing(true);
    if (action === "assign_category" && !categoryId) return toast("error", "Choose a category first.");
    setConfirming(true);
  };

  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/products/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action, category_id: action === "assign_category" ? Number(categoryId) : undefined, confirm: true }),
      });
      toast("success", r.message);
      setConfirming(false);
      setAction("");
      onDone();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name;

  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/40 bg-cream px-4 py-2.5 text-sm shadow-sm">
      <span className="font-medium">{n} selected</span>
      <select className="input w-auto py-1.5" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Bulk action">
        <option value="">Choose an action…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {ACTIONS.filter((a) => a.group === g).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </optgroup>
        ))}
      </select>
      {action === "assign_category" && (
        <select className="input w-auto py-1.5" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category for selected products">
          <option value="">Category…</option>
          <CategoryOptions categories={categories} />
        </select>
      )}
      <button className="btn-primary px-4 py-1.5" disabled={!action} onClick={start}>Apply</button>
      <button className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={onClear}><X className="h-3.5 w-3.5" /> Clear selection</button>

      {confirming && current && (
        <ConfirmDialog
          title={`${current.label.replace("…", "")} – ${n} product${n === 1 ? "" : "s"}?`}
          danger={!!current.danger}
          confirmLabel={current.danger ? "Delete" : "Apply"}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={run}
          message={
            action === "delete" ? <>The {n} selected product(s) will be removed from the store and the admin list. Tip: <strong>Disable</strong> keeps them in the admin instead.</>
              : action === "assign_category" ? <>Move {n} product(s) to <strong>{categoryName}</strong>?</>
              : <>This changes {n} product(s) immediately on the live website.</>
          }
        />
      )}
      {pricing && <BulkPriceModal ids={ids} onClose={() => setPricing(false)} onDone={() => { setPricing(false); setAction(""); onDone(); }} />}
    </div>
  );
}

/** Categories grouped into photographed collections and other categories. */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  const collections = categories.filter((c) => c.section === "collections");
  const others = categories.filter((c) => c.section !== "collections");
  const opt = (c: Category) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inactive)"}</option>;
  return (
    <>
      {collections.length > 0 && <optgroup label="Photo collections">{collections.map(opt)}</optgroup>}
      {others.length > 0 && <optgroup label="Categories">{others.map(opt)}</optgroup>}
    </>
  );
}

type PreviewRow = { product_id: number; name: string; sku: string; old_regular_price: number; new_regular_price: number; old_sale_price: number | null; new_sale_price: number | null; changed: boolean; warnings: string[] };

/**
 * Bulk price change for the selected products. Uses the existing price rules
 * (PriceManagementService): preview first, then apply – every change is logged in price history.
 */
function BulkPriceModal({ ids, onClose, onDone }: { ids: number[]; onClose: () => void; onDone: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [rule, setRule] = useState({ target: "regular", operation: "set_fixed", value: "", rounding: "none" });
  const [preview, setPreview] = useState<{ will_change: number; rows: PreviewRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const body = () => JSON.stringify({ scope: "products", product_ids: ids, ...rule, value: rule.operation === "clear_sale" ? null : rule.value });
  const set = (k: keyof typeof rule, v: string) => {
    setRule((r) => ({ ...r, [k]: v }));
    setPreview(null);
  };

  const doPreview = async () => {
    setBusy(true);
    try {
      setPreview((await api<{ data: { will_change: number; rows: PreviewRow[] } }>("/prices/bulk/preview", { method: "POST", body: body() })).data);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/prices/bulk/apply", { method: "POST", body: JSON.stringify({ ...JSON.parse(body()), confirm: true }) });
      toast("success", r.message);
      onDone();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Update prices · ${ids.length} product(s)`} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Price">
          <select className="input" value={rule.target} onChange={(e) => set("target", e.target.value)}>
            <option value="regular">Regular price</option>
            <option value="sale">Sale price</option>
            <option value="both">Both</option>
          </select>
        </Field>
        <Field label="Change">
          <select className="input" value={rule.operation} onChange={(e) => set("operation", e.target.value)}>
            <option value="set_fixed">Set to fixed price (₹)</option>
            <option value="increase_percent">Increase by %</option>
            <option value="decrease_percent">Decrease by % (discount)</option>
            <option value="increase_fixed">Increase by ₹</option>
            <option value="decrease_fixed">Decrease by ₹</option>
            <option value="clear_sale">Remove sale price</option>
          </select>
        </Field>
        {rule.operation !== "clear_sale" && (
          <Field label="Value"><input className="input" type="number" min="0" step="0.01" value={rule.value} onChange={(e) => set("value", e.target.value)} /></Field>
        )}
        <Field label="Round to">
          <select className="input" value={rule.rounding} onChange={(e) => set("rounding", e.target.value)}>
            <option value="none">No rounding</option>
            <option value="1">₹1</option>
            <option value="5">₹5</option>
            <option value="10">₹10</option>
          </select>
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted">“Price on request” products only change with <em>Set to fixed price</em> on the regular price, which gives them a real price.</p>

      {preview && (
        <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ivory text-left text-xs text-muted"><tr><th className="px-3 py-2">Product</th><th>Regular</th><th>Sale</th><th>Note</th></tr></thead>
            <tbody className="divide-y divide-line">
              {preview.rows.map((r) => (
                <tr key={r.product_id} className={r.changed ? "" : "text-muted"}>
                  <td className="px-3 py-1.5">{r.name} <span className="text-xs text-muted">{r.sku}</span></td>
                  <td>₹{r.old_regular_price} → <strong>₹{r.new_regular_price}</strong></td>
                  <td>{r.old_sale_price ?? "—"} → {r.new_sale_price ?? "—"}</td>
                  <td className="text-xs text-gold-dark">{r.warnings.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        {!preview ? (
          <button className="btn-primary" disabled={busy || (rule.operation !== "clear_sale" && !rule.value)} onClick={doPreview}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Preview changes</button>
        ) : (
          <button className="btn-primary" disabled={busy || preview.will_change === 0} onClick={apply}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm – update {preview.will_change} price(s)</button>
        )}
      </div>
    </Modal>
  );
}
