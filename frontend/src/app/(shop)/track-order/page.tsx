import type { Metadata } from "next";
import { Suspense } from "react";
import TrackOrderView from "@/components/shop/TrackOrderView";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check the delivery status of your order with your order number and mobile number.",
  alternates: { canonical: "/track-order" },
  robots: { index: false },
};

export default function TrackOrderPage() {
  return (
    <div className="container-x max-w-3xl py-8 sm:py-12">
      <p className="eyebrow">Order status</p>
      <h1 className="heading-display mt-1 text-4xl sm:text-5xl">Track Your Order</h1>
      <p className="mt-3 text-ink/80">Enter the order number from your WhatsApp message and the mobile number you used when ordering.</p>
      <Suspense fallback={null}>
        <TrackOrderView />
      </Suspense>
    </div>
  );
}
