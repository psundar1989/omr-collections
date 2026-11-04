"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed stores (cart, wishlist, recently viewed).
 * useSyncExternalStore keeps every component in sync, across tabs too,
 * and renders an empty value on the server to avoid hydration mismatches.
 */
function createStore<T>(key: string, initial: T) {
  let value: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      try {
        value = e.newValue ? (JSON.parse(e.newValue) as T) : initial;
      } catch {
        value = initial;
      }
      listeners.forEach((l) => l());
    });
  };

  return {
    get: () => {
      load();
      return value;
    },
    set: (next: T | ((prev: T) => T)) => {
      load();
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or disabled – keep in memory */
      }
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    initial,
  };
}

export type CartItem = {
  key: string; // productId|variant|colour|size
  productId: number;
  slug: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  price: number; // last known price – display only, the server re-prices
  colour: string | null;
  size: string | null;
  variantId: number | null;
  quantity: number;
  colours: string[];
  sizes: string[];
  hasVariants: boolean;
};

const EMPTY_CART: CartItem[] = [];
const EMPTY_IDS: number[] = [];

export const cartStore = createStore<CartItem[]>("hm_cart_v1", EMPTY_CART);
export const wishlistStore = createStore<number[]>("hm_wishlist_v1", EMPTY_IDS);
export const recentStore = createStore<number[]>("hm_recent_v1", EMPTY_IDS);
/** Wishlist for photographed catalogue products (string ids like "product-001"). */
const EMPTY_KEYS: string[] = [];
export const catalogWishlistStore = createStore<string[]>("hm_wishlist_catalog_v1", EMPTY_KEYS);

function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.initial);
}

export const itemKey = (productId: number, variantId: number | null, colour: string | null, size: string | null) =>
  [productId, variantId ?? "", colour ?? "", size ?? ""].join("|");

export function useCart() {
  const items = useStore(cartStore);

  const add = (item: Omit<CartItem, "key">) =>
    cartStore.set((prev) => {
      const key = itemKey(item.productId, item.variantId, item.colour, item.size);
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, ...item, key, quantity: Math.min(50, i.quantity + item.quantity) } : i));
      return [...prev, { ...item, key }];
    });

  const updateQuantity = (key: string, quantity: number) =>
    cartStore.set((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(50, quantity)) } : i)));

  /** Change colour/size; merges with an identical line if one exists. */
  const updateOptions = (key: string, changes: { colour?: string | null; size?: string | null; variantId?: number | null; price?: number }) =>
    cartStore.set((prev) => {
      const item = prev.find((i) => i.key === key);
      if (!item) return prev;
      const next = { ...item, ...changes };
      next.key = itemKey(next.productId, next.variantId, next.colour, next.size);
      const others = prev.filter((i) => i.key !== key);
      const dup = others.find((i) => i.key === next.key);
      if (dup) return others.map((i) => (i.key === next.key ? { ...i, quantity: Math.min(50, i.quantity + next.quantity) } : i));
      return prev.map((i) => (i.key === key ? next : i));
    });

  const remove = (key: string) => cartStore.set((prev) => prev.filter((i) => i.key !== key));
  const clear = () => cartStore.set([]);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  return { items, add, updateQuantity, updateOptions, remove, clear, count, subtotal };
}

export function useWishlist() {
  const ids = useStore(wishlistStore);
  const has = (id: number) => ids.includes(id);
  const toggle = (id: number) => wishlistStore.set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 100)));
  const remove = (id: number) => wishlistStore.set((prev) => prev.filter((x) => x !== id));
  return { ids, has, toggle, remove, count: ids.length };
}

export function useCatalogWishlist() {
  const ids = useStore(catalogWishlistStore);
  const has = (id: string) => ids.includes(id);
  const toggle = (id: string) => catalogWishlistStore.set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 100)));
  const remove = (id: string) => catalogWishlistStore.set((prev) => prev.filter((x) => x !== id));
  return { ids, has, toggle, remove, count: ids.length };
}

export function useRecentlyViewed() {
  const ids = useStore(recentStore);
  const push = (id: number) => recentStore.set((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
  return { ids, push };
}

/** Admin auth token (Sanctum personal access token). */
export const adminTokenStore = createStore<string | null>("hm_admin_token", null);
export function useAdminToken() {
  return useStore(adminTokenStore);
}
