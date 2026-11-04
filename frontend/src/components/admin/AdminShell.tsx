"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeIndianRupee, Boxes, ExternalLink, FolderTree, History, Image as ImageIcon, LayoutDashboard, Loader2, LogOut, Menu, Package, Percent, Settings, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminTokenStore, useAdminToken } from "@/lib/store";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/format";
import { ToastProvider } from "./ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/stock", label: "Stock", icon: Boxes },
  { href: "/admin/prices", label: "Bulk Prices", icon: BadgeIndianRupee },
  { href: "/admin/prices/history", label: "Price History", icon: History },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/offers", label: "Offers", icon: Percent },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/custom-orders", label: "Custom Orders", icon: Sparkles },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAdminToken();
  const [auth, setAuth] = useState<{ token: string; user: { name: string; email: string } } | null>(null);
  const [open, setOpen] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    const t = adminTokenStore.get();
    if (!t) {
      router.replace("/admin/login");
      return;
    }
    let alive = true;
    apiRequest<{ data: { name: string; email: string } }>("/admin/me", { token: t })
      .then((r) => alive && setAuth({ token: t, user: r.data }))
      .catch(() => {
        adminTokenStore.set(null);
        router.replace("/admin/login");
      });
    return () => {
      alive = false;
    };
  }, [isLogin, token, router]);

  const user = auth && auth.token === token ? auth.user : null;

  if (isLogin) return <ToastProvider>{children}</ToastProvider>;

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f5f1]"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;
  }

  const logout = async () => {
    await apiRequest("/admin/logout", { method: "POST", token: adminTokenStore.get() }).catch(() => undefined);
    adminTokenStore.set(null);
    router.replace("/admin/login");
  };

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || (pathname.startsWith(href + "/") && !NAV.some((n) => n.href !== href && n.href.startsWith(href) && pathname.startsWith(n.href))));

  const nav = (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", active(href) ? "bg-ink text-ivory" : "text-ink/75 hover:bg-cream")}>
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#f7f5f1] lg:flex">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white p-4 lg:flex lg:sticky lg:top-0 lg:h-screen">
          <Link href="/admin" className="mb-6 px-2 text-lg font-semibold">Store Admin</Link>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          <div className="border-t border-line pt-3 text-xs text-muted">
            <p className="truncate px-2">{user.email}</p>
            <Link href="/" target="_blank" className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream"><ExternalLink className="h-3.5 w-3.5" /> View store</Link>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream"><LogOut className="h-3.5 w-3.5" /> Log out</button>
          </div>
        </aside>

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold">Store Admin</span>
          <button onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 bg-white p-4">
              <div className="mb-4 flex justify-between"><span className="font-semibold">Menu</span><button onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
              {nav}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
