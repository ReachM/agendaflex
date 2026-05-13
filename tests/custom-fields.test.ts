import { describe, expect, it } from "vitest";
import { slugifyFieldKey, validateCustomFieldValues } from "@/lib/custom-fields";

const fields = [
  {
    id: "field_allergies",
    fieldKey: "alergias",
    label: "Alergias",
    fieldType: "LONG_TEXT",
    isRequired: true,
    isActive: true
  },
  {
    id: "field_discount",
    fieldKey: "desconto",
    label: "Desconto",
    fieldType: "PERCENT",
    isRequired: false,
    isActive: true
  },
  {
    id: "field_blood",
    fieldKey: "tipo_sanguineo",
    label: "Tipo sanguíneo",
    fieldType: "SINGLE_SELECT",
    isRequired: false,
    isActive: true,
    options: ["A+", "O+"]
  }
];

describe("custom field validation", () => {
  it("normalizes labels into stable field keys", () => {
    expect(slugifyFieldKey("Número da carteirinha")).toBe("numero_da_carteirinha");
  });

  it("requires mandatory tenant-defined fields", () => {
    expect(() => validateCustomFieldValues(fields, {})).toThrow("Campos personalizados");
  });

  it("validates numeric percentage ranges", () => {
    expect(() =>
      validateCustomFieldValues(fields, {
        alergias: "Dipirona",
        desconto: 120
      })
    ).toThrow("Campos personalizados");
  });

  it("accepts valid dynamic values and returns values linked to field ids", () => {
    const result = validateCustomFieldValues(fields, {
      alergias: "Dipirona",
      desconto: 15,
      tipo_sanguineo: "O+"
    });

    expect(result).toEqual([
      { customFieldId: "field_allergies", fieldKey: "alergias", value: "Dipirona" },
      { customFieldId: "field_discount", fieldKey: "desconto", value: 15 },
      { customFieldId: "field_blood", fieldKey: "tipo_sanguineo", value: "O+" }
    ]);
  });
});
