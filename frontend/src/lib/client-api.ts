"use client";

import { PUBLIC_API_URL } from "./config";
import type { Product, Quote } from "./types";

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
