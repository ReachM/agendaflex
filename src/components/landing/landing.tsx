"use client";

import { useReveal } from "./hooks";
import { BeforeAfter } from "./parts/BeforeAfter";
import { BotDemo } from "./parts/BotDemo";
import { FAQ } from "./parts/FAQ";
import { Features } from "./parts/Features";
import { FinalCTA } from "./parts/FinalCTA";
import { Footer } from "./parts/Footer";
import { Header } from "./parts/Header";
import { Hero } from "./parts/Hero";
import { HowItWorks } from "./parts/HowItWorks";
import { Pricing } from "./parts/Pricing";
import { SegmentsStrip } from "./parts/SegmentsStrip";
import { StatsBand } from "./parts/StatsBand";
import { Testimonial } from "./parts/Testimonial";
import "./landing.css";

/**
 * Landing Page v2 — orquestrador. Cada seção é uma parte isolada em ./parts.
 * Os reveals no scroll são acionados uma vez aqui (useReveal); o Pricing
 * re-aciona após carregar os planos assíncronos. As animações respeitam
 * prefers-reduced-motion (ver landing.css + hooks).
 */
export function Landing() {
  useReveal();

  return (
    <div className="lp">
      <Header />
      <main>
        <Hero />
        <SegmentsStrip />
        <HowItWorks />
        <BotDemo />
        <StatsBand />
        <Features />
        <BeforeAfter />
        <Testimonial />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
