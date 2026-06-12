/**
 * Máscaras e validações de documentos/telefone brasileiros (somente UX +
 * validação client/server-safe, sem dependência externa). Fonte única — não
 * duplicar regex de máscara espalhada pelos componentes.
 */

/** Máscara telefone: (11) 99999-9999 */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/** Máscara CPF: 000.000.000-00 */
export function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Máscara CNPJ: 00.000.000/0000-00 */
export function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Auto CPF ou CNPJ baseado no tamanho */
export function maskDocument(value: string): string {
  const d = value.replace(/\D/g, "");
  return d.length <= 11 ? maskCPF(value) : maskCNPJ(value);
}

/** Validação real de CPF */
export function isValidCPF(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  return r === Number(d[10]);
}

/** Validação real de CNPJ */
export function isValidCNPJ(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (s: string, len: number) => {
    let sum = 0,
      pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += Number(s[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(d, 12) === Number(d[12]) && calc(d, 13) === Number(d[13]);
}

export function isValidDocument(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length === 11) return isValidCPF(value);
  if (d.length === 14) return isValidCNPJ(value);
  return false;
}

export function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 10;
}
