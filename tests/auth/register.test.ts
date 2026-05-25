import { beforeEach, describe, expect, it, vi } from "vitest";

// provisionTenant recebe um client de transação (tx). Aqui usamos um mock que
// imita os métodos do Prisma usados pela função, exercitando a lógica real
// (checagem de e-mail, hashing, slug à prova de colisão, trial TRIALING).
const { txMock } = vi.hoisted(() => ({
  txMock: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    plan: { findUnique: vi.fn() },
    role: { findUniqueOrThrow: vi.fn() },
    company: { findUnique: vi.fn(), create: vi.fn() },
    companyUser: { create: vi.fn() },
    companySubscription: { create: vi.fn() }
  } as any
}));

import { provisionTenant } from "@/lib/services/provision-tenant";

const MAX_PLAN = { id: "plan-max", slug: "max" };
const ADMIN_ROLE = { id: "role-admin", name: "COMPANY_ADMIN" };

function baseInput() {
  return {
    company: { name: "Clínica São José", document: "12.345.678/0001-90", phone: "11999990000", segment: "CLINICA_MEDICA" as const },
    admin: { name: "Dra. Ana", email: "Ana@Example.com", password: "Senha@12345" }
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  txMock.user.findUnique.mockResolvedValue(null); // e-mail livre
  txMock.plan.findUnique.mockResolvedValue(MAX_PLAN);
  txMock.role.findUniqueOrThrow.mockResolvedValue(ADMIN_ROLE);
  txMock.company.findUnique.mockResolvedValue(null); // slug livre
  txMock.company.create.mockImplementation(async ({ data }: any) => ({ id: "company-1", ...data }));
  txMock.user.create.mockImplementation(async ({ data }: any) => ({ id: "user-1", ...data }));
  txMock.companyUser.create.mockResolvedValue({ id: "membership-1" });
  txMock.companySubscription.create.mockImplementation(async ({ data }: any) => ({ id: "sub-1", ...data }));
});

describe("provisionTenant — criação transacional do tenant", () => {
  it("cria Company + User + Membership + Subscription TRIALING", async () => {
    const result = await provisionTenant(txMock, baseInput());

    expect(txMock.company.create).toHaveBeenCalledTimes(1);
    expect(txMock.user.create).toHaveBeenCalledTimes(1);
    expect(txMock.companyUser.create).toHaveBeenCalledTimes(1);
    expect(txMock.companySubscription.create).toHaveBeenCalledTimes(1);

    // Company ACTIVE no plano de trial (max)
    const companyData = txMock.company.create.mock.calls[0][0].data;
    expect(companyData.status).toBe("ACTIVE");
    expect(companyData.plan).toBe("max");

    // Membership vinculada ao papel COMPANY_ADMIN
    const membershipData = txMock.companyUser.create.mock.calls[0][0].data;
    expect(membershipData.roleId).toBe(ADMIN_ROLE.id);
    expect(membershipData.status).toBe("ACTIVE");

    // Assinatura TRIALING no plano max
    const subData = txMock.companySubscription.create.mock.calls[0][0].data;
    expect(subData.status).toBe("TRIALING");
    expect(subData.planId).toBe(MAX_PLAN.id);

    expect(result.role).toBe("COMPANY_ADMIN");
    expect(result.subscription.status).toBe("TRIALING");
  });

  it("rejeita e-mail já existente", async () => {
    txMock.user.findUnique.mockResolvedValue({ id: "existing" });

    await expect(provisionTenant(txMock, baseInput())).rejects.toMatchObject({ status: 409 });
    expect(txMock.company.create).not.toHaveBeenCalled();
    expect(txMock.user.create).not.toHaveBeenCalled();
  });

  it("define trialEndsAt ~7 dias no futuro", async () => {
    const before = Date.now();
    await provisionTenant(txMock, baseInput());
    const after = Date.now();

    const subData = txMock.companySubscription.create.mock.calls[0][0].data;
    const trialEndsAt = subData.trialEndsAt as Date;
    expect(trialEndsAt).toBeInstanceOf(Date);

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(trialEndsAt.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(trialEndsAt.getTime()).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  it("hasheia a senha (nunca em texto puro)", async () => {
    await provisionTenant(txMock, baseInput());

    const userData = txMock.user.create.mock.calls[0][0].data;
    expect(userData.passwordHash).toBeDefined();
    expect(userData.passwordHash).not.toBe("Senha@12345");
    expect(userData.passwordHash.startsWith("$2")).toBe(true); // prefixo bcrypt
    expect(JSON.stringify(userData)).not.toContain("Senha@12345");
    // E-mail normalizado para minúsculas
    expect(userData.email).toBe("ana@example.com");
  });

  it("gera slug único quando o slug-base já existe", async () => {
    // Primeiro slug colide; o segundo está livre.
    txMock.company.findUnique
      .mockResolvedValueOnce({ id: "other-company" })
      .mockResolvedValueOnce(null);

    await provisionTenant(txMock, baseInput());

    const companyData = txMock.company.create.mock.calls[0][0].data;
    expect(companyData.slug).toBe("clinica-sao-jose-2");
  });
});
