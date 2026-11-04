import type { Metadata } from "next";
import WishlistView from "@/components/shop/WishlistView";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  const catalog = getCatalog().map(({ id, name, href, image, collectionName }) => ({ id, name, href, image, collectionName }));
  return <WishlistView catalog={catalog} />;
}
