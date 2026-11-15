"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { PlacedOrder } from "@/lib/types";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { openWhatsAppLink, WHATSAPP_WINDOW } from "@/lib/whatsapp-window";

/** Shown after an order is stored: the order number, a way back to WhatsApp, and tracking. */
export default function OrderPlaced({ order, compact = false }: { order: PlacedOrder; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl border border-whatsapp/30 bg-whatsapp/5 p-4" : "container-x flex flex-col items-center py-20 text-center"}>
      <CheckCircle2 className={compact ? "h-6 w-6 text-whatsapp" : "h-12 w-12 text-whatsapp"} strokeWidth={1.5} />
      <h2 className={compact ? "mt-2 font-medium" : "heading-display mt-4 text-4xl"}>Order {order.order_number} received</h2>
      <p className={compact ? "mt-1 text-sm text-ink/75" : "mt-2 max-w-md text-muted"}>
        Please <strong>send the WhatsApp message</strong> so we can confirm availability, delivery charges and payment.
        Keep your order number to track delivery.
      </p>
      <div className={compact ? "mt-3 flex flex-wrap gap-2" : "mt-6 flex flex-wrap justify-center gap-3"}>
        <a href={order.whatsapp_url} target={WHATSAPP_WINDOW} onClick={(e) => openWhatsAppLink(e, order.whatsapp_url)} className="btn-whatsapp px-5 py-2.5">
          <WhatsAppIcon className="h-4 w-4" /> Open WhatsApp
        </a>
        <Link href={`/track-order?order=${encodeURIComponent(order.order_number)}`} className="btn-outline px-5 py-2.5">Track order</Link>
      </div>
    </div>
  );
}
