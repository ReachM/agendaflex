/**
 * Cor estável por profissional. Como o model Professional não tem coluna de
 * cor, derivamos uma cor a partir do id (hash simples + paleta fechada). Mesma
 * cor sempre, mesmo após reload, e sem migração de banco.
 */
const PALETTE = [
  "#0d9488", // teal
  "#2563eb", // blue
  "#d97706", // amber
  "#9333ea", // purple
  "#db2777", // pink
  "#16a34a", // green
  "#dc2626", // red
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#ca8a04"  // yellow-dark
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function professionalColor(id: string | null | undefined): string {
  if (!id) return PALETTE[0];
  return PALETTE[hash(id) % PALETTE.length];
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
