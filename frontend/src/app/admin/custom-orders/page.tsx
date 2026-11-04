"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import { formatDate, whatsappLink } from "@/lib/format";
import { Badge, PageHeader, Spinner, useToast } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/ui/Icons";

type CO = { id: number; customer_name: string; whatsapp_number: string; product_type: string; preferred_colour: string | null; size: string | null; description: string; reference_image_url: string | null; status: string; admin_notes: string | null; created_at: string };
const STATUSES = ["new", "contacted", "completed", "cancelled"];
const TONE: Record<string, "gold" | "blue" | "green" | "neutral"> = { new: "gold", contacted: "blue", completed: "green", cancelled: "neutral" };

export default function CustomOrdersPage() {
  const api = useAdminApi();
  const toast = useToast();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [items, setItems] = useState<CO[] | null>(null);

  const load = useCallback(() => {
    api<{ data: CO[] }>(`/custom-orders${status ? `?status=${status}` : ""}`).then((r) => setItems(r.data)).catch((e) => toast("error", errorMessage(e)));
  }, [api, status, toast]);
  useEffect(load, [load]);

  const update = async (o: CO, body: Partial<CO>) => {
    try {
      const r = await api<{ data: CO }>(`/custom-orders/${o.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setItems((all) => all?.map((x) => (x.id === o.id ? r.data : x)) ?? null);
      toast("success", "Updated.");
    } catch (e) {
      toast("error", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Custom Order Requests" description="Requests submitted from the Custom Order page (also sent to your WhatsApp)" actions={
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      } />
      {!items ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((o) => (
            <div key={o.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">CO-{String(o.id).padStart(5, "0")} · {o.customer_name}</p>
                  <p className="text-xs text-muted">{formatDate(o.created_at)} · {o.whatsapp_number}</p>
                </div>
                <Badge tone={TONE[o.status]}>{o.status}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted">Type</dt><dd>{o.product_type}</dd></div>
                <div><dt className="text-muted">Colour</dt><dd>{o.preferred_colour || "—"}</dd></div>
                <div><dt className="text-muted">Size</dt><dd>{o.size || "—"}</dd></div>
              </dl>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-ivory p-3 text-sm">{o.description}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.reference_image_url && <a href={o.reference_image_url} target="_blank" rel="noopener noreferrer"><img src={o.reference_image_url} alt="Reference" className="mt-3 h-24 w-24 rounded-xl object-cover" /></a>}
              <textarea className="input mt-3 min-h-14 text-xs" placeholder="Private notes (price quoted, delivery date…)" defaultValue={o.admin_notes ?? ""}
                onBlur={(e) => e.target.value !== (o.admin_notes ?? "") && update(o, { admin_notes: e.target.value })} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="input w-auto py-1.5 text-xs capitalize" value={o.status} onChange={(e) => update(o, { status: e.target.value })} aria-label="Status">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <a className="btn-whatsapp px-3 py-1.5 text-xs" target="_blank" rel="noopener noreferrer"
                  href={whatsappLink(o.whatsapp_number, `Hello ${o.customer_name}! Thank you for your custom order request (CO-${String(o.id).padStart(5, "0")}).`)}>
                  <WhatsAppIcon className="h-3.5 w-3.5" /> Reply on WhatsApp
                </a>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="rounded-2xl border border-line bg-white py-12 text-center text-muted lg:col-span-2">No requests.</p>}
        </div>
      )}
    </>
  );
}
