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
  ["services:manage", "Gerenciar servicos"],
  ["professionals:manage", "Gerenciar profissionais"],
  ["appointments:manage", "Gerenciar agenda"],
  ["custom_fields:manage", "Gerenciar campos personalizados"],
  ["reports:view", "Visualizar relatorios"],
  ["logs:view", "Visualizar logs de auditoria"],
  ["settings:manage", "Alterar configuracoes da empresa"]
] as const;

const rolePermissions: Record<RoleName, string[]> = {
  SUPER_ADMIN: [
    "companies:manage",
    "users:manage",
    "customers:manage",
    "services:manage",
    "professionals:manage",
    "appointments:manage",
    "custom_fields:manage",
    "reports:view",
    "logs:view",
    "settings:manage"
  ],
  COMPANY_ADMIN: [
    "users:manage",
    "customers:manage",
    "services:manage",
    "professionals:manage",
    "appointments:manage",
    "custom_fields:manage",
    "reports:view",
    "logs:view",
    "settings:manage"
  ],
  MANAGER: [
    "customers:manage",
    "services:manage",
    "professionals:manage",
    "appointments:manage",
    "reports:view",
    "logs:view"
  ],
  STAFF: ["customers:manage", "appointments:manage"],
  USER: []
};

async function upsertRole(name: RoleName, scope: RoleScope, description: string) {
  return prisma.role.upsert({
    where: { name },
    update: { scope, description },
    create: { name, scope, description }
  });
}

async function upsertUser(email: string, name: string, systemRoleId?: string | null) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      status: "ACTIVE",
      systemRoleId: systemRoleId ?? null
    },
    create: {
      name,
      email,
      passwordHash,
      status: "ACTIVE",
      systemRoleId: systemRoleId ?? null
    }
  });
}

async function upsertCompany(input: {
  name: string;
  tradeName: string;
  email: string;
  phone: string;
  segment: BusinessSegment;
}) {
  const existing = await prisma.company.findFirst({
    where: { name: input.name }
  });

  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: {
        tradeName: input.tradeName,
        email: input.email,
        phone: input.phone,
        segment: input.segment,
        status: "ACTIVE",
        plan: "starter"
      }
    });
  }

  return prisma.company.create({
    data: {
      ...input,
      status: "ACTIVE",
      plan: "starter"
    }
  });
}

async function linkCompanyAdmin(companyId: string, userId: string, roleId: string) {
  return prisma.companyUser.upsert({
    where: { companyId_userId: { companyId, userId } },
    update: { roleId, status: "ACTIVE" },
    create: { companyId, userId, roleId, status: "ACTIVE" }
  });
}

async function upsertCustomField(input: {
  companyId: string;
  entityType: EntityType;
  label: string;
  fieldKey: string;
  fieldType: CustomFieldType;
  sortOrder: number;
  isRequired?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Prisma.InputJsonValue;
}) {
  return prisma.customField.upsert({
    where: {
      companyId_entityType_fieldKey: {
        companyId: input.companyId,
        entityType: input.entityType,
        fieldKey: input.fieldKey
      }
    },
    update: {
      label: input.label,
      fieldType: input.fieldType,
      sortOrder: input.sortOrder,
      isRequired: input.isRequired ?? false,
      placeholder: input.placeholder,
      helpText: input.helpText,
      options: input.options === undefined ? undefined : input.options,
      isActive: true
    },
    create: {
      companyId: input.companyId,
      entityType: input.entityType,
      label: input.label,
      fieldKey: input.fieldKey,
      fieldType: input.fieldType,
      sortOrder: input.sortOrder,
      isRequired: input.isRequired ?? false,
      placeholder: input.placeholder,
      helpText: input.helpText,
      options: input.options === undefined ? undefined : input.options,
      isActive: true
    }
  });
}

async function firstOrCreateCustomer(companyId: string, data: {
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  notes?: string;
}) {
  const existing = await prisma.customer.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.customer.create({ data: { companyId, ...data } });
}

async function firstOrCreateService(companyId: string, data: {
  name: string;
  description?: string;
  basePrice?: string;
  durationMinutes?: number;
}) {
  const existing = await prisma.service.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.service.create({ data: { companyId, ...data } });
}

async function firstOrCreateProfessional(companyId: string, data: {
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
}) {
  const existing = await prisma.professional.findFirst({ where: { companyId, name: data.name } });
  if (existing) return existing;
  return prisma.professional.create({ data: { companyId, ...data } });
}

