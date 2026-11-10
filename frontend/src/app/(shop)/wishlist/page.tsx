import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import WishlistView from "@/components/shop/WishlistView";
import { getLiveCatalog } from "@/lib/live-catalog";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>}>
      <Wishlist />
    </Suspense>
  );
}

/** Saved catalogue products are resolved against the live list, so disabled products drop out. */
async function Wishlist() {
  const { items } = await getLiveCatalog();
  const catalog = items.map(({ id, name, href, image, collectionName, live }) => ({
    id, name, href, image, collectionName,
    price: live ? (live.priceOnRequest ? null : live.price) : null,
    originalPrice: live?.originalPrice ?? null,
    availability: live?.availability ?? "available",
  }));
  return <WishlistView catalog={catalog} />;
}
