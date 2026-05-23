"use client";

type CustomField = {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  options?: string[] | null;
};

export type CustomValues = Record<string, unknown>;

/**
 * Auto-calculation rules for custom field groups.
 * When one of the source fields changes, the target field is computed automatically.
 *
 * Rule: valor_total = (valor_da_peca + valor_da_mao_de_obra) * (1 - desconto / 100)
 */
const AUTO_CALC_RULES: {
  sourceKeys: string[];
  targetKey: string;
  compute: (values: CustomValues) => number;
}[] = [
  {
    sourceKeys: ["valor_da_peca", "valor_da_mao_de_obra", "desconto_em_porcentagem"],
    targetKey: "valor_total",
    compute: (values) => {
      const peca = Number(values["valor_da_peca"]) || 0;
      const maoDeObra = Number(values["valor_da_mao_de_obra"]) || 0;
      const desconto = Number(values["desconto_em_porcentagem"]) || 0;
      const subtotal = peca + maoDeObra;
      const total = subtotal * (1 - Math.min(desconto, 100) / 100);
      return Math.round(total * 100) / 100;
    }
  }
];

function applyAutoCalc(updatedValues: CustomValues, fieldKeys: Set<string>): CustomValues {
  const result = { ...updatedValues };
  for (const rule of AUTO_CALC_RULES) {
    // Only apply if both source fields AND target field exist in this form
    const hasSourceFields = rule.sourceKeys.some((key) => fieldKeys.has(key));
    const hasTargetField = fieldKeys.has(rule.targetKey);
    if (hasSourceFields && hasTargetField) {
      result[rule.targetKey] = rule.compute(result);
    }
  }
  return result;
}

// TODO [MVP-FUTURE] Reativar tipos avançados na v2
const MVP_HIDDEN_FIELD_TYPES = new Set(["MONEY", "PERCENT", "FILE", "CPF_CNPJ"]);

export function DynamicFields({
  fields,
  values,
  onChange
}: {
  fields: CustomField[];
  values: CustomValues;
  onChange: (values: CustomValues) => void;
}) {
  // Filter out advanced field types hidden in the MVP
  const visibleFields = fields.filter((f) => !MVP_HIDDEN_FIELD_TYPES.has(f.fieldType));
  const fieldKeys = new Set(visibleFields.map((f) => f.fieldKey));

  function setValue(key: string, value: unknown) {
    const updated = { ...values, [key]: value };
    // Check if this field is a source for any auto-calc rule
    const isAutoCalcSource = AUTO_CALC_RULES.some((rule) => rule.sourceKeys.includes(key));
    if (isAutoCalcSource) {
      onChange(applyAutoCalc(updated, fieldKeys));
    } else {
      onChange(updated);
    }
  }

  if (visibleFields.length === 0) return null;

  return (
    <>
      {visibleFields.map((field) => {
        const value = values[field.fieldKey] ?? "";
        const required = field.isRequired;
        // Mark auto-calculated fields as read-only
        const isAutoTarget = AUTO_CALC_RULES.some(
          (rule) =>
            rule.targetKey === field.fieldKey &&
            rule.sourceKeys.some((key) => fieldKeys.has(key))
        );
        const common = {
          id: field.fieldKey,
          required,
          placeholder: field.placeholder ?? undefined
        };

        if (field.fieldType === "LONG_TEXT") {
          return (
            <div className="field full" key={field.id}>
              <label htmlFor={field.fieldKey}>{field.label}</label>
              <textarea
                {...common}
                value={String(value)}
                onChange={(event) => setValue(field.fieldKey, event.target.value)}
              />
            </div>
          );
        }

        if (field.fieldType === "SINGLE_SELECT") {
          const options = Array.isArray(field.options) ? field.options : [];
          return (
            <div className="field" key={field.id}>
              <label htmlFor={field.fieldKey}>{field.label}</label>
              <select
                id={field.fieldKey}
                required={required}
                value={String(value)}
                onChange={(event) => setValue(field.fieldKey, event.target.value)}
              >
                <option value="">Selecionar</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.fieldType === "MULTI_SELECT") {
          const options = Array.isArray(field.options) ? field.options : [];
          const selected = Array.isArray(value) ? value.map(String) : [];
          return (
            <div className="field" key={field.id}>
              <label htmlFor={field.fieldKey}>{field.label}</label>
              <select
                id={field.fieldKey}
                multiple
                required={required}
                value={selected}
                onChange={(event) =>
                  setValue(
                    field.fieldKey,
                    Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
                  )
                }
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (["CHECKBOX", "BOOLEAN"].includes(field.fieldType)) {
          return (
            <div className="field" key={field.id}>
              <label htmlFor={field.fieldKey}>{field.label}</label>
              <div className="checkbox-line">
                <input
                  id={field.fieldKey}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => setValue(field.fieldKey, event.target.checked)}
                />
                <span className="muted">Sim</span>
              </div>
            </div>
          );
        }

        const inputType =
          field.fieldType === "EMAIL"
            ? "email"
            : field.fieldType === "DATE"
              ? "date"
              : field.fieldType === "TIME"
                ? "time"
                : field.fieldType === "DATETIME"
                  ? "datetime-local"
                  : ["NUMBER", "MONEY", "PERCENT"].includes(field.fieldType)
                    ? "number"
                    : field.fieldType === "PHONE"
                      ? "tel"
                      : "text";

        // Show currency prefix for MONEY fields, % suffix for PERCENT
        const prefix = field.fieldType === "MONEY" ? "R$" : undefined;
        const suffix = field.fieldType === "PERCENT" ? "%" : undefined;

        return (
          <div className={`field ${isAutoTarget ? "auto-calc" : ""}`} key={field.id}>
            <label htmlFor={field.fieldKey}>
              {field.label}
              {isAutoTarget ? <span className="auto-calc-badge">automático</span> : null}
            </label>
            <div className={prefix || suffix ? "input-addon-wrap" : ""}>
              {prefix ? <span className="input-addon prefix">{prefix}</span> : null}
              <input
                {...common}
                type={inputType}
                step={["MONEY", "PERCENT"].includes(field.fieldType) ? "0.01" : undefined}
                value={String(value)}
                readOnly={isAutoTarget}
                tabIndex={isAutoTarget ? -1 : undefined}
                className={isAutoTarget ? "auto-calc-input" : ""}
                onChange={(event) => setValue(field.fieldKey, event.target.value)}
              />
              {suffix ? <span className="input-addon suffix">{suffix}</span> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
