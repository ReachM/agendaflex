"use client";

import { Ban, Check, CheckCircle, ClipboardCheck, FileText, Play, Printer } from "lucide-react";
import type { AgendaPreset } from "@/config/agenda-presets";
import type { AgendaAccess, AnyRecord } from "@/components/agenda/AppointmentCard";

export function AgendaActions({
  appointment,
  preset,
  access,
  loading,
  onStatus,
  onChecklist,
  onPrint
}: {
  appointment: AnyRecord;
  preset: AgendaPreset;
  access: AgendaAccess;
  loading?: boolean;
  onStatus: (status: string) => void;
  onChecklist?: () => void;
  onPrint?: () => void;
}) {
  const status = appointment.status;
  const terminal = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status);
  const hasChecklist = (appointment.checklists ?? []).length > 0;

  if (!access.canChangeStatus && !access.canUseChecklist) return null;

  return (
    <div className="preview-actions" style={{ marginTop: 20 }}>
      {access.canChangeStatus && !terminal ? (
        <div className="preview-actions__group">
          {preset.actions.includes("confirm") && status === "SCHEDULED" ? (
            <button className="button" disabled={loading} onClick={() => onStatus("CONFIRMED")} type="button">
              <Check size={16} />
              Confirmar
            </button>
          ) : null}

          {preset.actions.includes("start") && ["SCHEDULED", "CONFIRMED"].includes(status) ? (
            <button
              className="button"
              disabled={loading}
              onClick={() => onStatus("IN_PROGRESS")}
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              type="button"
            >
              <Play size={16} />
              {preset.key === "technical_support" ? "Iniciar diagnostico" : preset.key === "workshop" ? "Iniciar servico" : "Iniciar"}
            </button>
          ) : null}

          {preset.actions.includes("complete") && ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(status) ? (
            <button
              className="button"
              disabled={loading}
              onClick={() => onStatus("COMPLETED")}
              style={{ background: "linear-gradient(135deg, var(--success), #15803d)" }}
              type="button"
            >
              <CheckCircle size={16} />
              {preset.key === "clinic" ? "Concluir consulta" : preset.key === "technical_support" ? "Concluir reparo" : "Concluir"}
            </button>
          ) : null}

          {preset.actions.includes("cancel") && access.canManage ? (
            <button className="button danger" disabled={loading} onClick={() => onStatus("CANCELLED")} type="button">
              <Ban size={16} />
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}

      {access.canUseChecklist && ["IN_PROGRESS", "COMPLETED"].includes(status) ? (
        <div className="preview-actions__group">
          {!hasChecklist && preset.actions.includes("create_checklist") ? (
            <button className="button secondary" onClick={onChecklist} type="button">
              <ClipboardCheck size={16} />
              Criar {preset.labels.checklist.toLowerCase()}
            </button>
          ) : null}
          {hasChecklist && preset.actions.includes("print_checklist") ? (
            <button className="button secondary" onClick={onPrint} type="button">
              <Printer size={16} />
              Imprimir checklist
            </button>
          ) : null}
        </div>
      ) : null}

      {access.canSeeFinancial && preset.actions.includes("customer_copy") ? (
        <button className="button secondary" type="button" disabled title="Em breve">
          <FileText size={16} />
          Via do cliente
        </button>
      ) : null}
    </div>
  );
}
