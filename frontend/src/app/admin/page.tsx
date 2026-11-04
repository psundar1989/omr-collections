"use client";

import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, FolderTree, Package, PackageX, Percent, Sparkles, Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminApi, errorMessage } from "@/lib/admin-api";
import type { AdminProduct } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, PageHeader, Panel, Spinner } from "@/components/admin/ui";

type Dash = {
  stats: Record<string, number>;
  low_stock: AdminProduct[];
  out_of_stock: AdminProduct[];
  best_sellers: AdminProduct[];
  most_viewed: AdminProduct[];
  recent_updates: AdminProduct[];
  recent_price_changes: { id: number; price_type: string; old_price: string | null; new_price: string | null; change_source: string; created_at: string; product: { id: number; name: string; sku: string } | null; user: { name: string } | null }[];
};

export default function Dashboard() {
  const api = useAdminApi();
  const [d, setD] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Dash }>("/dashboard").then((r) => setD(r.data)).catch((e) => setError(errorMessage(e)));
  }, [api]);

  if (error) return <p className="text-rose">{error}</p>;
  if (!d) return <Spinner />;
  const s = d.stats;

  const cards = [
    { label: "Total products", value: s.total_products, icon: Package, href: "/admin/products" },
    { label: "Active products", value: s.active_products, icon: CheckCircle2, href: "/admin/products?status=active" },
    { label: "Out of stock", value: s.out_of_stock_products, icon: PackageX, href: "/admin/stock?stock=out_of_stock", tone: s.out_of_stock_products ? "text-rose" : "" },
    { label: "Low stock", value: s.low_stock_products, icon: AlertTriangle, href: "/admin/stock?stock=low_stock", tone: s.low_stock_products ? "text-gold-dark" : "" },
    { label: "Categories", value: s.total_categories, icon: FolderTree, href: "/admin/categories" },
    { label: "Featured", value: s.featured_products, icon: Star, href: "/admin/products?flag=featured" },
    { label: "Best sellers", value: s.best_seller_products, icon: TrendingUp, href: "/admin/products?flag=best_seller" },
    { label: "Running offers", value: s.running_offers, icon: Percent, href: "/admin/offers" },
    { label: "New custom requests", value: s.new_custom_orders, icon: Sparkles, href: "/admin/custom-orders?status=new" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your store" actions={<Link href="/admin/products/new" className="btn-primary">Add product</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, href, tone }) => (
          <Link key={label} href={href} className="rounded-2xl border border-line bg-white p-4 transition hover:border-gold">
            <Icon className={`h-5 w-5 text-muted ${tone ?? ""}`} />
            <p className={`mt-3 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Low stock warnings" actions={<Link href="/admin/stock?stock=low_stock" className="text-xs text-gold-dark underline">Manage stock</Link>}>
          <ProductList items={[...d.out_of_stock, ...d.low_stock]} empty="All products are well stocked." right={(p) => p.raw_stock_quantity <= 0 ? <Badge tone="red">Out of stock</Badge> : <Badge tone="gold">{p.raw_stock_quantity} left</Badge>} />
        </Panel>
        <Panel title="Recent price changes" actions={<Link href="/admin/prices/history" className="text-xs text-gold-dark underline">Full history</Link>}>
          {d.recent_price_changes.length === 0 ? <p className="text-sm text-muted">No price changes yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {d.recent_price_changes.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate">{h.product?.name ?? "Deleted product"} <span className="text-xs text-muted">({h.price_type})</span></p>
                    <p className="text-xs text-muted">{formatDate(h.created_at)} · {h.user?.name ?? "System"} · {h.change_source}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs"><span className="text-muted line-through">{h.old_price ? formatPrice(+h.old_price) : "—"}</span> → <span className="font-medium">{h.new_price ? formatPrice(+h.new_price) : "removed"}</span></p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Best-selling products">
          <ProductList items={d.best_sellers} empty="Mark products as Best Seller to show them here." right={(p) => <span className="text-xs text-muted">{p.views_count} views</span>} />
        </Panel>
        <Panel title="Recently updated">
          <ProductList items={d.recent_updates} empty="No products yet." right={(p) => <span className="text-xs text-muted">{formatDate(p.updated_at)}</span>} />
        </Panel>
      </div>
    </>
  );
}

function ProductList({ items, empty, right }: { items: AdminProduct[]; empty: string; right: (p: AdminProduct) => React.ReactNode }) {
  if (!items.length) return <p className="flex items-center gap-2 text-sm text-muted"><Boxes className="h-4 w-4" /> {empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 py-2 hover:text-gold-dark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-cream" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{p.name}</p>
              <p className="text-xs text-muted">{p.sku} · {formatPrice(p.price)}</p>
            </div>
            {right(p)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
