import {
  AppointmentStatus,
  BusinessSegment,
  CustomFieldType,
  EntityType,
  Prisma,
  PrismaClient,
  RoleName,
  RoleScope
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "Admin@123456";

const permissions = [
  ["companies:manage", "Gerenciar empresas no painel master"],
  ["users:manage", "Gerenciar usuarios internos"],
  ["customers:manage", "Gerenciar clientes e pacientes"],
  ["customers:view", "Visualizar clientes"],
  ["services:manage", "Gerenciar servicos"],
  ["services:view", "Visualizar servicos"],
  ["professionals:manage", "Gerenciar profissionais"],
  ["professionals:view", "Visualizar profissionais"],
  ["appointments:manage", "Gerenciar agenda"],
  ["appointments:view", "Visualizar agendamentos"],
  ["custom_fields:manage", "Gerenciar campos personalizados"],
  ["custom_fields:view", "Visualizar campos personalizados"],
  ["reports:view", "Visualizar relatorios"],
  ["reports:advanced", "Relatorios avancados"],
  ["logs:view", "Visualizar logs de auditoria"],
  ["settings:manage", "Alterar configuracoes da empresa"],
  ["financial:view", "Visualizar financeiro"],
  ["financial:manage", "Gerenciar financeiro"],
  ["invoices:manage", "Gerenciar notas fiscais"],
  ["checklists:manage", "Gerenciar checklists"],
  ["checklists:view", "Visualizar checklists"],
  ["public_booking:manage", "Gerenciar agendamento publico"],
  ["clinical_notes:view", "Visualizar dados clínicos sensíveis"]
] as const;

const rolePermissions: Record<RoleName, string[]> = {
  SUPER_ADMIN: permissions.map(p => p[0]),
  COMPANY_ADMIN: [
    "users:manage","customers:manage","customers:view","services:manage","services:view",
    "professionals:manage","professionals:view","appointments:manage","appointments:view",
    "custom_fields:manage","custom_fields:view","reports:view","reports:advanced","logs:view",
    "settings:manage",
    "financial:view","financial:manage","invoices:manage",
    "checklists:manage","checklists:view",
    "public_booking:manage","clinical_notes:view"
  ],
  MANAGER: [
    "customers:manage","customers:view","services:manage","services:view",
    "professionals:manage","professionals:view","appointments:manage","appointments:view",
    "custom_fields:view","reports:view","logs:view","settings:manage",
    "financial:view",
    "checklists:manage","checklists:view"
  ],
  STAFF: [
    "customers:view","customers:manage","services:view","professionals:view",
    "appointments:manage","appointments:view","custom_fields:view",
    "checklists:view"
  ],
  USER: ["customers:view","appointments:view"]
};

async function upsertRole(name: RoleName, scope: RoleScope, description: string) {
  return prisma.role.upsert({ where: { name }, update: { scope, description }, create: { name, scope, description } });
}

async function upsertUser(email: string, name: string, systemRoleId?: string | null) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, status: "ACTIVE", systemRoleId: systemRoleId ?? null },
    create: { name, email, passwordHash, status: "ACTIVE", systemRoleId: systemRoleId ?? null }
  });
}

async function upsertCompany(input: { name: string; tradeName: string; email: string; phone: string; segment: BusinessSegment; slug: string; plan?: string; publicBookingEnabled?: boolean }) {
  const existing = await prisma.company.findFirst({ where: { name: input.name } });
  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: { tradeName: input.tradeName, email: input.email, phone: input.phone, segment: input.segment, status: "ACTIVE", plan: input.plan ?? "starter", slug: input.slug, publicBookingEnabled: input.publicBookingEnabled ?? false }
    });
  }
  return prisma.company.create({ data: { ...input, status: "ACTIVE", plan: input.plan ?? "starter" } });
}

