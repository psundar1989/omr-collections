"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useCatalogWishlist, useWishlist } from "@/lib/store";
import { cn } from "@/lib/format";

// Transparent, tightly cropped version of logo2.png (same artwork, cream background removed).
const BRAND_LOGO = "/images/logo/logo-omr.webp";

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

  // Lock page scroll while the drawer is open; close it on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the drawer if the route changes by any means (back button, search, etc.).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Close the drawer if the viewport grows to desktop width while it is open.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setSearchOpen(false);
    setOpen(false);
    router.push(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="container-x flex h-16 items-center gap-1 min-[375px]:gap-2 sm:h-20 sm:gap-3">
          <button
            type="button"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-cream lg:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${businessName} home`}>
            <Image src={logoUrl || BRAND_LOGO} alt={businessName} width={1186} height={601} priority quality={90} sizes="(min-width: 640px) 136px, 112px" className="h-14 w-auto shrink-0 object-contain sm:h-[68px]" />
            {/* <span className="heading-display truncate text-xl min-[375px]:text-2xl sm:text-3xl lg:text-2xl xl:text-3xl">{businessName}</span> */}
          </Link>

          <nav className="hidden items-center lg:ml-4 lg:flex lg:gap-4 xl:ml-8 xl:gap-6">
            {NAV.slice(1).map((n) => (
              <Link key={n.href} href={n.href} className={cn("whitespace-nowrap text-sm tracking-wide text-ink/80 transition hover:text-gold-dark", pathname === n.href && "text-gold-dark")}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center sm:gap-1">
            <form onSubmit={submit} className="hidden md:block">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code…" aria-label="Search products" className="input w-48 rounded-full py-2 pl-9 lg:w-44 xl:w-56" />
              </label>
            </form>
            <button type="button" className="rounded-full p-2 hover:bg-cream md:hidden" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((s) => !s)}>
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
      </header>

      {/* Mobile drawer. Rendered outside <header>: the header's backdrop-filter would otherwise
          become the containing block for this fixed element and clip it to the header height. */}
      <div
        id="mobile-menu"
        className={cn("fixed inset-0 z-[60] lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!open}
        inert={!open}
      >
        <div className={cn("absolute inset-0 bg-ink/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={cn(
            "absolute inset-y-0 left-0 flex h-dvh w-80 max-w-[85%] flex-col bg-ivory shadow-xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-line p-4">
            <span className="heading-display truncate text-2xl">{businessName}</span>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-cream" aria-label="Close menu" onClick={() => setOpen(false)}>
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
    </>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}
