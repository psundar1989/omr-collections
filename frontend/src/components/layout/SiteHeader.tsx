import { getSettings } from "@/lib/api";
import { getCatalogCategories } from "@/lib/catalog";
import HeaderClient from "./HeaderClient";

export default async function SiteHeader() {
  const settings = await getSettings();
  const categories = getCatalogCategories();
  return (
    <>
      {settings.announcement_text && (
        <div className="bg-ink px-4 py-2 text-center text-[11px] tracking-wider text-ivory/90 sm:text-xs">{settings.announcement_text}</div>
      )}
      <HeaderClient
        businessName={settings.business_name}
        logoUrl={settings.logo_url}
        categories={categories.map((c) => ({ name: c.name, href: `/shop?category=${c.slug}` }))}
      />
    </>
  );
}

export function HeaderSkeleton() {
  return (
    <>
      <div className="h-8 bg-ink" />
      <div className="h-16 border-b border-line bg-ivory/90 sm:h-20" />
    </>
  );
}
