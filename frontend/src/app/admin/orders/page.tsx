"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import { STATUS_TONE, downloadWithToken, type AdminOrder, type DeliveryPerson } from "@/lib/admin-orders";
import { PUBLIC_API_URL } from "@/lib/config";
import { cn, formatDate, formatPrice } from "@/lib/format";
import { adminTokenStore } from "@/lib/store";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { Badge, PageHeader, Spinner, useToast } from "@/components/admin/ui";

type Page = { data: AdminOrder[]; current_page: number; last_page: number; total: number; status_counts: Record<OrderStatus, number>; unassigned_open: number };
const TABS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  ...(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] })),
  { key: "all", label: "All" },
];

export default function OrdersPage() {
  const api = useAdminApi();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [data, setData] = useState<Page | null>(null);
  const [people, setPeople] = useState<DeliveryPerson[]>([]);
  const [search, setSearch] = useState(sp.get("search") ?? "");
  const [exporting, setExporting] = useState(false);

  const status = sp.get("status") ?? "open";
  const filterQs = useCallback(() => {
    const q = new URLSearchParams();
    if (status !== "all") q.set("status", status);
    for (const k of ["search", "delivery_person_id", "payment_status", "from", "to"]) {
      const v = sp.get(k);
      if (v) q.set(k, v);
    }
    return q;
  }, [sp, status]);

  const setParam = (updates: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => (v === null || v === "" ? q.delete(k) : q.set(k, v)));
    if (!("page" in updates)) q.delete("page");
    router.replace(`${pathname}?${q.toString()}`);
  };

  useEffect(() => {
    const q = filterQs();
    q.set("page", sp.get("page") ?? "1");
    api<Page>(`/orders?${q.toString()}`).then(setData).catch((e) => toast("error", errorMessage(e)));
  }, [api, filterQs, sp, toast]);

  useEffect(() => {
    api<{ data: DeliveryPerson[] }>("/delivery-persons").then((r) => setPeople(r.data)).catch(() => undefined);
  }, [api]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadWithToken(`${PUBLIC_API_URL}/admin/orders/export?${filterQs().toString()}`, adminTokenStore.get(), `orders-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.status_counts;
  const countFor = (key: string) => {
    if (!counts) return null;
    if (key === "open") return counts.pending + counts.confirmed + counts.packed + counts.out_for_delivery;
    if (key === "all") return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[key as OrderStatus];
  };

  return (
    <>
      <PageHeader title="Orders" description="Every WhatsApp order placed on the website, from placement to delivery" actions={
        <button className="btn-outline" onClick={exportCsv} disabled={exporting}><Download className="h-4 w-4" /> Export CSV</button>
      } />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setParam({ status: t.key === "open" ? null : t.key })}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", status === t.key ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
            {t.label} {countFor(t.key) != null && <span className="ml-1 rounded-full bg-cream px-1.5 text-[11px]">{countFor(t.key)}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <form className="relative min-w-60 flex-1" onSubmit={(e) => { e.preventDefault(); setParam({ search }); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Order no, customer name, phone, city, pincode…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select className="input w-auto" aria-label="Delivery person" value={sp.get("delivery_person_id") ?? ""} onChange={(e) => setParam({ delivery_person_id: e.target.value })}>
          <option value="">All delivery persons</option>
          <option value="none">Not assigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (inactive)"}</option>)}
        </select>
        <select className="input w-auto" aria-label="Payment" value={sp.get("payment_status") ?? ""} onChange={(e) => setParam({ payment_status: e.target.value })}>
          <option value="">Any payment</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
        </select>
        <label className="text-xs text-muted">From<input type="date" className="input mt-0.5 w-auto" value={sp.get("from") ?? ""} onChange={(e) => setParam({ from: e.target.value })} /></label>
        <label className="text-xs text-muted">To<input type="date" className="input mt-0.5 w-auto" value={sp.get("to") ?? ""} onChange={(e) => setParam({ to: e.target.value })} /></label>
      </div>

      {data && data.unassigned_open > 0 && (
        <button onClick={() => setParam({ status: null, delivery_person_id: "none" })} className="mb-4 flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold-dark">
          <UserX className="h-4 w-4" /> {data.unassigned_open} confirmed order{data.unassigned_open > 1 ? "s" : ""} without a delivery person
        </button>
      )}

      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Deliver to</th>
                <th className="px-3 py-3">Items</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">Delivery</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-ivory/60" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-gold-dark" onClick={(e) => e.stopPropagation()}>{o.order_number}</Link>
                    <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                  </td>
                  <td className="px-3 py-3"><p>{o.customer_name}</p><p className="text-xs text-muted">{o.phone}</p></td>
                  <td className="px-3 py-3"><p>{o.city}</p><p className="text-xs text-muted">{o.pincode}</p></td>
                  <td className="px-3 py-3">{o.total_quantity} <span className="text-xs text-muted">({o.items_count} line{o.items_count === 1 ? "" : "s"})</span></td>
                  <td className="px-3 py-3 text-right font-medium">{formatPrice(+o.total)}{o.has_price_on_request && <p className="text-[11px] font-normal text-gold-dark">+ on request</p>}</td>
                  <td className="px-3 py-3"><Badge tone={o.payment_status === "paid" ? "green" : o.payment_status === "refunded" ? "neutral" : "gold"}>{o.payment_status}</Badge></td>
                  <td className="px-3 py-3 text-xs">{o.delivery_person?.name ?? o.courier_name ?? <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3"><Badge tone={STATUS_TONE[o.status]}>{o.status_label}</Badge></td>
                </tr>
              ))}
              {data.data.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted">No orders match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted">Page {data.current_page} of {data.last_page} · {data.total} orders</span>
          <button className="btn-outline px-3 py-1.5" disabled={data.current_page <= 1} onClick={() => setParam({ page: String(data.current_page - 1) })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn-outline px-3 py-1.5" disabled={data.current_page >= data.last_page} onClick={() => setParam({ page: String(data.current_page + 1) })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </>
  );
}
