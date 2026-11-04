"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import { formatDate, formatPrice } from "@/lib/format";
import { PageHeader, Spinner, useToast } from "@/components/admin/ui";

type H = { id: number; price_type: string; old_price: string | null; new_price: string | null; change_source: string; note: string | null; created_at: string; product: { id: number; name: string; sku: string } | null; user: { name: string } | null };
type Page = { data: H[]; current_page: number; last_page: number; total: number };

export default function PriceHistoryPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [data, setData] = useState<Page | null>(null);

  const load = useCallback(() => {
    api<Page>(`/prices/history?page=${page}${source ? `&source=${source}` : ""}`).then(setData).catch((e) => toast("error", errorMessage(e)));
  }, [api, page, source, toast]);
  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Price History" description="Every price change, who made it and when" actions={
        <select className="input w-auto" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Source">
          <option value="">All sources</option><option value="manual">Manual edit</option><option value="bulk">Bulk update</option><option value="product_form">Product form</option>
        </select>
      } />
      {!data ? <Spinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Date</th><th className="px-3">Product</th><th className="px-3">Type</th><th className="px-3">Previous</th><th className="px-3">Updated</th><th className="px-3">Updated by</th><th className="px-3">Source / note</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">{formatDate(h.created_at)}</td>
                  <td className="px-3">{h.product ? <Link className="hover:text-gold-dark" href={`/admin/products/${h.product.id}`}>{h.product.name} <span className="text-xs text-muted">{h.product.sku}</span></Link> : "—"}</td>
                  <td className="px-3 capitalize">{h.price_type}</td>
                  <td className="px-3 text-muted">{h.old_price ? formatPrice(+h.old_price) : "—"}</td>
                  <td className="px-3 font-medium">{h.new_price ? formatPrice(+h.new_price) : "removed"}</td>
                  <td className="px-3">{h.user?.name ?? "System"}</td>
                  <td className="px-3 text-xs text-muted">{h.change_source}{h.note ? ` · ${h.note}` : ""}</td>
                </tr>
              ))}
              {data.data.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted">No price changes recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data && data.last_page > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button className="btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-muted">Page {data.current_page} of {data.last_page}</span>
          <button className="btn-outline px-3 py-1.5" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
