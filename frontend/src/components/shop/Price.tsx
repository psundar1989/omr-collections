import { cn, formatPrice } from "@/lib/format";

/**
 * Selling price as calculated by the API (PricingService): ₹499, a sale price with the
 * regular price struck through, or "Price on Request" when the product has no price (null).
 */
export default function Price({ price, original, discount, currency = "INR", size = "md" }: { price: number | null; original?: number | null; discount?: number | null; currency?: string; size?: "sm" | "md" | "lg" }) {
  if (price == null) {
    return <span className={cn("font-medium text-gold-dark", size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs")}>Price on Request</span>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("font-semibold text-ink", size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm")}>{formatPrice(price, currency)}</span>
      {original != null && original > price && (
        <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-xs")}>{formatPrice(original, currency)}</span>
      )}
      {discount != null && discount > 0 && <span className={cn("font-medium text-rose", size === "lg" ? "text-sm" : "text-xs")}>{discount}% off</span>}
    </div>
  );
}
