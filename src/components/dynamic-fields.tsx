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

export function DynamicFields({
  fields,
  values,
  onChange
}: {
  fields: CustomField[];
  values: CustomValues;
  onChange: (values: CustomValues) => void;
}) {
  function setValue(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => {
        const value = values[field.fieldKey] ?? "";
        const required = field.isRequired;
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

        return (
          <div className="field" key={field.id}>
            <label htmlFor={field.fieldKey}>{field.label}</label>
            <input
              {...common}
              type={inputType}
              step={["MONEY", "PERCENT"].includes(field.fieldType) ? "0.01" : undefined}
              value={String(value)}
              onChange={(event) => setValue(field.fieldKey, event.target.value)}
            />
          </div>
        );
      })}
    </>
  );
}