async function linkCompanyUser(companyId: string, userId: string, roleId: string) {
  return prisma.companyUser.upsert({
    where: { companyId_userId: { companyId, userId } },
    update: { roleId, status: "ACTIVE" },
    create: { companyId, userId, roleId, status: "ACTIVE" }
  });
}

async function upsertCustomField(input: {
  companyId: string; entityType: EntityType; label: string; fieldKey: string;
  fieldType: CustomFieldType; sortOrder: number; isRequired?: boolean;
  placeholder?: string; helpText?: string; options?: Prisma.InputJsonValue;
}) {
  return prisma.customField.upsert({
    where: { companyId_entityType_fieldKey: { companyId: input.companyId, entityType: input.entityType, fieldKey: input.fieldKey } },
    update: { label: input.label, fieldType: input.fieldType, sortOrder: input.sortOrder, isRequired: input.isRequired ?? false, placeholder: input.placeholder, helpText: input.helpText, options: input.options === undefined ? undefined : input.options, isActive: true },
    create: { ...input, isRequired: input.isRequired ?? false, isActive: true }
  });
}

async function firstOrCreateCustomer(companyId: string, data: { name: string; email?: string; phone?: string; cpf?: string; notes?: string }) {
  const existing = await prisma.customer.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.customer.create({ data: { companyId, ...data } });
}

async function firstOrCreateService(companyId: string, data: { name: string; description?: string; basePrice?: string; durationMinutes?: number; isPublic?: boolean }) {
  const existing = await prisma.service.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.service.create({ data: { companyId, ...data } });
}

async function firstOrCreateProfessional(companyId: string, data: { name: string; email?: string; phone?: string; specialty?: string }) {
  const existing = await prisma.professional.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.professional.create({ data: { companyId, ...data } });
}

async function saveFieldValue(companyId: string, fieldId: string, entityType: EntityType, entityId: string, value: unknown) {
  await prisma.customFieldValue.upsert({
    where: { companyId_customFieldId_entityType_entityId: { companyId, customFieldId: fieldId, entityType, entityId } },
    update: { value: value as Prisma.InputJsonValue },
    create: { companyId, customFieldId: fieldId, entityType, entityId, value: value as Prisma.InputJsonValue }
  });
}

