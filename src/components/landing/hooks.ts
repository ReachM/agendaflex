"use client";

import { useEffect, type RefObject } from "react";

/**
 * Reveals suaves no scroll via IntersectionObserver, respeitando reduced-motion.
 * (Originalmente em landing.tsx — extraído para ser compartilhado pelas partes.)
 *
 * Observa todos os `.lp-reveal` ainda não revelados. Passe deps quando conteúdo
 * assíncrono (ex.: planos carregados) adicionar novos elementos depois do mount.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp-reveal:not(.lp-reveal--in)"));
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("lp-reveal--in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-reveal--in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Parallax leve do mockup do hero (desligado em reduced-motion). */
export function useParallax(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (ref.current) ref.current.style.transform = `translate3d(0, ${y * 0.05}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}
