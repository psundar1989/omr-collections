"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors, toFormData } from "@/lib/admin-api";
import type { Category, CategorySection } from "@/lib/types";

const SECTIONS: { value: CategorySection | ""; label: string }[] = [
  { value: "", label: "Shop by Category (general)" },
  { value: "beads", label: "Trendset Beads Collection" },
  { value: "charms", label: "Signature Charms Hub" },
];
import { Badge, ConfirmDialog, Field, ImagePicker, Modal, PageHeader, Spinner, Toggle, useToast } from "@/components/admin/ui";

export default function CategoriesPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [items, setItems] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const load = useCallback(() => {
    api<{ data: Category[] }>("/categories").then((r) => setItems(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, toast]);
  useEffect(load, [load]);

  const move = async (idx: number, dir: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try {
      const r = await api<{ data: Category[] }>("/categories/reorder", { method: "POST", body: JSON.stringify({ ids: next.map((c) => c.id) }) });
      setItems(r.data);
    } catch (e) {
      toast("error", errorMessage(e));
      load();
    }
  };

  const toggle = async (c: Category, is_active: boolean) => {
    try {
      await api(`/categories/${c.id}`, { method: "PUT", body: JSON.stringify({ is_active }) });
      load();
      toast("success", is_active ? "Category shown on store." : "Category hidden – its products are hidden too.");
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/categories/${deleting.id}`, { method: "DELETE" });
      toast("success", "Category deleted.");
      setDeleting(null);
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Categories" description="Use the arrows to change the order shown on the store" actions={<button className="btn-primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add category</button>} />
      {!items ? <Spinner /> : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <ul className="divide-y divide-line">
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button className="rounded p-0.5 hover:bg-cream disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 hover:bg-cream disabled:opacity-20" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image_url ? <img src={c.image_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="h-11 w-11 rounded-full bg-cream" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name} {c.section && <Badge>{c.section === "beads" ? "Beads" : "Charms"}</Badge>} {!c.is_active && <Badge tone="red">Hidden</Badge>}</p>
                  <p className="truncate text-xs text-muted">/{c.slug} · {c.products_count ?? 0} products</p>
                </div>
                <Toggle checked={c.is_active} onChange={(v) => toggle(c, v)} label={`Active: ${c.name}`} />
                <button className="rounded-lg p-2 hover:bg-cream" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-rose hover:bg-rose/10" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {items.length === 0 && <li className="py-12 text-center text-muted">No categories yet.</li>}
          </ul>
        </div>
      )}
      {editing && <CategoryModal category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <ConfirmDialog title="Delete category?" onCancel={() => setDeleting(null)} onConfirm={remove}
        message={<>“{deleting.name}” will be deleted. Its {deleting.products_count ?? 0} product(s) will stay but become uncategorised.</>} />}
    </>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [form, setForm] = useState({ name: category?.name ?? "", slug: category?.slug ?? "", description: category?.description ?? "", section: (category?.section ?? "") as CategorySection | "", is_active: category?.is_active ?? true });
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = toFormData({ ...form, slug: form.slug || undefined, image: image ?? undefined, ...(category ? { _method: "PUT" } : {}) });
      await api(category ? `/categories/${category.id}` : "/categories", { method: "POST", body: fd });
      toast("success", "Category saved.");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast("error", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={category ? "Edit category" : "Add category"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Name *" error={errors.name}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="URL slug" error={errors.slug} hint="Leave empty to generate from the name"><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Description" error={errors.description}><textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Homepage section" error={errors.section} hint="Which homepage collection this category appears in">
          <select className="input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as CategorySection | "" })}>
            {SECTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <ImagePicker current={category?.image_url} onPick={setImage} label="Category image" />
        {errors.image && <p className="text-xs text-rose">{errors.image}</p>}
        <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" />
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}
