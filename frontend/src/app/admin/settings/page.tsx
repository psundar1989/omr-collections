"use client";

import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminApi, errorMessage, fieldErrors } from "@/lib/admin-api";
import type { Settings, Testimonial } from "@/lib/types";
import { whatsappLink } from "@/lib/format";
import { Field, PageHeader, Panel, Spinner, useToast } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/ui/Icons";

const TEXT_FIELDS: { k: keyof Settings; label: string; hint?: string; area?: boolean; wide?: boolean }[] = [
  { k: "business_name", label: "Business name *" },
  { k: "tagline", label: "Tagline / hero heading" },
  { k: "hero_description", label: "Short business description", area: true, wide: true },
  { k: "announcement_text", label: "Announcement bar text", wide: true },
  { k: "contact_email", label: "Contact email" },
  { k: "phone_number", label: "Phone number" },
  { k: "business_address", label: "Business address", area: true, wide: true },
  { k: "footer_description", label: "Footer description", area: true, wide: true },
  { k: "price_note", label: "Price note", hint: "Shown under prices, e.g. “Inclusive of all taxes”" },
  { k: "free_shipping_threshold", label: "Free shipping above (₹)", hint: "Shown in ‘Why choose us’. Leave empty to hide." },
  { k: "order_disclaimer", label: "Order disclaimer", area: true, wide: true, hint: "Shown on product and cart pages" },
  { k: "meta_description", label: "Default SEO description", area: true, wide: true },
];

