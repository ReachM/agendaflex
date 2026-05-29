/**
 * MarcaiFlex — Full Logo (Mark + Wordmark)
 * Variantes: solid, dark, teal-bg, compact, full
 */

import { Mark } from "./Mark";
import { Wordmark } from "./Wordmark";

type LogoProps = {
  variant?: "solid" | "dark" | "compact" | "full" | "teal-bg";
  className?: string;
};

export function Logo({ variant = "solid", className }: LogoProps) {
  if (variant === "compact") {
    return <Mark size="lg" variant="solid" className={className} />;
  }

  const markVariant = variant === "teal-bg" ? "teal-bg" : variant === "dark" ? "dark" : "solid";
  const wordVariant = variant === "dark" || variant === "teal-bg" ? "dark" : "light";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Mark size="md" variant={markVariant} />
      <Wordmark variant={wordVariant} size="md" />
    </span>
  );
}