function appointmentDate(daysFromToday: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  // ─── Roles ──────────────────────────────────────────
  const roles = {
    SUPER_ADMIN: await upsertRole("SUPER_ADMIN", "SYSTEM", "Administrador geral da plataforma"),
    COMPANY_ADMIN: await upsertRole("COMPANY_ADMIN", "TENANT", "Administrador da empresa"),
    MANAGER: await upsertRole("MANAGER", "TENANT", "Gerente operacional"),
    STAFF: await upsertRole("STAFF", "TENANT", "Atendente ou profissional"),
    USER: await upsertRole("USER", "TENANT", "Usuario comum reservado para uso futuro")
  };

  // ─── Permissions ────────────────────────────────────
  const permissionRecords = new Map<string, string>();
  for (const [key, description] of permissions) {
    const permission = await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
    permissionRecords.set(key, permission.id);
  }
  for (const [roleName, keys] of Object.entries(rolePermissions) as [RoleName, string[]][]) {
    for (const key of keys) {
      const permissionId = permissionRecords.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles[roleName].id, permissionId } },
        update: {},
        create: { roleId: roles[roleName].id, permissionId }
      });
    }
  }

  // ─── Plans ──────────────────────────────────────────
  // Starter: operacional completo, SEM financeiro e SEM bot — R$ 49/mês
  const starterDescription = "Dashboard, Agenda, Clientes, Profissionais, Serviços e Link de Agendamento. Perfeito para começar.";
  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {
      name: "Starter", price: 49,
      maxUsers: 5, maxProfessionals: 5, maxCustomers: 2000, maxAppointmentsPerMonth: 1000,
      allowClientSelfScheduling: true, allowAdvancedReports: false, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: false, description: starterDescription
    },
    create: {
      name: "Starter", slug: "starter", description: starterDescription,
      price: 49, maxUsers: 5, maxProfessionals: 5, maxCustomers: 2000, maxAppointmentsPerMonth: 1000,
      allowClientSelfScheduling: true, allowAdvancedReports: false, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: false, sortOrder: 1
    }
  });

  // Pro: tudo do Starter + financeiro completo + relatórios + notas fiscais — R$ 99/mês
  const proDescription = "Tudo do Starter + Financeiro completo, DRE, Notas Fiscais e Relatórios avançados.";
  const proPlan = await prisma.plan.upsert({
    where: { slug: "pro" },
    update: {
      name: "Pro", price: 99,
      maxUsers: 15, maxProfessionals: 15, maxCustomers: 10000, maxAppointmentsPerMonth: 5000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: false, description: proDescription
    },
    create: {
      name: "Pro", slug: "pro", description: proDescription,
      price: 99, maxUsers: 15, maxProfessionals: 15, maxCustomers: 10000, maxAppointmentsPerMonth: 5000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: false, sortOrder: 2
    }
  });

  // Max: tudo do Pro + Bot WhatsApp — R$ 179/mês
  const maxDescription = "Tudo do Pro + Bot WhatsApp com lembretes automáticos e agendamento conversacional.";
  const maxPlan = await prisma.plan.upsert({
    where: { slug: "max" },
    update: {
      name: "Max", price: 179,
      maxUsers: 999, maxProfessionals: 999, maxCustomers: 999999, maxAppointmentsPerMonth: 999999,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: true, description: maxDescription
    },
    create: {
      name: "Max", slug: "max", description: maxDescription,
      price: 179, maxUsers: 999, maxProfessionals: 999, maxCustomers: 999999, maxAppointmentsPerMonth: 999999,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true,
      allowBotIntegration: true, sortOrder: 3
    }
  });

  // ─── Users ──────────────────────────────────────────
  const superAdmin = await upsertUser("admin@marcaiflex.com", "Super Admin", roles.SUPER_ADMIN.id);

  // ─── Companies ──────────────────────────────────────
  const clinic = await upsertCompany({ name: "Clínica Vida", tradeName: "Clínica Vida", email: "contato@clinicavida.com", phone: "(11) 4000-1000", segment: "CLINICA_MEDICA", slug: "clinica-vida", plan: "pro", publicBookingEnabled: true });
  const workshop = await upsertCompany({ name: "Oficina Central", tradeName: "Oficina Central", email: "contato@oficinacentral.com", phone: "(11) 4000-2000", segment: "OFICINA_MECANICA", slug: "oficina-central", plan: "max", publicBookingEnabled: true });
  const salon = await upsertCompany({ name: "Salão Bella", tradeName: "Salão Bella", email: "contato@salaobella.com", phone: "(11) 4000-3000", segment: "SALAO_BELEZA", slug: "salao-bella", plan: "starter" });

  // Subscriptions
  for (const [company, plan] of [[clinic, proPlan], [workshop, maxPlan], [salon, starterPlan]] as const) {
    await prisma.companySubscription.upsert({
      where: { id: `sub-${company.id}` },
      update: { planId: plan.id, status: "ACTIVE" },
      create: { id: `sub-${company.id}`, companyId: company.id, planId: plan.id, status: "ACTIVE" }
    });
  }

  // ─── Company Users ──────────────────────────────────
  const clinicAdmin = await upsertUser("admin@clinicavida.com", "Admin Clínica Vida");
  const workshopAdmin = await upsertUser("admin@oficinacentral.com", "Admin Oficina Central");
  const salonAdmin = await upsertUser("admin@salaobella.com", "Admin Salão Bella");

  await linkCompanyUser(clinic.id, clinicAdmin.id, roles.COMPANY_ADMIN.id);
  await linkCompanyUser(workshop.id, workshopAdmin.id, roles.COMPANY_ADMIN.id);
  await linkCompanyUser(salon.id, salonAdmin.id, roles.COMPANY_ADMIN.id);

  // Extra users with different roles for testing
  const clinicManager = await upsertUser("gerente@clinicavida.com", "Gerente Clínica Vida");
  const clinicStaff = await upsertUser("atendente@clinicavida.com", "Atendente Clínica Vida");
  await linkCompanyUser(clinic.id, clinicManager.id, roles.MANAGER.id);
  await linkCompanyUser(clinic.id, clinicStaff.id, roles.STAFF.id);

  const workshopStaff = await upsertUser("mecanico@oficinacentral.com", "Mecânico Oficina Central");
  await linkCompanyUser(workshop.id, workshopStaff.id, roles.STAFF.id);

  // ─── Custom Fields: CLÍNICA (medical only, no automotive) ──
  const allergy = await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Alergias", fieldKey: "alergias", fieldType: "LONG_TEXT", sortOrder: 1, helpText: "Registre alergias conhecidas." });
  await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Convênio", fieldKey: "convenio", fieldType: "SHORT_TEXT", sortOrder: 2 });
  await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Nº Carteirinha", fieldKey: "numero_carteirinha", fieldType: "SHORT_TEXT", sortOrder: 3 });
  await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Tipo sanguíneo", fieldKey: "tipo_sanguineo", fieldType: "SINGLE_SELECT", sortOrder: 4, options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] });
  await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Medicamentos em uso", fieldKey: "medicamentos_em_uso", fieldType: "LONG_TEXT", sortOrder: 5 });
  await upsertCustomField({ companyId: clinic.id, entityType: "CUSTOMER", label: "Cuidados necessários", fieldKey: "cuidados_necessarios", fieldType: "LONG_TEXT", sortOrder: 6 });
  const clinicalNote = await upsertCustomField({ companyId: clinic.id, entityType: "APPOINTMENT", label: "Motivo da consulta", fieldKey: "motivo_da_consulta", fieldType: "LONG_TEXT", sortOrder: 1, isRequired: true });
  await upsertCustomField({ companyId: clinic.id, entityType: "APPOINTMENT", label: "Tipo de consulta", fieldKey: "tipo_de_consulta", fieldType: "SINGLE_SELECT", sortOrder: 2, options: ["Primeira consulta", "Retorno", "Urgência", "Exame"] });
  await upsertCustomField({ companyId: clinic.id, entityType: "APPOINTMENT", label: "Convênio utilizado", fieldKey: "convenio_utilizado", fieldType: "SHORT_TEXT", sortOrder: 3 });
  await upsertCustomField({ companyId: clinic.id, entityType: "APPOINTMENT", label: "Retorno recomendado", fieldKey: "retorno_recomendado", fieldType: "DATE", sortOrder: 4 });
  await upsertCustomField({ companyId: clinic.id, entityType: "APPOINTMENT", label: "Observação do atendimento", fieldKey: "observacao_atendimento", fieldType: "LONG_TEXT", sortOrder: 5 });

  // ─── Custom Fields: OFICINA MECÂNICA (automotive) ──────
  const plate = await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Placa do veículo", fieldKey: "placa_do_veiculo", fieldType: "SHORT_TEXT", sortOrder: 1, isRequired: true });
  await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Modelo do veículo", fieldKey: "modelo_do_veiculo", fieldType: "SHORT_TEXT", sortOrder: 2 });
  await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Marca", fieldKey: "marca_veiculo", fieldType: "SHORT_TEXT", sortOrder: 3 });
  await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Ano", fieldKey: "ano_veiculo", fieldType: "NUMBER", sortOrder: 4 });
  await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Quilometragem", fieldKey: "quilometragem", fieldType: "NUMBER", sortOrder: 5 });
  await upsertCustomField({ companyId: workshop.id, entityType: "CUSTOMER", label: "Cor do veículo", fieldKey: "cor_veiculo", fieldType: "SHORT_TEXT", sortOrder: 6 });
  await upsertCustomField({ companyId: workshop.id, entityType: "APPOINTMENT", label: "Problema relatado", fieldKey: "problema_relatado", fieldType: "LONG_TEXT", sortOrder: 1 });
  await upsertCustomField({ companyId: workshop.id, entityType: "APPOINTMENT", label: "Diagnóstico", fieldKey: "diagnostico", fieldType: "LONG_TEXT", sortOrder: 2 });
  await upsertCustomField({ companyId: workshop.id, entityType: "APPOINTMENT", label: "Peças utilizadas", fieldKey: "pecas_utilizadas", fieldType: "LONG_TEXT", sortOrder: 3 });
  await upsertCustomField({ companyId: workshop.id, entityType: "APPOINTMENT", label: "Garantia do serviço", fieldKey: "garantia_servico", fieldType: "SHORT_TEXT", sortOrder: 4 });
  await upsertCustomField({ companyId: workshop.id, entityType: "APPOINTMENT", label: "Observações do mecânico", fieldKey: "observacoes_mecanico", fieldType: "LONG_TEXT", sortOrder: 5 });

  // ─── Custom Fields: SALÃO DE BELEZA ────────────────────
  await upsertCustomField({ companyId: salon.id, entityType: "CUSTOMER", label: "Preferência de atendimento", fieldKey: "preferencia_de_atendimento", fieldType: "LONG_TEXT", sortOrder: 1 });
  await upsertCustomField({ companyId: salon.id, entityType: "CUSTOMER", label: "Alergias a produtos", fieldKey: "alergias_produtos", fieldType: "LONG_TEXT", sortOrder: 2 });
  await upsertCustomField({ companyId: salon.id, entityType: "CUSTOMER", label: "Histórico de procedimentos", fieldKey: "historico_procedimentos", fieldType: "LONG_TEXT", sortOrder: 3 });
  await upsertCustomField({ companyId: salon.id, entityType: "APPOINTMENT", label: "Procedimento", fieldKey: "tipo_de_procedimento", fieldType: "SHORT_TEXT", sortOrder: 1 });
  await upsertCustomField({ companyId: salon.id, entityType: "APPOINTMENT", label: "Produto utilizado", fieldKey: "produto_utilizado", fieldType: "SHORT_TEXT", sortOrder: 2 });
  await upsertCustomField({ companyId: salon.id, entityType: "APPOINTMENT", label: "Recomendações pós-procedimento", fieldKey: "recomendacoes_pos", fieldType: "LONG_TEXT", sortOrder: 3 });

  // ─── Customers / Services / Professionals ───────────
  const clinicCustomer = await firstOrCreateCustomer(clinic.id, { name: "Maria Fernanda", email: "maria.fernanda@example.com", phone: "(11) 98888-1000", cpf: "111.222.333-44" });
  const clinicService = await firstOrCreateService(clinic.id, { name: "Consulta médica", description: "Consulta clinica geral", basePrice: "250.00", durationMinutes: 45, isPublic: true });
  // Serviço extra (apenas para popular o catálogo da clínica — não é referenciado abaixo).
  await firstOrCreateService(clinic.id, { name: "Retorno", description: "Retorno de consulta", basePrice: "100.00", durationMinutes: 30, isPublic: true });
  const clinicProfessional = await firstOrCreateProfessional(clinic.id, { name: "Dra. Helena Duarte", email: "helena@clinicavida.com", specialty: "Clínica geral" });

  const workshopCustomer = await firstOrCreateCustomer(workshop.id, { name: "Carlos Roberto", email: "carlos.roberto@example.com", phone: "(11) 98888-2000" });
  const workshopService1 = await firstOrCreateService(workshop.id, { name: "Troca de óleo", description: "Troca de oleo do motor", basePrice: "120.00", durationMinutes: 30 });
  const workshopService2 = await firstOrCreateService(workshop.id, { name: "Revisão dos freios", description: "Revisao completa do sistema de freios", basePrice: "280.00", durationMinutes: 60 });
  const workshopService3 = await firstOrCreateService(workshop.id, { name: "Alinhamento", description: "Alinhamento e balanceamento", basePrice: "180.00", durationMinutes: 45 });
  const workshopProfessional = await firstOrCreateProfessional(workshop.id, { name: "João Mecânico", email: "joao@oficinacentral.com", specialty: "Mecânico" });

  const salonCustomer = await firstOrCreateCustomer(salon.id, { name: "Ana Clara", email: "ana.clara@example.com", phone: "(11) 98888-3000" });
  const salonService = await firstOrCreateService(salon.id, { name: "Corte e escova", description: "Corte feminino com finalizacao", basePrice: "130.00", durationMinutes: 90 });
  const salonProfessional = await firstOrCreateProfessional(salon.id, { name: "Bella Andrade", email: "bella@salaobella.com", specialty: "Cabeleireira" });

  await saveFieldValue(clinic.id, allergy.id, "CUSTOMER", clinicCustomer.id, "Alergia a dipirona.");
  await saveFieldValue(workshop.id, plate.id, "CUSTOMER", workshopCustomer.id, "ABC-1D23");

  // ─── Appointments with multi-service ────────────────
  const clinicStart = appointmentDate(1, 9);
  const clinicEnd = appointmentDate(1, 9, 45);
  let clinicAppointment = await prisma.appointment.findFirst({ where: { companyId: clinic.id, customerId: clinicCustomer.id, startAt: clinicStart } });
  if (!clinicAppointment) {
    clinicAppointment = await prisma.appointment.create({
      data: {
        companyId: clinic.id, customerId: clinicCustomer.id, serviceId: clinicService.id,
        professionalId: clinicProfessional.id, startAt: clinicStart, endAt: clinicEnd,
        status: AppointmentStatus.CONFIRMED, notes: "Primeira consulta",
        totalValue: 250, createdById: clinicAdmin.id, updatedById: clinicAdmin.id,
        appointmentServices: {
          create: { companyId: clinic.id, serviceId: clinicService.id, serviceNameSnapshot: "Consulta médica", unitPrice: 250, totalPrice: 250 }
        }
      }
    });
  }
  await saveFieldValue(clinic.id, clinicalNote.id, "APPOINTMENT", clinicAppointment.id, "Dor de cabeca frequente.");

  // Workshop: multi-service appointment
  const workshopStart = appointmentDate(1, 10);
  const workshopEnd = appointmentDate(1, 12);
  let workshopAppointment = await prisma.appointment.findFirst({ where: { companyId: workshop.id, customerId: workshopCustomer.id, startAt: workshopStart } });
  if (!workshopAppointment) {
    workshopAppointment = await prisma.appointment.create({
      data: {
        companyId: workshop.id, customerId: workshopCustomer.id, serviceId: workshopService1.id,
        professionalId: workshopProfessional.id, startAt: workshopStart, endAt: workshopEnd,
        status: AppointmentStatus.SCHEDULED, notes: "Verificar barulho na suspensao",
        partsValue: 150, laborValue: 280, discountPercent: 5, totalValue: 959.50,
        paymentStatus: "PENDING", createdById: workshopAdmin.id, updatedById: workshopAdmin.id,
        appointmentServices: {
          create: [
            { companyId: workshop.id, serviceId: workshopService1.id, serviceNameSnapshot: "Troca de óleo", unitPrice: 120, totalPrice: 120 },
            { companyId: workshop.id, serviceId: workshopService2.id, serviceNameSnapshot: "Revisão dos freios", unitPrice: 280, totalPrice: 280 },
            { companyId: workshop.id, serviceId: workshopService3.id, serviceNameSnapshot: "Alinhamento", unitPrice: 180, totalPrice: 180 }
          ]
        }
      }
    });
  }

  // Salon appointment
  const salonStart = appointmentDate(2, 14);
  const salonEnd = appointmentDate(2, 15, 30);
  const existingSalonAppt = await prisma.appointment.findFirst({ where: { companyId: salon.id, customerId: salonCustomer.id, startAt: salonStart } });
  if (!existingSalonAppt) {
    await prisma.appointment.create({
      data: {
        companyId: salon.id, customerId: salonCustomer.id, serviceId: salonService.id,
        professionalId: salonProfessional.id, startAt: salonStart, endAt: salonEnd,
        status: AppointmentStatus.SCHEDULED, notes: "Cliente pediu finalizacao natural",
        totalValue: 130, createdById: salonAdmin.id, updatedById: salonAdmin.id,
        appointmentServices: {
          create: { companyId: salon.id, serviceId: salonService.id, serviceNameSnapshot: "Corte e escova", unitPrice: 130, totalPrice: 130 }
        }
      }
    });
  }

  // ─── Financial Categories & Accounts (Pro/Max apenas) ──
  async function seedFinancialDefaults(companyId: string, segment: "clinic" | "workshop") {
    const revenueCats = segment === "clinic"
      ? [{ name: "Consultas" }, { name: "Procedimentos" }]
      : [{ name: "Serviços" }, { name: "Peças" }];
    const costCats = segment === "clinic"
      ? [{ name: "Materiais clínicos" }]
      : [{ name: "Peças e materiais" }];
    const expenseCats = [
      { name: "Aluguel" },
      { name: "Salários e comissões" },
      { name: "Marketing" },
      { name: "Insumos" },
      { name: "Outros" }
    ];

    let sortOrder = 0;
    for (const cat of revenueCats) {
      const existing = await prisma.financialCategory.findFirst({ where: { companyId, name: cat.name, type: "REVENUE" } });
      if (!existing) await prisma.financialCategory.create({ data: { companyId, name: cat.name, type: "REVENUE", sortOrder: sortOrder++ } });
    }
    sortOrder = 0;
    for (const cat of costCats) {
      const existing = await prisma.financialCategory.findFirst({ where: { companyId, name: cat.name, type: "COST" } });
      if (!existing) await prisma.financialCategory.create({ data: { companyId, name: cat.name, type: "COST", sortOrder: sortOrder++ } });
    }
    sortOrder = 0;
    for (const cat of expenseCats) {
      const existing = await prisma.financialCategory.findFirst({ where: { companyId, name: cat.name, type: "EXPENSE" } });
      if (!existing) await prisma.financialCategory.create({ data: { companyId, name: cat.name, type: "EXPENSE", sortOrder: sortOrder++ } });
    }

    const accounts = [
      { name: "Conta principal", type: "CHECKING" as const },
      { name: "Caixa", type: "CASH" as const }
    ];
    let acctOrder = 0;
    for (const acct of accounts) {
      const existing = await prisma.financialAccount.findFirst({ where: { companyId, name: acct.name } });
      if (!existing) await prisma.financialAccount.create({ data: { companyId, name: acct.name, type: acct.type, sortOrder: acctOrder++ } });
    }
  }
  await seedFinancialDefaults(clinic.id, "clinic");
  await seedFinancialDefaults(workshop.id, "workshop");

  // ─── Invoice Config seed (Max - Oficina) ──
  const existingInvoiceConfig = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: workshop.id } });
  if (!existingInvoiceConfig) {
    await prisma.companyInvoiceConfig.create({
      data: {
        companyId: workshop.id,
        cnpj: "00.000.000/0001-00",
        legalName: "Oficina Central Ltda",
        municipalRegistration: "123456",
        issRate: 5.0,
        serviceCode: "1401",
        taxRegime: "SIMPLES",
        autoEmit: false,
        notes: "Configuração de exemplo. Conecte sua chave NFE.io nas Configurações para emissão automática."
      }
    });
  }

  // ─── Checklist templates seed (Max - Oficina) ──
  async function seedChecklistTemplate(
    companyId: string,
    name: string,
    description: string,
    sections: { name: string; items: { description: string; itemType: "CHECKBOX" | "NOTE" | "PHOTO"; isRequired?: boolean }[] }[]
  ) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { companyId, name } });
    if (existing) return existing;
    const template = await prisma.checklistTemplate.create({
      data: {
        companyId,
        name,
        description,
        status: "ACTIVE",
        estimatedMinutes: 30,
        sortOrder: 0
      }
    });
    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const section = await prisma.checklistSection.create({
        data: { companyId, templateId: template.id, name: sec.name, sortOrder: s }
      });
      for (let i = 0; i < sec.items.length; i++) {
        const it = sec.items[i];
        await prisma.checklistTemplateItem.create({
          data: {
            companyId,
            sectionId: section.id,
            description: it.description,
            itemType: it.itemType,
            isRequired: it.isRequired ?? false,
            sortOrder: i
          }
        });
      }
    }
    return template;
  }

  await seedChecklistTemplate(
    workshop.id,
    "Recepção de veículo",
    "Vistoria padrão de entrada e diagnóstico inicial",
    [
      {
        name: "Recepção",
        items: [
          { description: "Conferir placa e modelo", itemType: "CHECKBOX", isRequired: true },
          { description: "Vistoria visual da carroceria", itemType: "CHECKBOX", isRequired: true },
          { description: "Foto do veículo (lateral e frente)", itemType: "PHOTO" },
          { description: "Quilometragem atual", itemType: "NOTE", isRequired: true }
        ]
      },
      {
        name: "Diagnóstico",
        items: [
          { description: "Testar motor em marcha lenta", itemType: "CHECKBOX" },
          { description: "Verificar nível de óleo", itemType: "CHECKBOX" },
          { description: "Descrição do problema relatado", itemType: "NOTE", isRequired: true }
        ]
      },
      {
        name: "Entrega",
        items: [
          { description: "Teste de funcionamento pós-reparo", itemType: "CHECKBOX", isRequired: true },
          { description: "Orientações entregues ao cliente", itemType: "NOTE" }
        ]
      }
    ]
  );

  await seedChecklistTemplate(
    workshop.id,
    "Troca de óleo",
    "Procedimento padrão de troca de óleo e filtro",
    [
      {
        name: "Preparação",
        items: [
          { description: "Conferir tipo de óleo recomendado", itemType: "CHECKBOX", isRequired: true },
          { description: "Conferir filtro compatível", itemType: "CHECKBOX", isRequired: true }
        ]
      },
      {
        name: "Execução",
        items: [
          { description: "Drenar óleo antigo", itemType: "CHECKBOX", isRequired: true },
          { description: "Substituir filtro", itemType: "CHECKBOX", isRequired: true },
          { description: "Abastecer com novo óleo", itemType: "CHECKBOX", isRequired: true },
          { description: "Foto da etiqueta de quilometragem", itemType: "PHOTO" }
        ]
      }
    ]
  );

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id, action: "seed.executed", entityType: "system",
      newValues: { message: "Seed v2 do MarcaiFlex executado com planos, multi-servico e usuarios por perfil" }
    }
  });

  console.log("\n✅ Seed finalizado com sucesso!\n");
  console.log("═══ Credenciais ═══");
  console.log("Super Admin:      admin@marcaiflex.com / Admin@123456");
  console.log("Clínica (Admin):  admin@clinicavida.com / Admin@123456  [Plano Pro]");
  console.log("Clínica (Gerente):gerente@clinicavida.com / Admin@123456");
  console.log("Clínica (Staff):  atendente@clinicavida.com / Admin@123456");
  console.log("Oficina (Admin):  admin@oficinacentral.com / Admin@123456  [Plano Max]");
  console.log("Oficina (Staff):  mecanico@oficinacentral.com / Admin@123456");
  console.log("Salão (Admin):    admin@salaobella.com / Admin@123456  [Plano Starter]");
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
