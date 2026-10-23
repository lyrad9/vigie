"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

/**
 * Smooth, slightly eased scrolling for the whole page (Lenis). Native scroll stays underneath, so
 * scroll-driven CSS animations keep working. Lenis turns itself off for prefers-reduced-motion,
 * leaves touch scrolling native, and lets nested scroll areas (the agents rail) scroll on their own.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.085, allowNestedScroll: true });

    // In-page links ("#faq", "/#faq" when already on "/") glide to their section instead of jumping.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href*='#']");
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      // Lenis stops below the floating nav on its own: it reads scroll-padding-top from globals.css.
      lenis.scrollTo(target);
      history.pushState(null, "", url.hash);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);

  return null;
}
