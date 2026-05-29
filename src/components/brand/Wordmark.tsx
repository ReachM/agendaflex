/**
 * MarcaiFlex — Wordmark ("MarcaiFlex" with "Flex" highlighted)
 * Variantes: light (for dark bg), dark (for light bg)
 */

type WordmarkProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const fontSizes = { sm: 14, md: 17, lg: 22 };

export function Wordmark({ variant = "light", size = "md", className }: WordmarkProps) {
  const baseColor = variant === "light" ? "#fff" : "#0f172a";
  const accentColor = "#5eead4";

  return (
    <span
      className={className}
      style={{
        color: baseColor,
        fontWeight: 800,
        fontSize: fontSizes[size],
        letterSpacing: "-0.025em",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      Marcai
      <span style={{ color: accentColor }}>Flex</span>
    </span>
  );
}
