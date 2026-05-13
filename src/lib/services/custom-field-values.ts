import type { EntityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateCustomFieldValues } from "@/lib/custom-fields";

export async function saveCustomFieldValues(input: {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  values?: Record<string, unknown>;
  partial?: boolean;
}) {
  const fields = await prisma.customField.findMany({
    where: {
      companyId: input.companyId,
      entityType: input.entityType,
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
  });

  const validated = validateCustomFieldValues(fields, input.values, { partial: input.partial });

  for (const item of validated) {
    await prisma.customFieldValue.upsert({
      where: {
        companyId_customFieldId_entityType_entityId: {
          companyId: input.companyId,
          customFieldId: item.customFieldId,
          entityType: input.entityType,
          entityId: input.entityId
        }
      },
      update: { value: item.value as Prisma.InputJsonValue },
      create: {
        companyId: input.companyId,
        customFieldId: item.customFieldId,
        entityType: input.entityType,
        entityId: input.entityId,
        value: item.value as Prisma.InputJsonValue
      }
    });
  }
}

export async function attachCustomValues<T extends { id: string }>(
  companyId: string,
  entityType: EntityType,
  records: T[]
) {
  if (records.length === 0) return records.map((record) => ({ ...record, customValues: {} }));

  const values = await prisma.customFieldValue.findMany({
    where: {
      companyId,
      entityType,
      entityId: { in: records.map((record) => record.id) }
    },
    include: {
      customField: true
    }
  });

  const valueMap = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    const current = valueMap.get(value.entityId) ?? {};
    current[value.customField.fieldKey] = value.value;
    valueMap.set(value.entityId, current);
  }

  return records.map((record) => ({
    ...record,
    customValues: valueMap.get(record.id) ?? {}
  }));
}
