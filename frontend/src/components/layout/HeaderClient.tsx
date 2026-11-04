"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useCatalogWishlist, useWishlist } from "@/lib/store";
import { cn } from "@/lib/format";

type Props = { businessName: string; logoUrl: string | null; categories: { name: string; href: string }[] };

const NAV = [
  { href: "/", label: "Home" },
  { href: "/collections", label: "Collections" },
  { href: "/shop", label: "Shop All" },
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/shop?best_seller=1", label: "Best Sellers" },
  { href: "/shop?on_sale=1", label: "Offers" },
  { href: "/custom-order", label: "Custom Orders" },
];

export default function HeaderClient({ businessName, logoUrl, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const { count } = useCart();
  const wishlistCount = useWishlist().count + useCatalogWishlist().count;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setSearchOpen(false);
    setOpen(false);
    router.push(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3 sm:h-20">
        <button className="-ml-2 rounded-full p-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${businessName} home`}>
          {logoUrl ? (
            <Image src={logoUrl} alt={businessName} width={140} height={48} className="h-9 w-auto object-contain sm:h-11" />
          ) : (
            <span className="heading-display truncate text-2xl sm:text-3xl">{businessName}</span>
          )}
        </Link>

        <nav className="ml-8 hidden items-center gap-6 lg:flex">
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} className={cn("text-sm tracking-wide text-ink/80 transition hover:text-gold-dark", pathname === n.href && "text-gold-dark")}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <form onSubmit={submit} className="hidden md:block">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code…" aria-label="Search products" className="input w-48 rounded-full py-2 pl-9 lg:w-56" />
            </label>
          </form>
          <button className="rounded-full p-2 md:hidden" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
            <Search className="h-5 w-5" />
          </button>
          <Link href="/wishlist" className="relative rounded-full p-2 hover:bg-cream" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && <Badge n={wishlistCount} />}
          </Link>
          <Link href="/cart" className="relative rounded-full p-2 hover:bg-cream" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <Badge n={count} />}
          </Link>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submit} className="container-x pb-3 md:hidden">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, product code or category" className="input rounded-full" aria-label="Search products" />
        </form>
      )}

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cn("absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col bg-ivory shadow-xl transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex items-center justify-between border-b border-line p-4">
            <span className="heading-display text-2xl">{businessName}</span>
            <button className="rounded-full p-2" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[15px] hover:bg-cream">
                  {n.label}
                </Link>
              ))}
            </nav>
            <p className="eyebrow mt-6 px-3">Categories</p>
            <nav className="mt-2 space-y-1">
              {categories.map((c) => (
                <Link key={c.href} href={c.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink/80 hover:bg-cream">
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}
