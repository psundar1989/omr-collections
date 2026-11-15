import { formatPrice } from "./format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "./types";

export type DeliveryPerson = {
  id: number;
  name: string;
  phone: string;
  alternate_phone: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  service_area: string | null;
  notes: string | null;
  is_active: boolean;
  active_orders_count?: number;
  delivered_orders_count?: number;
  deleted_at?: string | null;
};

export type AdminOrderItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  product_slug: string | null;
  /** Public storefront page; null once the product has been deleted. */
  product_url: string | null;
  sku: string | null;
  image_url: string | null;
  colour: string | null;
  size: string | null;
  quantity: number;
  unit_price: string | null;
  original_price: string | null;
  price_on_request: boolean;
  line_total: string;
};

export type OrderHistory = {
  id: number;
  event: "placed" | "status_changed" | "assigned" | "unassigned" | "updated" | "payment" | "note";
  from_status: OrderStatus | null;
  status: OrderStatus;
  note: string | null;
  created_at: string;
  user: { id: number; name: string } | null;
};

export type AdminOrder = {
  id: number;
  order_number: string;
  status: OrderStatus;
  status_label: string;
  next_statuses: OrderStatus[];
  source: "cart" | "buy_now";
  customer_name: string;
  phone: string;
  whatsapp_number: string;
  email: string | null;
  address: string;
  landmark: string | null;
  city: string;
  state: string | null;
  pincode: string;
  customer_notes: string | null;
  subtotal: string;
  delivery_charge: string;
  discount: string;
  total: string;
  has_price_on_request: boolean;
  payment_status: "unpaid" | "paid" | "refunded";
  payment_method: string | null;
  payment_reference: string | null;
  delivery_person_id: number | null;
  delivery_person: DeliveryPerson | null;
  assigned_at: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  expected_delivery_date: string | null;
  delivery_notes: string | null;
  confirmed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  admin_notes: string | null;
  whatsapp_message: string | null;
  created_at: string;
  updated_at: string;
  items?: AdminOrderItem[];
  histories?: OrderHistory[];
  items_count?: number;
  total_quantity?: number;
};

export const STATUS_TONE: Record<OrderStatus, "gold" | "blue" | "green" | "neutral" | "red"> = {
  pending: "gold",
  confirmed: "blue",
  packed: "blue",
  out_for_delivery: "blue",
  delivered: "green",
  cancelled: "red",
  returned: "neutral",
};

export const PAYMENT_METHODS: Record<string, string> = { upi: "UPI", cod: "Cash on delivery", bank_transfer: "Bank transfer", cash: "Cash", other: "Other" };

export const ACTION_LABELS: Record<OrderStatus, string> = {
  pending: "Mark pending",
  confirmed: "Confirm order",
  packed: "Mark packed",
  out_for_delivery: "Send out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  returned: "Mark returned",
};

export const fullAddress = (o: AdminOrder) =>
  [o.address, o.landmark && `Landmark: ${o.landmark}`, [o.city, o.state].filter(Boolean).join(", "), o.pincode].filter(Boolean).join("\n");

export const totalText = (o: AdminOrder) => `${formatPrice(+o.total)}${o.has_price_on_request ? " + items on request" : ""}`;

/** Status update for the customer, ready to send on WhatsApp. */
export function customerMessage(o: AdminOrder, business: string): string {
  const head = `Hello ${o.customer_name}! Update on your ${business ? `${business} ` : ""}order *${o.order_number}*:`;
  const lines = [head, "", `Status: *${ORDER_STATUS_LABELS[o.status]}*`];
  if (o.status === "confirmed" || o.status === "packed") {
    lines.push(`Total: ${totalText(o)}`);
    if (o.expected_delivery_date) lines.push(`Expected delivery: ${new Date(o.expected_delivery_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}`);
  }
  if (o.status === "out_for_delivery") {
    if (o.delivery_person) lines.push(`Delivery by: ${o.delivery_person.name} (${o.delivery_person.phone})`);
    if (o.courier_name) lines.push(`Courier: ${o.courier_name}${o.tracking_number ? ` – Tracking no: ${o.tracking_number}` : ""}`);
    if (o.payment_status === "unpaid") lines.push(`Amount to pay: ${totalText(o)}`);
  }
  if (o.status === "cancelled" && o.cancellation_reason) lines.push(`Reason: ${o.cancellation_reason}`);
  if (o.status === "delivered") lines.push("", "Thank you for shopping with us! We would love to hear your feedback.");
  return lines.join("\n");
}

/** Pickup / drop details for the delivery person. */
export function deliveryMessage(o: AdminOrder): string {
  const items = (o.items ?? []).map((i) => `• ${i.product_name}${i.colour || i.size ? ` (${[i.colour, i.size].filter(Boolean).join(" / ")})` : ""} × ${i.quantity}`);
  return [
    `*Delivery: ${o.order_number}*`,
    "",
    `Customer: ${o.customer_name}`,
    `Phone: ${o.phone}${o.whatsapp_number !== o.phone ? ` / WhatsApp ${o.whatsapp_number}` : ""}`,
    "Address:",
    fullAddress(o),
    "",
    "Items:",
    ...items,
    "",
    o.payment_status === "paid" ? "Payment: Already paid" : `Collect: ${totalText(o)}${o.payment_method ? ` (${PAYMENT_METHODS[o.payment_method] ?? o.payment_method})` : ""}`,
    ...(o.delivery_notes ? ["", `Notes: ${o.delivery_notes}`] : []),
  ].join("\n");
}

/** Download a CSV from an authenticated endpoint (a plain link would not send the token). */
export async function downloadWithToken(url: string, token: string | null, filename: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}`, Accept: "text/csv" } });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
