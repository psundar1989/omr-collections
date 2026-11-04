import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader, { HeaderSkeleton } from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import RevealObserver from "@/components/ui/RevealObserver";
import { getSettings } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s?.business_name ?? "Handmade Store";
  return {
    title: { default: `${name} – ${s?.tagline ?? "Handmade With Love"}`, template: `%s | ${name}` },
    description: s?.meta_description ?? undefined,
    icons: s?.favicon_url ? { icon: s.favicon_url } : undefined,
    openGraph: { type: "website", siteName: name, locale: "en_IN" },
    twitter: { card: "summary_large_image" },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <SiteHeader />
      </Suspense>
      <main>{children}</main>
      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
      <RevealObserver />
    </>
  );
}
