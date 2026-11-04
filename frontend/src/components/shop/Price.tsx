import { cn, formatPrice } from "@/lib/format";

export default function Price({ price, original, discount, currency = "INR", size = "md" }: { price: number; original?: number | null; discount?: number | null; currency?: string; size?: "sm" | "md" | "lg" }) {
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
