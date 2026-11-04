"use client";

import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/client-api";
import { WhatsAppIcon } from "@/components/ui/Icons";

const TYPES = ["Bracelet", "Beaded Bracelet", "Necklace", "Earrings", "Anklet", "Gift Hamper", "Rakhi", "Other accessory"];

export default function CustomOrderForm() {
  const [form, setForm] = useState({ customer_name: "", whatsapp_number: "", product_type: "", preferred_colour: "", size: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ url: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const pick = (f: File | null) => {
    if (f && f.size > 5 * 1024 * 1024) return setErrors({ ...errors, reference_image: "Image must be under 5 MB." });
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.customer_name.trim()) errs.customer_name = "Please enter your name.";
    if (!/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test(form.whatsapp_number.trim())) errs.whatsapp_number = "Enter a valid 10-digit Indian mobile number.";
    if (!form.product_type) errs.product_type = "Please choose a product type.";
    if (form.description.trim().length < 5) errs.description = "Please describe what you would like.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const win = window.open("", "_blank");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v.trim() && fd.append(k, v.trim()));
      if (file) fd.append("reference_image", file);
      const r = await apiRequest<{ data: { whatsapp_url: string } }>("/custom-orders", { method: "POST", body: fd });
      setDone({ url: r.data.whatsapp_url });
      if (win) win.location.href = r.data.whatsapp_url;
      else window.location.href = r.data.whatsapp_url;
    } catch (err) {
      win?.close();
      if (err instanceof ApiError) {
        setErrors({ form: err.message, ...Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])) });
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card flex flex-col items-center p-8 text-center sm:p-12">
        <CheckCircle2 className="h-12 w-12 text-whatsapp" strokeWidth={1.4} />
        <h2 className="heading-display mt-4 text-3xl">Request ready!</h2>
        <p className="mt-2 max-w-sm text-muted">WhatsApp should have opened with your request. Please press <strong>Send</strong> in WhatsApp so we receive it.</p>
        <a href={done.url} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-6"><WhatsAppIcon className="h-4 w-4" /> Open WhatsApp again</a>
        <button className="mt-4 text-sm text-gold-dark underline" onClick={() => { setDone(null); setForm({ ...form, description: "" }); pick(null); }}>Send another request</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Your name *" error={errors.customer_name}><input className="input" value={form.customer_name} onChange={set("customer_name")} autoComplete="name" /></F>
        <F label="WhatsApp number *" error={errors.whatsapp_number}><input className="input" value={form.whatsapp_number} onChange={set("whatsapp_number")} inputMode="tel" placeholder="9840465980" autoComplete="tel" /></F>
      </div>
      <F label="Product type *" error={errors.product_type}>
        <select className="input" value={form.product_type} onChange={set("product_type")}>
          <option value="">Choose…</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </F>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Preferred colour"><input className="input" value={form.preferred_colour} onChange={set("preferred_colour")} placeholder="e.g. Maroon & gold" /></F>
        <F label="Size"><input className="input" value={form.size} onChange={set("size")} placeholder="e.g. Wrist 6 inch / 2.6" /></F>
      </div>
      <F label="Customisation details *" error={errors.description}>
        <textarea className="input min-h-32" value={form.description} onChange={set("description")} maxLength={2000} placeholder="Name or letters, occasion, quantity, needed-by date…" />
      </F>
      <div>
        <span className="label">Reference image (optional)</span>
        {preview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Reference" className="h-28 w-28 rounded-xl object-cover" />
            <button type="button" onClick={() => pick(null)} className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sand bg-ivory px-4 py-5 text-sm text-muted hover:border-gold">
            <ImagePlus className="h-5 w-5 text-gold" /> Upload a photo (JPG, PNG, WEBP · max 5 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {errors.reference_image && <p className="mt-1 text-xs text-rose">{errors.reference_image}</p>}
      </div>
      {errors.form && <p className="rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">{errors.form}</p>}
      <button className="btn-whatsapp w-full py-3.5 text-base" disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <WhatsAppIcon className="h-5 w-5" />} Send Request on WhatsApp
      </button>
      <p className="text-center text-xs text-muted">Custom orders are confirmed only after we discuss the details with you on WhatsApp.</p>
    </form>
  );
}

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose">{error}</span>}
    </label>
  );
}