export default function SettingsPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Settings }>("/settings").then((r) => setS(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, toast]);

  if (!s) return <Spinner />;
  const set = (k: keyof Settings, v: unknown) => setS({ ...s, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { logo_url, favicon_url, ...payload } = s;
      const r = await api<{ data: Settings }>("/settings", { method: "PUT", body: JSON.stringify(payload) });
      setS(r.data);
      toast("success", "Settings saved – live on the website now.");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast("error", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (type: "logo" | "favicon" | "media", file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    try {
      const r = await api<{ data: { url: string; settings: Settings } }>("/settings/upload", { method: "POST", body: fd });
      if (type !== "media") setS((cur) => (cur ? { ...cur, logo_url: r.data.settings.logo_url, favicon_url: r.data.settings.favicon_url } : cur));
      toast("success", "Uploaded.");
      return r.data.url;
    } catch (e) {
      toast("error", errorMessage(e));
      return null;
    }
  };

  return (
    <form onSubmit={save}>
      <PageHeader title="Website Settings" description="Business details used across the website" actions={<button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save settings</button>} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="WhatsApp ordering">
            <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="WhatsApp number *" error={errors.whatsapp_number} hint="With country code, digits only – e.g. 919876543210. A 10-digit number gets +91 added automatically.">
                <input className="input" value={s.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} inputMode="tel" />
              </Field>
              <a href={whatsappLink(s.whatsapp_number, "Test message from website settings")} target="_blank" rel="noopener noreferrer" className="btn-whatsapp"><WhatsAppIcon className="h-4 w-4" /> Test</a>
            </div>
            <p className="mt-2 text-xs text-muted">All order buttons, the floating chat button and custom-order requests use this number.</p>
          </Panel>

          <Panel title="Business details">
            <div className="grid gap-4 sm:grid-cols-2">
              {TEXT_FIELDS.map(({ k, label, hint, area, wide }) => (
                <Field key={k} label={label} hint={hint} error={errors[k]} className={wide ? "sm:col-span-2" : ""}>
                  {area ? <textarea className="input min-h-16" value={(s[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
                    : <input className="input" value={(s[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />}
                </Field>
              ))}
              <Field label="Currency code" error={errors.currency}><input className="input" value={s.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
              <Field label="Currency symbol" error={errors.currency_symbol}><input className="input" value={s.currency_symbol} onChange={(e) => set("currency_symbol", e.target.value)} /></Field>
            </div>
          </Panel>

          <Panel title="Social media">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["instagram_url", "facebook_url", "youtube_url", "pinterest_url"] as const).map((k) => (
                <Field key={k} label={k.replace("_url", "").replace(/^./, (c) => c.toUpperCase()) + " URL"} error={errors[k]}>
                  <input className="input" type="url" value={s[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} placeholder="https://" />
                </Field>
              ))}
            </div>
          </Panel>

          <Panel title="Testimonials" actions={<button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => set("testimonials", [...s.testimonials, { name: "", location: "", text: "", rating: 5 }])}><Plus className="h-3.5 w-3.5" /> Add</button>}>
            <div className="space-y-3">
              {s.testimonials.map((t, i) => {
                const upd = (patch: Partial<Testimonial>) => set("testimonials", s.testimonials.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_90px_auto]">
                    <input className="input py-2" placeholder="Name" value={t.name} onChange={(e) => upd({ name: e.target.value })} />
                    <input className="input py-2" placeholder="City" value={t.location ?? ""} onChange={(e) => upd({ location: e.target.value })} />
                    <select className="input py-2" value={t.rating ?? 5} onChange={(e) => upd({ rating: +e.target.value })} aria-label="Rating">{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}</select>
                    <button type="button" className="rounded-lg p-2 text-rose hover:bg-rose/10" onClick={() => set("testimonials", s.testimonials.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                    <textarea className="input min-h-14 py-2 sm:col-span-4" placeholder="What did they say?" value={t.text} onChange={(e) => upd({ text: e.target.value })} />
                  </div>
                );
              })}
              {s.testimonials.length === 0 && <p className="text-sm text-muted">No testimonials – the section is hidden on the homepage.</p>}
              {Object.keys(errors).some((k) => k.startsWith("testimonials")) && <p className="text-xs text-rose">Each testimonial needs a name and text.</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Logo & favicon">
            <div className="space-y-5">
              <UploadBox label="Logo" url={s.logo_url} onFile={(f) => upload("logo", f)} hint="PNG/SVG with transparent background, ~300 × 100" />
              <UploadBox label="Favicon" url={s.favicon_url} onFile={(f) => upload("favicon", f)} hint="Square PNG or ICO, 64 × 64" small />
            </div>
          </Panel>

          <Panel title="Acrylic Beads Gallery (homepage, up to 12 photos)" actions={
            <label className="btn-outline cursor-pointer px-3 py-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Add photo
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const url = await upload("media", f);
                if (url) setS((cur) => (cur ? { ...cur, instagram_images: [...cur.instagram_images, { image_url: url, link: cur.instagram_url ?? "" }] } : cur));
              }} />
            </label>
          }>
            <div className="grid grid-cols-3 gap-2">
              {s.instagram_images.map((img, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => set("instagram_images", s.instagram_images.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white" aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Up to 6 shown. Without photos, the homepage shows product images. Remember to save.</p>
          </Panel>

          <ChangePassword />
        </div>
      </div>
    </form>
  );
}

function UploadBox({ label, url, onFile, hint, small }: { label: string; url: string | null; onFile: (f: File) => void; hint: string; small?: boolean }) {
  return (
    <div>
      <span className="label">{label}</span>
      <label className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-sand bg-ivory hover:border-gold ${small ? "h-16 w-16" : "h-24 w-full"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain p-2" /> : <Upload className="h-5 w-5 text-muted" />}
        <input type="file" accept="image/*,.ico" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </label>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function ChangePassword() {
  const api = useAdminApi();
  const toast = useToast();
  const [f, setF] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api("/change-password", { method: "POST", body: JSON.stringify(f) });
      toast("success", "Password changed.");
      setF({ current_password: "", password: "", password_confirmation: "" });
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Change admin password">
      <div className="space-y-3">
        <input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
        <input className="input" type="password" placeholder="New password (min 8)" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input className="input" type="password" placeholder="Confirm new password" autoComplete="new-password" value={f.password_confirmation} onChange={(e) => setF({ ...f, password_confirmation: e.target.value })} />
        <button type="button" className="btn-outline w-full" disabled={busy || !f.current_password || !f.password} onClick={submit}>Update password</button>
      </div>
    </Panel>
  );
}
