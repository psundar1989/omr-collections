import { AVAILABILITY_LABELS, type AvailabilityStatus } from "@/lib/types";
import { cn } from "@/lib/format";

/** "Sold Out" / "Discontinued" pill for cards and product pages. Renders nothing for available products. */
export default function AvailabilityBadge({ status, className }: { status: AvailabilityStatus | undefined; className?: string }) {
  if (!status || status === "available") return null;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm",
      status === "sold_out" ? "bg-ink/85 text-white" : "bg-sand text-ink", className)}>
      {AVAILABILITY_LABELS[status]}
    </span>
  );
}
