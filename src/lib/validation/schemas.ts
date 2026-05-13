import { z } from "zod";

const optionalString = (max = 255) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const requiredString = (max = 255) => z.string().trim().min(1).max(max);

const customValues = z.record(z.unknown()).optional();

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200)
});

export const companyCreateSchema = z.object({
  name: requiredString(180),
  tradeName: optionalString(180),
  document: optionalString(30),
  email: z.string().trim().email(),
  phone: optionalString(30),
  segment: z.enum([
    "CLINICA_MEDICA",
    "OFICINA_MECANICA",
    "SALAO_BELEZA",
    "CONSULTORIO",
    "ASSISTENCIA_TECNICA",
    "PRESTADOR_SERVICOS",
    "PERSONALIZADO"
  ]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  plan: optionalString(60),
  adminName: optionalString(180),
  adminEmail: optionalString(255),
  adminPassword: optionalString(200)
});

export const companyUpdateSchema = companyCreateSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional()
});

export const userCreateSchema = z.object({
  name: requiredString(180),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  roleName: z.enum(["COMPANY_ADMIN", "MANAGER", "STAFF", "USER"])
});

export const userUpdateSchema = z.object({
  name: optionalString(180),
  roleName: z.enum(["COMPANY_ADMIN", "MANAGER", "STAFF", "USER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

export const customerCreateSchema = z.object({
  name: requiredString(180),
  email: optionalString(255),
  phone: optionalString(30),
  cpf: optionalString(30),
  birthDate: optionalString(20),
  notes: optionalString(5000),
  status: optionalString(50),
  customValues
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const serviceCreateSchema = z.object({
  name: requiredString(180),
  description: optionalString(5000),
  basePrice: z.coerce.number().nonnegative().optional(),
  durationMinutes: z.coerce.number().int().positive().max(1440).default(60),
  isActive: z.coerce.boolean().default(true),
  customValues
});

export const serviceUpdateSchema = serviceCreateSchema.partial();

export const professionalCreateSchema = z.object({
  name: requiredString(180),
  email: optionalString(255),
  phone: optionalString(30),
  specialty: optionalString(180),
  isActive: z.coerce.boolean().default(true),
  workingHours: z.unknown().optional(),
  customValues
});

export const professionalUpdateSchema = professionalCreateSchema.partial();

const appointmentBaseSchema = z.object({
  customerId: requiredString(80),
  serviceId: requiredString(80),
  professionalId: requiredString(80),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("SCHEDULED"),
  notes: optionalString(5000),
  internalNotes: optionalString(5000),
  customValues
});

export const appointmentCreateSchema = appointmentBaseSchema.refine((data) => data.endAt > data.startAt, {
  message: "A data final deve ser posterior à data inicial.",
  path: ["endAt"]
});

export const appointmentUpdateSchema = appointmentBaseSchema.partial().refine(
  (data) => !data.startAt || !data.endAt || data.endAt > data.startAt,
  {
    message: "A data final deve ser posterior à data inicial.",
    path: ["endAt"]
  }
);

export const customFieldCreateSchema = z.object({
  entityType: z.enum(["CUSTOMER", "SERVICE", "PROFESSIONAL", "APPOINTMENT"]),
  label: requiredString(120),
  fieldKey: optionalString(80),
  fieldType: z.enum([
    "SHORT_TEXT",
    "LONG_TEXT",
    "NUMBER",
    "MONEY",
    "PERCENT",
    "DATE",
    "TIME",
    "DATETIME",
    "SINGLE_SELECT",
    "MULTI_SELECT",
    "CHECKBOX",
    "BOOLEAN",
    "EMAIL",
    "PHONE",
    "CPF_CNPJ",
    "FILE"
  ]),
  isRequired: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  placeholder: optionalString(180),
  helpText: optionalString(500),
  options: z.array(z.string().trim().min(1).max(120)).optional(),
  defaultValue: z.unknown().optional(),
  isActive: z.coerce.boolean().default(true)
});

export const customFieldUpdateSchema = customFieldCreateSchema.partial();

export const customFieldReorderSchema = z.object({
  items: z.array(z.object({
    id: requiredString(80),
    sortOrder: z.coerce.number().int().min(0)
  })).min(1)
});

export const listQuerySchema = z.object({
  search: optionalString(120),
  status: optionalString(50),
  from: optionalString(30),
  to: optionalString(30),
  professionalId: optionalString(80),
  customerId: optionalString(80),
  serviceId: optionalString(80)
});
