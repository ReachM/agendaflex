"use client";

import { Filter, RefreshCcw, Search } from "lucide-react";
import type { AgendaPreset } from "@/config/agenda-presets";
import type { AgendaAccess, AnyRecord } from "@/components/agenda/AppointmentCard";

const statusOptions = [
  ["", "Todos"],
  ["SCHEDULED", "Agendado"],
  ["CONFIRMED", "Confirmado"],
  ["IN_PROGRESS", "Em andamento"],
  ["COMPLETED", "Concluido"],
  ["CANCELLED", "Cancelado"],
  ["NO_SHOW", "Nao compareceu"]
];

export type AgendaFilterValues = Record<string, string>;

export function AgendaFilters({
  preset,
  values,
  customers,
  services,
  professionals,
  access,
  onChange,
  onRefresh
}: {
  preset: AgendaPreset;
  values: AgendaFilterValues;
  customers: AnyRecord[];
  services: AnyRecord[];
  professionals: AnyRecord[];
  access: AgendaAccess;
  onChange: (values: AgendaFilterValues) => void;
  onRefresh: () => void;
}) {
  function update(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  function toggleQuick(key: string) {
    update(key, values[key] ? "" : "1");
  }

  const filters = preset.filters.filter((filter) => !filter.requiresFinancial || access.canSeeFinancial);

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="toolbar" style={{ marginBottom: 12, alignItems: "center" }}>
        <h2 className="section-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={16} />
          Filtros
        </h2>
        <button className="button secondary" onClick={onRefresh} type="button">
          <RefreshCcw size={16} />
          Atualizar
        </button>
      </div>

      <div className="form-grid">
        {filters.map((filter) => {
          if (filter.type === "quick") {
            return (
              <div className="field" key={filter.key} style={{ justifyContent: "end" }}>
                <button
                  className={`button ${values[filter.key] ? "" : "secondary"}`}
                  onClick={() => toggleQuick(filter.key)}
                  type="button"
                >
                  {filter.label}
                </button>
              </div>
            );
          }

          if (filter.key === "status") {
            return (
              <div className="field" key={filter.key}>
                <label>{filter.label}</label>
                <select value={values.status ?? ""} onChange={(event) => update("status", event.target.value)}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            );
          }

          if (filter.key === "customerId") {
            return (
              <div className="field" key={filter.key}>
                <label>{filter.label}</label>
                <select value={values.customerId ?? ""} onChange={(event) => update("customerId", event.target.value)}>
                  <option value="">Todos</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </div>
            );
          }

          if (filter.key === "serviceId") {
            return (
              <div className="field" key={filter.key}>
                <label>{filter.label}</label>
                <select value={values.serviceId ?? ""} onChange={(event) => update("serviceId", event.target.value)}>
                  <option value="">Todos</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </div>
            );
          }

          if (filter.key === "professionalId") {
            return (
              <div className="field" key={filter.key}>
                <label>{filter.label}</label>
                <select value={values.professionalId ?? ""} onChange={(event) => update("professionalId", event.target.value)}>
                  <option value="">Todos</option>
                  {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
                </select>
              </div>
            );
          }

          if (filter.key === "paymentStatus") {
            return (
              <div className="field" key={filter.key}>
                <label>{filter.label}</label>
                <select value={values.paymentStatus ?? ""} onChange={(event) => update("paymentStatus", event.target.value)}>
                  <option value="">Todos</option>
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">Pago</option>
                  <option value="PARTIALLY_PAID">Parcial</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            );
          }

          return (
            <div className={`field ${filter.key === "search" ? "full" : ""}`} key={filter.key}>
              <label>{filter.label}</label>
              <div style={{ position: "relative" }}>
                {filter.key === "search" ? (
                  <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
                ) : null}
                <input
                  type={filter.type === "date" ? "date" : "text"}
                  value={values[filter.key] ?? ""}
                  onChange={(event) => update(filter.key, event.target.value)}
                  style={filter.key === "search" ? { paddingLeft: 34 } : undefined}
                  placeholder={filter.type === "text" ? filter.label : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
