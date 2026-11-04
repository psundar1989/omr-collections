"use client";

import { useEffect } from "react";
import { recordView } from "@/lib/client-api";
import { useRecentlyViewed } from "@/lib/store";

/** Records a product view (popularity) and adds it to "recently viewed". */
export default function ViewTracker({ productId }: { productId: number }) {
  const { push } = useRecentlyViewed();
  useEffect(() => {
    push(productId);
    const key = `hm_viewed_${productId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      recordView(productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);
  return null;
}
