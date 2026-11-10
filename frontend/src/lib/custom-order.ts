/** Query keys understood by the custom order form (/custom-order). */
export type CustomOrderPrefill = { product?: string; code?: string; type?: string; colour?: string; size?: string };

/** Link to the custom order form, pre-filled with a product and the customer's current selection. */
export function customPieceLink(product: { name: string; code: string; type?: string | null }, colour?: string | null, size?: string | null): string {
  const qs = new URLSearchParams({ product: product.name, code: product.code });
  if (product.type) qs.set("type", product.type);
  if (colour) qs.set("colour", colour);
  if (size) qs.set("size", size);
  return `/custom-order?${qs}`;
}

/** Read the prefill from URL search params, trimmed and length-limited like the API fields. */
export function readPrefill(params: URLSearchParams): CustomOrderPrefill {
  const get = (k: string, max: number) => params.get(k)?.trim().slice(0, max) || undefined;
  return { product: get("product", 200), code: get("code", 64), type: get("type", 120), colour: get("colour", 100), size: get("size", 100) };
}