async function saveFieldValue(companyId: string, fieldId: string, entityType: EntityType, entityId: string, value: unknown) {
  await prisma.customFieldValue.upsert({
    where: {
      companyId_customFieldId_entityType_entityId: {
        companyId,
        customFieldId: fieldId,
        entityType,
        entityId
      }
    },
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
  const roles = {
    SUPER_ADMIN: await upsertRole("SUPER_ADMIN", "SYSTEM", "Administrador geral da plataforma"),
    COMPANY_ADMIN: await upsertRole("COMPANY_ADMIN", "TENANT", "Administrador da empresa"),
    MANAGER: await upsertRole("MANAGER", "TENANT", "Gerente operacional"),
    STAFF: await upsertRole("STAFF", "TENANT", "Atendente ou profissional"),
    USER: await upsertRole("USER", "TENANT", "Usuario comum reservado para uso futuro")
  };

  const permissionRecords = new Map<string, string>();
  for (const [key, description] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description }
    });
    permissionRecords.set(key, permission.id);
  }

  for (const [roleName, keys] of Object.entries(rolePermissions) as [RoleName, string[]][]) {
    for (const key of keys) {
      const permissionId = permissionRecords.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles[roleName].id,
            permissionId
          }
        },
        update: {},
        create: {
          roleId: roles[roleName].id,
          permissionId
        }
      });
    }
  }

  const superAdmin = await upsertUser("admin@agendaflex.com", "Super Admin", roles.SUPER_ADMIN.id);

  const clinic = await upsertCompany({
    name: "Clínica Vida",
    tradeName: "Clínica Vida",
    email: "contato@clinicavida.com",
    phone: "(11) 4000-1000",
    segment: "CLINICA_MEDICA"
  });

  const workshop = await upsertCompany({
    name: "Oficina Central",
    tradeName: "Oficina Central",
    email: "contato@oficinacentral.com",
    phone: "(11) 4000-2000",
    segment: "OFICINA_MECANICA"
  });

  const salon = await upsertCompany({
    name: "Salão Bella",
    tradeName: "Salão Bella",
    email: "contato@salaobella.com",
    phone: "(11) 4000-3000",
    segment: "SALAO_BELEZA"
  });

  const clinicAdmin = await upsertUser("admin@clinicavida.com", "Admin Clínica Vida");
  const workshopAdmin = await upsertUser("admin@oficinacentral.com", "Admin Oficina Central");
  const salonAdmin = await upsertUser("admin@salaobella.com", "Admin Salão Bella");

  await linkCompanyAdmin(clinic.id, clinicAdmin.id, roles.COMPANY_ADMIN.id);
  await linkCompanyAdmin(workshop.id, workshopAdmin.id, roles.COMPANY_ADMIN.id);
  await linkCompanyAdmin(salon.id, salonAdmin.id, roles.COMPANY_ADMIN.id);

  const allergy = await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Alergias",
    fieldKey: "alergias",
    fieldType: "LONG_TEXT",
    sortOrder: 1,
    helpText: "Registre alergias conhecidas e reações importantes."
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Convênio",
    fieldKey: "convenio",
    fieldType: "SHORT_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Número da carteirinha",
    fieldKey: "numero_carteirinha",
    fieldType: "SHORT_TEXT",
    sortOrder: 3
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Medicamentos em uso",
    fieldKey: "medicamentos_em_uso",
    fieldType: "LONG_TEXT",
    sortOrder: 4
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Cuidados necessários",
    fieldKey: "cuidados_necessarios",
    fieldType: "LONG_TEXT",
    sortOrder: 5
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "CUSTOMER",
    label: "Tipo sanguíneo",
    fieldKey: "tipo_sanguineo",
    fieldType: "SINGLE_SELECT",
    sortOrder: 6,
    options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  });
  const clinicalNote = await upsertCustomField({
    companyId: clinic.id,
    entityType: "APPOINTMENT",
    label: "Motivo da consulta",
    fieldKey: "motivo_da_consulta",
    fieldType: "LONG_TEXT",
    sortOrder: 1,
    isRequired: true
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "APPOINTMENT",
    label: "Pressão arterial",
    fieldKey: "pressao_arterial",
    fieldType: "SHORT_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: clinic.id,
    entityType: "APPOINTMENT",
    label: "Observação clínica",
    fieldKey: "observacao_clinica",
    fieldType: "LONG_TEXT",
    sortOrder: 3
  });

  const plate = await upsertCustomField({
    companyId: workshop.id,
    entityType: "CUSTOMER",
    label: "Placa do veículo",
    fieldKey: "placa_do_veiculo",
    fieldType: "SHORT_TEXT",
    sortOrder: 1,
    isRequired: true
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "CUSTOMER",
    label: "Modelo do veículo",
    fieldKey: "modelo_do_veiculo",
    fieldType: "SHORT_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "CUSTOMER",
    label: "Ano do veículo",
    fieldKey: "ano_do_veiculo",
    fieldType: "NUMBER",
    sortOrder: 3
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "CUSTOMER",
    label: "Quilometragem",
    fieldKey: "quilometragem",
    fieldType: "NUMBER",
    sortOrder: 4
  });
  const labor = await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Valor da mão de obra",
    fieldKey: "valor_da_mao_de_obra",
    fieldType: "MONEY",
    sortOrder: 4
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Problema relatado",
    fieldKey: "problema_relatado",
    fieldType: "LONG_TEXT",
    sortOrder: 1
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Diagnóstico",
    fieldKey: "diagnostico",
    fieldType: "LONG_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Valor da peça",
    fieldKey: "valor_da_peca",
    fieldType: "MONEY",
    sortOrder: 3
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Desconto em porcentagem",
    fieldKey: "desconto_em_porcentagem",
    fieldType: "PERCENT",
    sortOrder: 5
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Valor total",
    fieldKey: "valor_total",
    fieldType: "MONEY",
    sortOrder: 6
  });
  await upsertCustomField({
    companyId: workshop.id,
    entityType: "APPOINTMENT",
    label: "Garantia do serviço",
    fieldKey: "garantia_do_servico",
    fieldType: "SHORT_TEXT",
    sortOrder: 7
  });

  await upsertCustomField({
    companyId: salon.id,
    entityType: "CUSTOMER",
    label: "Preferência de atendimento",
    fieldKey: "preferencia_de_atendimento",
    fieldType: "LONG_TEXT",
    sortOrder: 1
  });
  await upsertCustomField({
    companyId: salon.id,
    entityType: "CUSTOMER",
    label: "Produto que costuma usar",
    fieldKey: "produto_que_costuma_usar",
    fieldType: "SHORT_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: salon.id,
    entityType: "APPOINTMENT",
    label: "Tipo de procedimento",
    fieldKey: "tipo_de_procedimento",
    fieldType: "SHORT_TEXT",
    sortOrder: 1
  });
  await upsertCustomField({
    companyId: salon.id,
    entityType: "APPOINTMENT",
    label: "Produto utilizado",
    fieldKey: "produto_utilizado",
    fieldType: "SHORT_TEXT",
    sortOrder: 2
  });
  await upsertCustomField({
    companyId: salon.id,
    entityType: "APPOINTMENT",
    label: "Comissão do profissional",
    fieldKey: "comissao_do_profissional",
    fieldType: "PERCENT",
    sortOrder: 3
  });
  await upsertCustomField({
    companyId: salon.id,
    entityType: "APPOINTMENT",
    label: "Tempo estimado",
    fieldKey: "tempo_estimado",
    fieldType: "NUMBER",
    sortOrder: 4
  });

  const clinicCustomer = await firstOrCreateCustomer(clinic.id, {
    name: "Maria Fernanda",
    email: "maria.fernanda@example.com",
    phone: "(11) 98888-1000",
    cpf: "111.222.333-44",
    notes: "Paciente prefere atendimento no periodo da manha."
  });
  const clinicService = await firstOrCreateService(clinic.id, {
    name: "Consulta médica",
    description: "Consulta clinica geral",
    basePrice: "250.00",
    durationMinutes: 45
  });
  const clinicProfessional = await firstOrCreateProfessional(clinic.id, {
    name: "Dra. Helena Duarte",
    email: "helena@clinicavida.com",
    phone: "(11) 97777-1000",
    specialty: "Clínica geral"
  });

  const workshopCustomer = await firstOrCreateCustomer(workshop.id, {
    name: "Carlos Roberto",
    email: "carlos.roberto@example.com",
    phone: "(11) 98888-2000",
    notes: "Cliente recorrente."
  });
  const workshopService = await firstOrCreateService(workshop.id, {
    name: "Revisão completa",
    description: "Revisao preventiva com checklist",
    basePrice: "480.00",
    durationMinutes: 120
  });
  const workshopProfessional = await firstOrCreateProfessional(workshop.id, {
    name: "João Mecânico",
    email: "joao@oficinacentral.com",
    phone: "(11) 97777-2000",
    specialty: "Mecânico"
  });

  const salonCustomer = await firstOrCreateCustomer(salon.id, {
    name: "Ana Clara",
    email: "ana.clara@example.com",
    phone: "(11) 98888-3000",
    notes: "Cliente prefere produtos sem amonia."
  });
  const salonService = await firstOrCreateService(salon.id, {
    name: "Corte e escova",
    description: "Corte feminino com finalizacao",
    basePrice: "130.00",
    durationMinutes: 90
  });
  const salonProfessional = await firstOrCreateProfessional(salon.id, {
    name: "Bella Andrade",
    email: "bella@salaobella.com",
    phone: "(11) 97777-3000",
    specialty: "Cabeleireira"
  });

  await saveFieldValue(clinic.id, allergy.id, "CUSTOMER", clinicCustomer.id, "Alergia a dipirona.");
  await saveFieldValue(workshop.id, plate.id, "CUSTOMER", workshopCustomer.id, "ABC-1D23");

  const clinicStart = appointmentDate(1, 9);
  const clinicEnd = appointmentDate(1, 9, 45);
  let clinicAppointment = await prisma.appointment.findFirst({
    where: { companyId: clinic.id, customerId: clinicCustomer.id, startAt: clinicStart }
  });
  if (!clinicAppointment) {
    clinicAppointment = await prisma.appointment.create({
      data: {
        companyId: clinic.id,
        customerId: clinicCustomer.id,
        serviceId: clinicService.id,
        professionalId: clinicProfessional.id,
        startAt: clinicStart,
        endAt: clinicEnd,
        status: AppointmentStatus.CONFIRMED,
        notes: "Primeira consulta",
        createdById: clinicAdmin.id,
        updatedById: clinicAdmin.id
      }
    });
  }
  await saveFieldValue(clinic.id, clinicalNote.id, "APPOINTMENT", clinicAppointment.id, "Dor de cabeca frequente.");

  const workshopStart = appointmentDate(1, 10);
  const workshopEnd = appointmentDate(1, 12);
  let workshopAppointment = await prisma.appointment.findFirst({
    where: { companyId: workshop.id, customerId: workshopCustomer.id, startAt: workshopStart }
  });
  if (!workshopAppointment) {
    workshopAppointment = await prisma.appointment.create({
      data: {
        companyId: workshop.id,
        customerId: workshopCustomer.id,
        serviceId: workshopService.id,
        professionalId: workshopProfessional.id,
        startAt: workshopStart,
        endAt: workshopEnd,
        status: AppointmentStatus.SCHEDULED,
        notes: "Verificar barulho na suspensao",
        createdById: workshopAdmin.id,
        updatedById: workshopAdmin.id
      }
    });
  }
  await saveFieldValue(workshop.id, labor.id, "APPOINTMENT", workshopAppointment.id, 280);

  const salonStart = appointmentDate(2, 14);
  const salonEnd = appointmentDate(2, 15, 30);
  await prisma.appointment.upsert({
    where: { id: `${salon.id}-sample-appointment`.slice(0, 24) },
    update: {},
    create: {
      id: `${salon.id}-sample-appointment`.slice(0, 24),
      companyId: salon.id,
      customerId: salonCustomer.id,
      serviceId: salonService.id,
      professionalId: salonProfessional.id,
      startAt: salonStart,
      endAt: salonEnd,
      status: AppointmentStatus.SCHEDULED,
      notes: "Cliente pediu finalizacao natural",
      createdById: salonAdmin.id,
      updatedById: salonAdmin.id
    }
  }).catch(async () => {
    const existing = await prisma.appointment.findFirst({
      where: { companyId: salon.id, customerId: salonCustomer.id, startAt: salonStart }
    });
    if (!existing) {
      await prisma.appointment.create({
        data: {
          companyId: salon.id,
          customerId: salonCustomer.id,
          serviceId: salonService.id,
          professionalId: salonProfessional.id,
          startAt: salonStart,
          endAt: salonEnd,
          status: AppointmentStatus.SCHEDULED,
          notes: "Cliente pediu finalizacao natural",
          createdById: salonAdmin.id,
          updatedById: salonAdmin.id
        }
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: "seed.executed",
      entityType: "system",
      newValues: {
        message: "Seed inicial do AgendaFlex executado",
        companies: [clinic.name, workshop.name, salon.name]
      }
    }
  });

  console.log("Seed finalizado.");
  console.log("Super Admin: admin@agendaflex.com / Admin@123456");
  console.log("Clínica Vida: admin@clinicavida.com / Admin@123456");
  console.log("Oficina Central: admin@oficinacentral.com / Admin@123456");
  console.log("Salão Bella: admin@salaobella.com / Admin@123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
