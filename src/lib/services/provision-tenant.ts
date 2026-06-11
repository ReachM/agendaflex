import type { BusinessSegment, Prisma, RoleName, SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/security/password";

const TRIAL_PLAN_SLUG = "starter";
// 7 dias para alinhar com a comunicação (landing, SEO, termos e telas de auth).
const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProvisionTenantInput = {
  company: {
    name: string;
    document?: string;
    phone?: string;
    segment: BusinessSegment;
  };
  admin: {
    name: string;
    email: string;
    password: string;
    /** Vincula a conta Google já no provisionamento (login social). */
    googleId?: string;
  };
  planSlug?: string;
  trialDays?: number;
  subscriptionStatus?: SubscriptionStatus;
};

export type ProvisionTenantResult = {
  company: { id: string; name: string; slug: string | null; segment: BusinessSegment };
  user: { id: string; name: string; email: string };
  role: RoleName;
  subscription: { id: string; status: SubscriptionStatus; trialEndsAt: Date | null };
};

function stripDiacritics(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFD")) {
    const code = ch.charCodeAt(0);
    if (code >= 0x300 && code <= 0x36f) continue; // marcas combinantes
    out += ch;
  }
  return out;
}

function slugify(name: string): string {
  const base = stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .slice(0, 60);
  return base || "empresa";
}

async function uniqueSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  while (await tx.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base.slice(0, 56)}-${suffix}`;
  }
  return candidate;
}

/**
 * Cria, dentro de UMA transação (o `tx` recebido), o ambiente completo de um novo
 * cliente: Company (ACTIVE, slug único), User admin (senha hasheada), Membership
 * COMPANY_ADMIN e CompanySubscription. Reutilizável pelo endpoint público de
 * registro e, futuramente, pelo seed. NÃO autentica nem cria cobrança.
 */
export async function provisionTenant(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const email = input.admin.email.trim().toLowerCase();

  const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "Já existe uma conta com este e-mail.");
  }

  const planSlug = input.planSlug ?? TRIAL_PLAN_SLUG;
  const plan = await tx.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    // Erro 500 explícito — sem o plano de trial cadastrado, NÃO criamos uma
    // assinatura sem plano (o schema exige planId NOT NULL e o front depende
    // do slug para exibir o plano correto na tela).
    console.error(`[provisionTenant] Plano "${planSlug}" não encontrado no banco.`);
    throw new ApiError(500, `Plano "${planSlug}" não cadastrado. Rode o seed antes de provisionar tenants.`);
  }

  const adminRole = await tx.role.findUniqueOrThrow({ where: { name: "COMPANY_ADMIN" } });

  const slug = await uniqueSlug(tx, slugify(input.company.name));

  const company = await tx.company.create({
    data: {
      name: input.company.name,
      tradeName: input.company.name,
      document: input.company.document,
      // Company.email é obrigatório e não vem no body do registro: usamos o e-mail
      // do admin como contato inicial da empresa.
      email,
      phone: input.company.phone,
      segment: input.company.segment,
      status: "ACTIVE",
      slug,
      plan: plan.slug
    }
  });

  const user = await tx.user.create({
    data: {
      name: input.admin.name,
      email,
      passwordHash: await hashPassword(input.admin.password),
      googleId: input.admin.googleId,
      status: "ACTIVE"
    }
  });

  await tx.companyUser.create({
    data: {
      companyId: company.id,
      userId: user.id,
      roleId: adminRole.id,
      status: "ACTIVE"
    }
  });

  const status: SubscriptionStatus = input.subscriptionStatus ?? "TRIALING";
  const trialDays = input.trialDays ?? TRIAL_DAYS;
  // Em ms (dias * 24h * 60min * 60s * 1000) — explicitar via DAY_MS evita o
  // bug clássico de digitar 7*60*60*1000 (= 7 horas) por engano.
  const trialEndsAt =
    status === "TRIALING" ? new Date(Date.now() + trialDays * DAY_MS) : null;
  if (trialEndsAt) {
    console.log(`[Trial] empresa "${input.company.name}" — trialEndsAt: ${trialEndsAt.toISOString()} (${trialDays} dias)`);
  }

  const subscription = await tx.companySubscription.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status,
      trialEndsAt
    }
  });

  return {
    company: { id: company.id, name: company.name, slug: company.slug, segment: company.segment },
    user: { id: user.id, name: user.name, email: user.email },
    role: adminRole.name,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt
    }
  };
}
