import type { Metadata } from "next";
import { HandHeart, MessageCircle, PenLine } from "lucide-react";
import CustomOrderForm from "@/components/shop/CustomOrderForm";

export const metadata: Metadata = {
  title: "Custom Handmade Orders",
  description: "Request a personalised bracelet, necklace or gift set. Share your idea and we will handcraft it for you.",
  alternates: { canonical: "/custom-order" },
};

export default function CustomOrderPage() {
  return (
    <div className="container-x py-8 sm:py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow">Made just for you</p>
          <h1 className="heading-display mt-1 text-4xl sm:text-5xl">Custom Handmade Orders</h1>
          <p className="mt-4 leading-relaxed text-ink/80">Want a bracelet with a name, jewellery to match an outfit, or return gifts for a function? Tell us what you have in mind. Your request is sent straight to our WhatsApp, and we will reply with the price and delivery time.</p>
          <ol className="mt-8 space-y-5">
            {[
              { icon: PenLine, t: "Share your idea", d: "Type, colours, size and a reference photo if you have one." },
              { icon: MessageCircle, t: "Chat on WhatsApp", d: "We confirm the design, price and timeline with you." },
              { icon: HandHeart, t: "We handcraft it", d: "Your piece is made by hand and delivered across India." },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-gold-dark"><Icon className="h-5 w-5" /></span>
                <div><p className="font-medium">{i + 1}. {t}</p><p className="text-sm text-muted">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <CustomOrderForm />
      </div>
    </div>
  );
}
