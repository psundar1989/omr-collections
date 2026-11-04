"use client";

import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/format";

export type FilterCategory = { slug: string; name: string; count?: number };
export type FilterOption = { value: string; label: string };

type Props = {
  categories: FilterCategory[];
  current: Record<string, string | undefined>;
  lockedCategory?: string;
  bounds: { min_price: number; max_price: number };
  total: number;
  /** Sort options; defaults to the API listing sorts. */
  sorts?: FilterOption[];
  /** Hide the price and availability filters (photographed catalogue has no stored prices or stock). */
  catalogMode?: boolean;
  /** Hide the category list (e.g. API views whose categories are not part of the catalogue). */
  hideCategories?: boolean;
  children: React.ReactNode;
};

const API_SORTS: FilterOption[] = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export default function ShopFilters({ categories, current, lockedCategory, bounds, total, sorts = API_SORTS, catalogMode = false, hideCategories = false, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(current.min_price ?? "");
  const [max, setMax] = useState(current.max_price ?? "");

  const update = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...current, ...changes, page: undefined };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    startTransition(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };

  const toggle = (k: string) => update({ [k]: current[k] ? undefined : "1" });
  const activeCount = ["category", "min_price", "max_price", "availability", "new", "best_seller", "on_sale", "featured", "search"].filter((k) => current[k] && !(k === "category" && lockedCategory)).length;

  const panel = (
    <div className="space-y-7">
      {!lockedCategory && !hideCategories && (
        <div>
          <p className="label">Category</p>
          <div className="space-y-1">
            <Radio checked={!current.category} onChange={() => update({ category: undefined })} label="All Products"
              count={categories.every((c) => c.count != null) ? categories.reduce((n, c) => n + (c.count ?? 0), 0) : undefined} />
            {categories.map((c) => (
              <Radio key={c.slug} checked={current.category === c.slug} onChange={() => update({ category: c.slug })} label={c.name} count={c.count} />
            ))}
          </div>
        </div>
      )}

      {!catalogMode && (<>
      <div>
        <p className="label">Price (₹)</p>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); update({ min_price: min || undefined, max_price: max || undefined }); }}>
          <input className="input py-2" inputMode="numeric" placeholder={`${Math.floor(bounds.min_price)}`} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input className="input py-2" inputMode="numeric" placeholder={`${Math.ceil(bounds.max_price)}`} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} aria-label="Maximum price" />
          <button className="btn-outline px-3 py-2">Go</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[[undefined, "499"], ["500", "999"], ["1000", "1999"], ["2000", undefined]].map(([a, b]) => {
            const label = a && b ? `₹${a}–₹${b}` : a ? `₹${a}+` : `Under ₹${Number(b) + 1}`;
            const active = current.min_price === a && current.max_price === b;
            return (
              <button key={label} onClick={() => { setMin(a ?? ""); setMax(b ?? ""); update({ min_price: a, max_price: b }); }}
                className={cn("chip px-2.5 py-1 text-xs", active ? "border-ink bg-ink text-ivory" : "border-line bg-white")}>{label}</button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label">Availability</p>
        <Check checked={current.availability === "in_stock"} onChange={() => update({ availability: current.availability === "in_stock" ? undefined : "in_stock" })} label="In stock only" />
      </div>

      </>)}

      <div>
        <p className="label">Collections</p>
        <div className="space-y-1">
          <Check checked={!!current.new} onChange={() => toggle("new")} label="New arrivals" />
          {!catalogMode && (<>
          <Check checked={!!current.best_seller} onChange={() => toggle("best_seller")} label="Best sellers" />
          <Check checked={!!current.featured} onChange={() => toggle("featured")} label="Featured" />
          <Check checked={!!current.on_sale} onChange={() => toggle("on_sale")} label="On offer" />
          </>)}
        </div>
      </div>

      {activeCount > 0 && (
        <button className="text-sm text-gold-dark underline" onClick={() => { setMin(""); setMax(""); router.push(pathname); }}>Clear all filters</button>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:flex lg:gap-10">
        <aside className="hidden lg:block lg:w-60 lg:shrink-0">{panel}</aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button className="btn-outline lg:hidden" onClick={() => setOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
            </button>
            <p className="hidden text-sm text-muted lg:block">{total} {total === 1 ? "product" : "products"}</p>
            <label className="flex items-center gap-2 text-sm">
              <span className="hidden text-muted sm:inline">Sort by</span>
              <select className="input w-auto py-2 pr-8" value={sorts.some((s) => s.value === current.sort) ? current.sort : "latest"} onChange={(e) => update({ sort: e.target.value === "latest" ? undefined : e.target.value })} aria-label="Sort products">
                {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <div className={cn("transition-opacity", pending && "opacity-50")}>{children}</div>
        </div>
      </div>

      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={cn("absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-ivory p-6 transition-transform", open ? "translate-y-0" : "translate-y-full")}>
          <div className="mb-5 flex items-center justify-between">
            <p className="heading-display text-2xl">Filters</p>
            <button onClick={() => setOpen(false)} className="rounded-full p-2" aria-label="Close filters"><X className="h-5 w-5" /></button>
          </div>
          {panel}
          <button className="btn-primary mt-8 w-full" onClick={() => setOpen(false)}>Show {total} products</button>
        </div>
      </div>
    </>
  );
}

function Radio({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm hover:text-gold-dark">
      <input type="radio" checked={checked} onChange={onChange} className="accent-[var(--color-gold)]" />
      <span className={checked ? "font-medium text-gold-dark" : "text-ink/80"}>{label}</span>
      {count != null && <span className="ml-auto text-xs text-muted">{count}</span>}
    </label>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm hover:text-gold-dark">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-gold)]" />
      <span className={checked ? "font-medium" : "text-ink/80"}>{label}</span>
    </label>
  );
}
