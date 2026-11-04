"use client";

import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-sm", disabled && "opacity-50")}>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-whatsapp" : "bg-sand")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose">{error}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-cream" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel, busy }: { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex gap-3">
        <AlertTriangle className={cn("h-6 w-6 shrink-0", danger ? "text-rose" : "text-gold")} />
        <div className="text-sm text-ink/80">{message}</div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={danger ? "btn bg-rose text-white hover:bg-rose/90" : "btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("flex justify-center py-16", className)}><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "gold" | "blue" }) {
  const tones = { neutral: "bg-cream text-ink/70", green: "bg-whatsapp/10 text-whatsapp", red: "bg-rose/10 text-rose", gold: "bg-gold/15 text-gold-dark", blue: "bg-sky-100 text-sky-700" };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

/* ------------------------------------------------------------------ toasts */

type Toast = { id: number; type: "success" | "error"; message: string };
const ToastCtx = createContext<(type: Toast["type"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg", t.type === "success" ? "bg-ink" : "bg-rose")}>
            {t.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function ImagePicker({ current, onPick, label = "Image", aspect = "aspect-square" }: { current?: string | null; onPick: (f: File | null) => void; label?: string; aspect?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? current ?? null;
  return (
    <div>
      <span className="label">{label}</span>
      <label className={cn("relative flex w-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-sand bg-ivory text-xs text-muted hover:border-gold", aspect)}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span>Click to upload</span>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setPreview(f ? URL.createObjectURL(f) : null);
          onPick(f);
        }} />
      </label>
    </div>
  );
}
