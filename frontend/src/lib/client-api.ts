"use client";

import { PUBLIC_API_URL } from "./config";
import type { CheckoutCustomer, PlacedOrder, Product, Quote, TrackedOrder } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, string[]> = {}) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);

  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Could not reach the server. Please check your connection.", 0);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.message || `Request failed (${res.status})`, res.status, body.errors || {});
  return body as T;
}

export type QuoteItem = { key: string; product_id: number; variant_id?: number | null; colour?: string | null; size?: string | null; quantity: number };

export function fetchQuote(items: QuoteItem[], customer: { customer_name?: string; delivery_location?: string; pincode?: string; notes?: string } = {}) {
  return apiRequest<{ data: Quote }>("/cart/quote", { method: "POST", body: JSON.stringify({ items, ...customer }) }).then((r) => r.data);
}

/** Store the order (with delivery details) and get the WhatsApp link carrying its order number. */
export function placeOrder(items: QuoteItem[], customer: CheckoutCustomer, source: "cart" | "buy_now" = "cart") {
  const body: Record<string, unknown> = { items, source };
  Object.entries(customer).forEach(([k, v]) => {
    const t = v.trim();
    if (t) body[k] = t;
  });
  return apiRequest<{ data: PlacedOrder }>("/orders", { method: "POST", body: JSON.stringify(body) }).then((r) => r.data);
}

export function trackOrder(orderNumber: string, phone: string) {
  return apiRequest<{ data: TrackedOrder }>("/orders/track", { method: "POST", body: JSON.stringify({ order_number: orderNumber.trim(), phone: phone.trim() }) }).then((r) => r.data);
}

export function fetchProductsByIds(ids: number[]) {
  if (!ids.length) return Promise.resolve([] as Product[]);
  const qs = ids.map((id) => `ids[]=${id}`).join("&");
  return apiRequest<{ data: Product[] }>(`/products/by-ids?${qs}`).then((r) => r.data);
}

export function fetchProduct(slug: string) {
  return apiRequest<{ data: Product }>(`/products/${encodeURIComponent(slug)}`).then((r) => r.data);
}

export function recordView(id: number) {
  return apiRequest<void>(`/products/${id}/view`, { method: "POST" }).catch(() => undefined);
}

/*
 * Live product data for photographed catalogue cards, looked up by product code.
 * Cards on one page ask for their codes individually; the requests are batched into
 * GET /products/by-ids?skus[]=… (≤ 50 per call) and cached for the session.
 */
const bySku = new Map<string, Promise<Product | null>>();
let queue: { sku: string; resolve: (p: Product | null) => void }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushSkuQueue() {
  flushTimer = null;
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    const qs = chunk.map((c) => `skus[]=${encodeURIComponent(c.sku)}`).join("&");
    apiRequest<{ data: Product[] }>(`/products/by-ids?${qs}`)
      .then((r) => {
        // A code is a catalogue code ("product-062") or a SKU – index the product under both.
        const found = new Map(r.data.flatMap((p) => [[p.sku.toLowerCase(), p] as const, ...(p.catalog_code ? [[p.catalog_code.toLowerCase(), p] as const] : [])]));
        chunk.forEach((c) => c.resolve(found.get(c.sku.toLowerCase()) ?? null));
      })
      .catch(() => chunk.forEach((c) => {
        bySku.delete(c.sku); // retry on the next page view
        c.resolve(null);
      }));
  }
}

export function fetchProductBySku(sku: string): Promise<Product | null> {
  const cached = bySku.get(sku);
  if (cached) return cached;
  const promise = new Promise<Product | null>((resolve) => {
    queue.push({ sku, resolve });
    flushTimer ??= setTimeout(flushSkuQueue, 20);
  });
  bySku.set(sku, promise);
  return promise;
}
