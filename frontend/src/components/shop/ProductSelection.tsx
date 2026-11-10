"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ProductImage } from "@/lib/types";

type Selection = { colour: string | null; setColour: (colour: string | null) => void };

const SelectionContext = createContext<Selection | null>(null);

/**
 * Shares the chosen colour between the product gallery and the purchase panel on the product
 * page: choosing a colour shows its photo, and tapping a colour photo chooses that colour.
 * Without a provider (e.g. Quick View) the purchase panel keeps its own selection.
 */
export function ProductSelectionProvider({ initialColour = null, children }: { initialColour?: string | null; children: React.ReactNode }) {
  const [colour, setColour] = useState<string | null>(initialColour);
  const value = useMemo(() => ({ colour, setColour }), [colour]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useProductSelection(): Selection | null {
  return useContext(SelectionContext);
}

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Index of the first photo tagged with this colour, or -1. */
export function colourImageIndex(images: ProductImage[], colour: string | null): number {
  return colour ? images.findIndex((img) => same(img.colour, colour)) : -1;
}

/** URL of the photo showing this colour, if there is one. */
export function colourImageUrl(images: ProductImage[] | undefined, colour: string | null): string | null {
  const i = colourImageIndex(images ?? [], colour);
  return i >= 0 ? images![i].url : null;
}
