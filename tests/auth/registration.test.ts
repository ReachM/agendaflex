import { describe, expect, it } from "vitest";
import {
  buildRegisterBody,
  EMPTY_REGISTER_STATE,
  evaluatePasswordStrength,
  SEGMENTS,
  validateStep,
  type RegisterFormState
} from "@/lib/registration";

// Valores EXATOS do enum BusinessSegment do Prisma. O cadastro nunca pode
// oferecer um segmento fora desta lista.
const ENUM_SEGMENTS = [
  "CLINICA_MEDICA",
  "OFICINA_MECANICA",
  "SALAO_BELEZA",
  "CONSULTORIO",
  "ASSISTENCIA_TECNICA",
  "PRESTADOR_SERVICOS",
  "PERSONALIZADO"
];

function filledState(overrides: Partial<RegisterFormState> = {}): RegisterFormState {
  return {
    ...EMPTY_REGISTER_STATE,
    adminName: "Maria Souza",
    adminEmail: "  Maria@Example.com ",
    adminPassword: "Senha1234",
    adminPasswordConfirm: "Senha1234",
    adminPhone: "  11999990000 ",
    segment: "SALAO_BELEZA",
    companyName: "  Salão Bella ",
    document: " 12.345.678/0001-90 ",
    companyPhone: "",
    planSlug: "max",
    ...overrides
  };
}

describe("SEGMENTS — mapeamento rótulo -> enum", () => {
  it("contém exatamente os 7 valores do enum, sem inventar", () => {
    expect(SEGMENTS.map((s) => s.value)).toEqual(ENUM_SEGMENTS);
  });

  it("todo segmento tem rótulo PT-BR amigável não vazio", () => {
    for (const seg of SEGMENTS) {
      expect(seg.label.trim().length).toBeGreaterThan(0);
      expect(ENUM_SEGMENTS).toContain(seg.value);
    }
  });

  it("rótulos esperados apontam para o enum correto", () => {
    const byLabel = Object.fromEntries(SEGMENTS.map((s) => [s.label, s.value]));
    expect(byLabel["Clínica Médica"]).toBe("CLINICA_MEDICA");
    expect(byLabel["Oficina Mecânica"]).toBe("OFICINA_MECANICA");
    expect(byLabel["Salão de Beleza"]).toBe("SALAO_BELEZA");
    expect(byLabel["Outro / Personalizado"]).toBe("PERSONALIZADO");
  });
});

describe("buildRegisterBody — montagem do body de registro", () => {
  it("monta o body no formato esperado pela rota, com trim, e-mail normalizado e documento/telefone só com dígitos", () => {
    const body = buildRegisterBody(filledState());
    expect(body).toEqual({
      adminName: "Maria Souza",
      adminEmail: "maria@example.com",
      adminPassword: "Senha1234",
      adminPhone: "11999990000",
      companyName: "Salão Bella",
      // document é enviado apenas com dígitos — o front pode mostrar formatado, mas a API recebe canônico
      document: "12345678000190",
      companyPhone: undefined,
      segment: "SALAO_BELEZA"
    });
  });

  it("omite campos opcionais vazios (undefined) e nunca vaza confirmação de senha", () => {
    const body = buildRegisterBody(filledState({ adminPhone: "   ", document: "" }));
    expect(body.adminPhone).toBeUndefined();
    expect(body.document).toBeUndefined();
    expect(body).not.toHaveProperty("adminPasswordConfirm");
  });

  it("lança se o segmento não foi escolhido", () => {
    expect(() => buildRegisterBody(filledState({ segment: "" }))).toThrow();
  });
});

describe("evaluatePasswordStrength", () => {
  it("rejeita senha curta", () => {
    expect(evaluatePasswordStrength("abc").acceptable).toBe(false);
  });

  it("aceita 8+ caracteres com letra e número", () => {
    expect(evaluatePasswordStrength("senha123").acceptable).toBe(true);
  });

  it("dá score maior para senha com maiúsculas, números e símbolos", () => {
    expect(evaluatePasswordStrength("Senha@1234").score).toBeGreaterThanOrEqual(3);
  });
});

describe("validateStep", () => {
  it("passo 1 exige senhas coincidentes", () => {
    expect(validateStep(1, filledState({ adminPasswordConfirm: "outra" }))).toMatch(/coincidem/i);
  });

  it("passo 2 exige segmento", () => {
    expect(validateStep(2, filledState({ segment: "" }))).toMatch(/segmento/i);
  });

  it("passo 3 exige nome da empresa", () => {
    expect(validateStep(3, filledState({ companyName: " " }))).toMatch(/empresa/i);
  });

  it("estado completo válido passa em todos os passos", () => {
    const state = filledState();
    expect(validateStep(1, state)).toBeNull();
    expect(validateStep(2, state)).toBeNull();
    expect(validateStep(3, state)).toBeNull();
    expect(validateStep(4, state)).toBeNull();
  });
});
