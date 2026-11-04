"use client";

import { useEffect } from "react";

/**
 * Fade-up-on-scroll for any element marked with `data-reveal` (optionally
 * `data-reveal="fade" | "zoom"` and a `--reveal-delay` CSS variable for stagger).
 *
 * Mounted once in the shop layout. Elements already on screen at start-up are
 * revealed instantly (no flash); later ones – including content streamed in by
 * Suspense or added on client navigation – animate when scrolled into view.
 */
export default function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );

    const track = (el: Element) => {
      if (el.classList.contains("is-revealed")) return;
      io.observe(el);
    };

    // Reveal whatever is already visible before hiding anything, to avoid a flash.
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-revealed");
      else track(el);
    });
    root.setAttribute("data-reveal", "");

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.hasAttribute("data-reveal")) track(n);
          n.querySelectorAll("[data-reveal]").forEach(track);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.removeAttribute("data-reveal");
    };
  }, []);

  return null;
}
