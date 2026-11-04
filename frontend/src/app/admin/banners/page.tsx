"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors, toFormData } from "@/lib/admin-api";
import type { Banner } from "@/lib/types";
import { ConfirmDialog, Field, ImagePicker, Modal, PageHeader, Spinner, Toggle, useToast } from "@/components/admin/ui";

export default function BannersPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [items, setItems] = useState<Banner[] | null>(null);
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [deleting, setDeleting] = useState<Banner | null>(null);

  const load = useCallback(() => {
    api<{ data: Banner[] }>("/banners").then((r) => setItems(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, toast]);
  useEffect(load, [load]);

  const move = async (idx: number, dir: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    const j = idx + dir;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await api("/banners/reorder", { method: "POST", body: JSON.stringify({ ids: next.map((b) => b.id) }) }).catch((e) => toast("error", errorMessage(e)));
  };

  const toggle = async (b: Banner, v: boolean) => {
    await api(`/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ is_active: v }) }).then(load).catch((e) => toast("error", errorMessage(e)));
  };

  return (
    <>
      <PageHeader title="Homepage Banners" description="Hero slides on the homepage. Recommended image size 1600 × 800." actions={<button className="btn-primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add banner</button>} />
      {!items ? <Spinner /> : (
        <div className="space-y-3">
          {items.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-3">
              <div className="flex flex-col">
                <button className="rounded p-0.5 hover:bg-cream disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button className="rounded p-0.5 hover:bg-cream disabled:opacity-20" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.image_url && <img src={b.image_url} alt="" className="h-20 w-40 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.title}</p>
                <p className="line-clamp-1 text-sm text-muted">{b.subtitle}</p>
                {b.button_text && <p className="text-xs text-muted">Button: {b.button_text} → {b.button_link}</p>}
              </div>
              <Toggle checked={b.is_active} onChange={(v) => toggle(b, v)} label="Active" />
              <button className="rounded-lg p-2 hover:bg-cream" onClick={() => setEditing(b)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button className="rounded-lg p-2 text-rose hover:bg-rose/10" onClick={() => setDeleting(b)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="rounded-2xl border border-line bg-white py-12 text-center text-muted">No banners – the homepage shows a default hero using your tagline.</p>}
        </div>
      )}
      {editing && <BannerModal banner={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <ConfirmDialog title="Delete banner?" message={`“${deleting.title}” will be removed.`} onCancel={() => setDeleting(null)}
        onConfirm={() => api(`/banners/${deleting.id}`, { method: "DELETE" }).then(() => { setDeleting(null); load(); toast("success", "Banner deleted."); }).catch((e) => toast("error", errorMessage(e)))} />}
    </>
  );
}

function BannerModal({ banner, onClose, onSaved }: { banner: Banner | null; onClose: () => void; onSaved: () => void }) {
  const api = useAdminApi();
  const toast = useToast();
  const [form, setForm] = useState({ title: banner?.title ?? "", subtitle: banner?.subtitle ?? "", button_text: banner?.button_text ?? "Shop Now", button_link: banner?.button_link ?? "/shop", is_active: banner?.is_active ?? true });
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banner && !image) return setErrors({ image: "Please choose an image." });
    setBusy(true);
    try {
      await api(banner ? `/banners/${banner.id}` : "/banners", { method: "POST", body: toFormData({ ...form, image: image ?? undefined, ...(banner ? { _method: "PUT" } : {}) }) });
      toast("success", "Banner saved.");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast("error", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={banner ? "Edit banner" : "Add banner"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <ImagePicker current={banner?.image_url} onPick={setImage} label="Banner image *" aspect="aspect-[2/1] w-full!" />
        {errors.image && <p className="text-xs text-rose">{errors.image}</p>}
        <Field label="Title *" error={errors.title}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
        <Field label="Subtitle" error={errors.subtitle}><textarea className="input min-h-16" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Button text" error={errors.button_text}><input className="input" value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} /></Field>
          <Field label="Button link" error={errors.button_link} hint="e.g. /shop or /categories/necklaces"><input className="input" value={form.button_link} onChange={(e) => setForm({ ...form, button_link: e.target.value })} /></Field>
        </div>
        <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" />
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}
