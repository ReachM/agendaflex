/**
 * MarcaiFlex — Brand Mark (squircle "M")
 * Variantes: solid (default), dark, teal-bg
 * Tamanhos: sm (28), md (34), lg (44), xl (56)
 */

type MarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "dark" | "teal-bg";
  className?: string;
};

const sizes = {
  sm: { box: 28, font: 11, radius: 7 },
  md: { box: 34, font: 14, radius: 9 },
  lg: { box: 44, font: 18, radius: 11 },
  xl: { box: 56, font: 22, radius: 14 },
};

const variants = {
  solid: {
    background: "linear-gradient(135deg, #0d9488, #0f766e)",
    color: "#fff",
    boxShadow: "0 4px 14px -4px rgba(13,148,136,0.6)",
  },
  dark: {
    background: "linear-gradient(135deg, #0f172a, #1e293b)",
    color: "#5eead4",
    boxShadow: "0 4px 14px -4px rgba(15,23,42,0.4)",
  },
  "teal-bg": {
    background: "linear-gradient(135deg, #ccfbf1, #99f6e4)",
    color: "#0f766e",
    boxShadow: "none",
  },
};

export function Mark({ size = "md", variant = "solid", className }: MarkProps) {
  const s = sizes[size];
  const v = variants[variant];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        background: v.background,
        color: v.color,
        fontWeight: 800,
        fontSize: s.font,
        letterSpacing: "-0.02em",
        boxShadow: v.boxShadow,
        flexShrink: 0,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      M
    </span>
  );
}
