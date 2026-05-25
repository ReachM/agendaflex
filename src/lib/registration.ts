import type { BusinessSegment } from "@prisma/client";

/**
 * Segmentos exibidos no cadastro. O `value` é EXATAMENTE um valor do enum
 * BusinessSegment do Prisma — nunca inventar segmentos fora do enum. O `label`
 * é o rótulo PT-BR amigável mostrado no card.
 */
export const SEGMENTS: { value: BusinessSegment; label: string; description: string }[] = [
  { value: "CLINICA_MEDICA", label: "Clínica Médica", description: "Consultas, exames e atendimentos clínicos" },
  { value: "OFICINA_MECANICA", label: "Oficina Mecânica", description: "Serviços automotivos e manutenção" },
  { value: "SALAO_BELEZA", label: "Salão de Beleza", description: "Cabelo, estética e bem-estar" },
  { value: "CONSULTORIO", label: "Consultório", description: "Atendimento individual por profissional" },
  { value: "ASSISTENCIA_TECNICA", label: "Assistência Técnica", description: "Reparo de equipamentos e eletrônicos" },
  { value: "PRESTADOR_SERVICOS", label: "Prestador de Serviços", description: "Serviços agendados em geral" },
  { value: "PERSONALIZADO", label: "Outro / Personalizado", description: "Monte do seu jeito" }
];

export type RegisterFormState = {
  // Passo 1 — conta
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  adminPhone: string;
  // Passo 2 — segmento
  segment: BusinessSegment | "";
  // Passo 3 — empresa
  companyName: string;
  document: string;
  companyPhone: string;
  // Passo 4 — plano escolhido (todos iniciam o trial por enquanto)
  planSlug: string;
};

export const EMPTY_REGISTER_STATE: RegisterFormState = {
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
  adminPhone: "",
  segment: "",
  companyName: "",
  document: "",
  companyPhone: "",
  planSlug: ""
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muito fraca" | "Fraca" | "Média" | "Forte" | "Muito forte";
  /** Mínimo aceitável para avançar: 8+ caracteres com letra e número. */
  acceptable: boolean;
};

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;

  const labels: PasswordStrength["label"][] = ["Muito fraca", "Fraca", "Média", "Forte", "Muito forte"];

  return {
    score: score as PasswordStrength["score"],
    label: labels[score],
    acceptable: hasMinLength && hasLetter && hasNumber
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Body no formato exato que POST /api/auth/register espera. */
export type RegisterBody = {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
  companyName: string;
  document?: string;
  companyPhone?: string;
  segment: BusinessSegment;
};

export function buildRegisterBody(state: RegisterFormState): RegisterBody {
  if (!state.segment) {
    throw new Error("Segmento é obrigatório para montar o cadastro.");
  }
  const optional = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return {
    adminName: state.adminName.trim(),
    adminEmail: state.adminEmail.trim().toLowerCase(),
    adminPassword: state.adminPassword,
    adminPhone: optional(state.adminPhone),
    companyName: state.companyName.trim(),
    document: optional(state.document),
    companyPhone: optional(state.companyPhone),
    segment: state.segment
  };
}

/** Validação por passo (client). Retorna a 1ª mensagem de erro ou null. */
export function validateStep(step: number, state: RegisterFormState): string | null {
  if (step === 1) {
    if (state.adminName.trim().length < 2) return "Informe seu nome completo.";
    if (!isValidEmail(state.adminEmail)) return "Informe um e-mail válido.";
    if (!evaluatePasswordStrength(state.adminPassword).acceptable) {
      return "A senha precisa ter ao menos 8 caracteres, com letras e números.";
    }
    if (state.adminPassword !== state.adminPasswordConfirm) return "As senhas não coincidem.";
    return null;
  }
  if (step === 2) {
    if (!state.segment) return "Escolha o segmento do seu negócio.";
    return null;
  }
  if (step === 3) {
    if (state.companyName.trim().length < 2) return "Informe o nome da empresa.";
    return null;
  }
  if (step === 4) {
    if (!state.planSlug) return "Escolha um plano para começar.";
    return null;
  }
  return null;
}
