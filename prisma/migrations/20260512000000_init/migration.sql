-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BusinessSegment" AS ENUM ('CLINICA_MEDICA', 'OFICINA_MECANICA', 'SALAO_BELEZA', 'CONSULTORIO', 'ASSISTENCIA_TECNICA', 'PRESTADOR_SERVICOS', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'STAFF', 'USER');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('SYSTEM', 'TENANT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CUSTOMER', 'SERVICE', 'PROFESSIONAL', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'MONEY', 'PERCENT', 'DATE', 'TIME', 'DATETIME', 'SINGLE_SELECT', 'MULTI_SELECT', 'CHECKBOX', 'BOOLEAN', 'EMAIL', 'PHONE', 'CPF_CNPJ', 'FILE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "segment" "BusinessSegment" NOT NULL DEFAULT 'PERSONALIZADO',
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "systemRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "cpf" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "anonymizedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(12,2),
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "label" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "placeholder" TEXT,
    "helpText" TEXT,
    "options" JSONB,
    "defaultValue" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Company_status_idx" ON "Company"("status");
CREATE INDEX "Company_segment_idx" ON "Company"("segment");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_systemRoleId_idx" ON "User"("systemRoleId");
CREATE INDEX "CompanyUser_companyId_idx" ON "CompanyUser"("companyId");
CREATE INDEX "CompanyUser_userId_idx" ON "CompanyUser"("userId");
CREATE INDEX "CompanyUser_roleId_idx" ON "CompanyUser"("roleId");
CREATE INDEX "CompanyUser_status_idx" ON "CompanyUser"("status");
CREATE UNIQUE INDEX "CompanyUser_companyId_userId_key" ON "CompanyUser"("companyId", "userId");
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");
CREATE INDEX "Customer_companyId_name_idx" ON "Customer"("companyId", "name");
CREATE INDEX "Customer_companyId_email_idx" ON "Customer"("companyId", "email");
CREATE INDEX "Service_companyId_idx" ON "Service"("companyId");
CREATE INDEX "Service_companyId_isActive_idx" ON "Service"("companyId", "isActive");
CREATE INDEX "Service_companyId_name_idx" ON "Service"("companyId", "name");
CREATE INDEX "Professional_companyId_idx" ON "Professional"("companyId");
CREATE INDEX "Professional_companyId_isActive_idx" ON "Professional"("companyId", "isActive");
CREATE INDEX "Professional_companyId_name_idx" ON "Professional"("companyId", "name");
CREATE INDEX "Appointment_companyId_idx" ON "Appointment"("companyId");
CREATE INDEX "Appointment_companyId_startAt_idx" ON "Appointment"("companyId", "startAt");
CREATE INDEX "Appointment_companyId_status_idx" ON "Appointment"("companyId", "status");
CREATE INDEX "Appointment_companyId_professionalId_startAt_endAt_idx" ON "Appointment"("companyId", "professionalId", "startAt", "endAt");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");
CREATE INDEX "Appointment_professionalId_idx" ON "Appointment"("professionalId");
CREATE INDEX "CustomField_companyId_idx" ON "CustomField"("companyId");
CREATE INDEX "CustomField_companyId_entityType_isActive_idx" ON "CustomField"("companyId", "entityType", "isActive");
CREATE UNIQUE INDEX "CustomField_companyId_entityType_fieldKey_key" ON "CustomField"("companyId", "entityType", "fieldKey");
CREATE INDEX "CustomFieldValue_companyId_idx" ON "CustomFieldValue"("companyId");
CREATE INDEX "CustomFieldValue_companyId_entityType_entityId_idx" ON "CustomFieldValue"("companyId", "entityType", "entityId");
CREATE INDEX "CustomFieldValue_customFieldId_idx" ON "CustomFieldValue"("customFieldId");
CREATE UNIQUE INDEX "CustomFieldValue_companyId_customFieldId_entityType_entityI_key" ON "CustomFieldValue"("companyId", "customFieldId", "entityType", "entityId");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_systemRoleId_fkey" FOREIGN KEY ("systemRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
