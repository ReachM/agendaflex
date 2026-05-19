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
    "settings:manage","financial:view","financial:manage","invoices:manage",
    "checklists:manage","checklists:view","public_booking:manage","clinical_notes:view"
  ],
  MANAGER: [
    "customers:manage","customers:view","services:manage","services:view",
    "professionals:manage","professionals:view","appointments:manage","appointments:view",
    "custom_fields:view","reports:view","logs:view","settings:manage","financial:view",
    "checklists:manage","checklists:view"
  ],
  STAFF: [
    "customers:view","customers:manage","services:view","professionals:view",
    "appointments:manage","appointments:view","custom_fields:view","checklists:view"
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
  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {
      maxUsers: 3, maxProfessionals: 3, maxCustomers: 500, maxAppointmentsPerMonth: 300,
      allowClientSelfScheduling: false, allowAdvancedReports: false, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true
    },
    create: {
      name: "Starter", slug: "starter", description: "Plano básico com dashboard, agenda, clientes, serviços, profissionais, checklist básico e relatórios simples.",
      price: 0, maxUsers: 3, maxProfessionals: 3, maxCustomers: 500, maxAppointmentsPerMonth: 300,
      allowClientSelfScheduling: false, allowAdvancedReports: false, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true, sortOrder: 1
    }
  });

  const proPlan = await prisma.plan.upsert({
    where: { slug: "pro" },
    update: {
      maxUsers: 10, maxProfessionals: 10, maxCustomers: 5000, maxAppointmentsPerMonth: 2000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true
    },
    create: {
      name: "Pro", slug: "pro", description: "Tudo do Starter + agendamento público, relatórios intermediários, checklist completo, mais usuários e profissionais.",
      price: 99.90, maxUsers: 10, maxProfessionals: 10, maxCustomers: 5000, maxAppointmentsPerMonth: 2000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: false,
      allowInvoiceRequest: false, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true, sortOrder: 2
    }
  });

  const maxPlan = await prisma.plan.upsert({
    where: { slug: "max" },
    update: {
      maxUsers: 100, maxProfessionals: 100, maxCustomers: 50000, maxAppointmentsPerMonth: 50000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true
    },
    create: {
      name: "Max", slug: "max", description: "Tudo do Pro + controle financeiro, relatórios avançados, gráficos, nota fiscal, via do cliente, logs avançados, limites altos.",
      price: 199.90, maxUsers: 100, maxProfessionals: 100, maxCustomers: 50000, maxAppointmentsPerMonth: 50000,
      allowClientSelfScheduling: true, allowAdvancedReports: true, allowFinancialControl: true,
      allowInvoiceRequest: true, allowCustomerChecklist: true, allowAuditLogs: true,
      allowCustomFields: true, allowMultipleServicesPerAppointment: true, sortOrder: 3
    }
  });

  // ─── Users ──────────────────────────────────────────
  const superAdmin = await upsertUser("admin@agendaflex.com", "Super Admin", roles.SUPER_ADMIN.id);

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
  const clinicService2 = await firstOrCreateService(clinic.id, { name: "Retorno", description: "Retorno de consulta", basePrice: "100.00", durationMinutes: 30, isPublic: true });
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
    const servicesTotal = 120 + 280 + 180; // 580
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

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id, action: "seed.executed", entityType: "system",
      newValues: { message: "Seed v2 do AgendaFlex executado com planos, multi-servico e usuarios por perfil" }
    }
  });

  console.log("\n✅ Seed finalizado com sucesso!\n");
  console.log("═══ Credenciais ═══");
  console.log("Super Admin:      admin@agendaflex.com / Admin@123456");
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
