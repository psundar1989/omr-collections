import Image from "next/image";
import { Gem } from "lucide-react";
import { cn } from "@/lib/format";

export default function ProductImage({ src, alt, sizes, className, priority = false }: { src: string | null | undefined; alt: string; sizes: string; className?: string; priority?: boolean }) {
  if (!src) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-cream text-sand", className)}>
        <Gem className="h-10 w-10" strokeWidth={1.2} />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} preload={priority} className={cn("object-cover", className)} />;
}
