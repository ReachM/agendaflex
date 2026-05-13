import { z } from "zod";

export type FieldDefinition = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isActive?: boolean;
  options?: unknown;
};

export type ValidatedCustomValue = {
  customFieldId: string;
  fieldKey: string;
  value: unknown;
};

export class CustomFieldValidationError extends Error {
  status = 422;
  details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

export function slugifyFieldKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function optionsAsStrings(options: unknown) {
  if (!Array.isArray(options)) return [];
  return options.map((item) => String(item));
}

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "sim", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["false", "0", "nao", "não", "no", "off"].includes(value.toLowerCase())) return false;
  }
  throw new Error("valor booleano inválido");
}

function validateOne(field: FieldDefinition, rawValue: unknown) {
  switch (field.fieldType) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
    case "PHONE":
    case "CPF_CNPJ":
    case "FILE":
      return String(rawValue).trim();
    case "EMAIL":
      return z.string().trim().email().parse(rawValue);
    case "NUMBER":
    case "MONEY":
    case "PERCENT": {
      const numberValue = Number(rawValue);
      if (!Number.isFinite(numberValue)) throw new Error("valor numérico inválido");
      if (field.fieldType === "PERCENT" && (numberValue < 0 || numberValue > 100)) {
        throw new Error("porcentagem deve estar entre 0 e 100");
      }
      return numberValue;
    }
    case "DATE": {
      const value = String(rawValue);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
        throw new Error("data inválida");
      }
      return value;
    }
    case "TIME": {
      const value = String(rawValue);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("hora inválida");
      return value;
    }
    case "DATETIME": {
      const date = new Date(String(rawValue));
      if (Number.isNaN(date.getTime())) throw new Error("data e hora inválidas");
      return date.toISOString();
    }
    case "SINGLE_SELECT": {
      const value = String(rawValue);
      const options = optionsAsStrings(field.options);
      if (options.length > 0 && !options.includes(value)) {
        throw new Error("opção inválida");
      }
      return value;
    }
    case "MULTI_SELECT": {
      const values = Array.isArray(rawValue) ? rawValue.map(String) : String(rawValue).split(",").map((item) => item.trim());
      const options = optionsAsStrings(field.options);
      if (options.length > 0 && values.some((value) => !options.includes(value))) {
        throw new Error("uma ou mais opções são inválidas");
      }
      return values.filter(Boolean);
    }
    case "CHECKBOX":
    case "BOOLEAN":
      return parseBoolean(rawValue);
    default:
      throw new Error("tipo de campo não suportado");
  }
}

export function validateCustomFieldValues(
  fields: FieldDefinition[],
  values: Record<string, unknown> | undefined,
  options: { partial?: boolean } = {}
): ValidatedCustomValue[] {
  const payload = values ?? {};
  const errors: Record<string, string> = {};
  const result: ValidatedCustomValue[] = [];

  for (const field of fields.filter((item) => item.isActive !== false)) {
    const rawValue = payload[field.fieldKey] ?? payload[field.id];

    if (isEmpty(rawValue)) {
      if (field.isRequired && !options.partial) {
        errors[field.fieldKey] = `${field.label} é obrigatório.`;
      }
      continue;
    }

    try {
      result.push({
        customFieldId: field.id,
        fieldKey: field.fieldKey,
        value: validateOne(field, rawValue)
      });
    } catch (error) {
      errors[field.fieldKey] = `${field.label}: ${(error as Error).message}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new CustomFieldValidationError("Campos personalizados inválidos.", errors);
  }

  return result;
}
