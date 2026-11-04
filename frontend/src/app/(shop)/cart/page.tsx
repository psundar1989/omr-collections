import type { Metadata } from "next";
import CartView from "@/components/shop/CartView";

export const metadata: Metadata = { title: "Your Cart", robots: { index: false } };

export default function CartPage() {
  return <CartView />;
}
