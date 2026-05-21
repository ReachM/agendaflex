import type { RoleName } from "@prisma/client";
import { hasPermission } from "@/lib/security/permissions";
import type { PlanFeatures } from "@/lib/security/plan-guard";

export type AgendaPresetKey = "clinic" | "workshop" | "beauty_salon" | "technical_support" | "generic" | "custom";

export type AgendaFieldSource =
  | "appointment"
  | "customer"
  | "customerCustom"
  | "appointmentCustom"
  | "service"
  | "professional"
  | "computed"
  | "financial"
  | "checklist";

export type AgendaField = {
  key: string;
  label: string;
  source: AgendaFieldSource;
  sensitive?: boolean;
  financial?: boolean;
  fallbackKeys?: string[];
};

export type AgendaFilter = {
  key: string;
  label: string;
  type: "date" | "select" | "text" | "quick";
  options?: { value: string; label: string }[];
  requiresFinancial?: boolean;
};

export type AgendaActionKey =
  | "view"
  | "confirm"
  | "start"
  | "complete"
  | "cancel"
  | "reschedule"
  | "create_checklist"
  | "print_checklist"
  | "customer_copy"
  | "mark_paid";

export type AgendaTableColumn = AgendaField & {
  width?: string;
};

export type AgendaPreset = {
  key: AgendaPresetKey;
  title: string;
  subtitle: string;
  emptyState: string;
  labels: {
    customer: string;
    service: string;
    professional: string;
    appointment: string;
    newAppointment: string;
    editAppointment: string;
    checklist: string;
  };
  cardFields: AgendaField[];
  previewFields: AgendaField[];
  filters: AgendaFilter[];
  actions: AgendaActionKey[];
  tableColumns: AgendaTableColumn[];
  checklistTemplate: string[];
  showFinancial: boolean;
};

export const FINANCIAL_FIELD_KEYS = new Set([
  "partsValue",
  "laborValue",
  "discountPercent",
  "discountValue",
  "totalValue",
  "paymentStatus",
  "paymentMethod",
  "paidAt",
  "_partsValue",
  "_laborValue",
  "_discountPercent",
  "_discountValue",
  "_grandTotal",
  "_servicesTotal",
  "valor_da_peca",
  "valor_da_mao_de_obra",
  "desconto_em_porcentagem",
  "desconto_em_valor",
  "valor_total",
  "valor_do_procedimento",
  "comissao_profissional",
  "comissao"
]);

export const CLINICAL_SENSITIVE_FIELD_KEYS = new Set([
  "allergies",
  "medications",
  "preExistingConditions",
  "requiredCare",
  "clinicalNotes",
  "bloodType",
  "alergias",
  "medicamentos_em_uso",
  "doencas_pre_existentes",
  "pre_existing_conditions",
  "cuidados_necessarios",
  "observacao_atendimento",
  "observacoes_clinicas",
  "tipo_sanguineo"
]);

const commonFilters: AgendaFilter[] = [
  { key: "date", label: "Data", type: "date" },
  { key: "status", label: "Status", type: "select" },
  { key: "customerId", label: "Cliente", type: "select" },
  { key: "professionalId", label: "Profissional", type: "select" },
  { key: "serviceId", label: "Servico", type: "select" },
  { key: "search", label: "Busca", type: "text" }
];

const statusField: AgendaField = { key: "status", label: "Status", source: "appointment" };
const timeField: AgendaField = { key: "startAt", label: "Horario", source: "computed" };
const customerNameField: AgendaField = { key: "name", label: "Cliente", source: "customer" };
const serviceNameField: AgendaField = { key: "name", label: "Servico", source: "service" };
const professionalNameField: AgendaField = { key: "name", label: "Profissional", source: "professional" };

export const AGENDA_PRESETS: Record<AgendaPresetKey, AgendaPreset> = {
  clinic: {
    key: "clinic",
    title: "Agenda de Consultas",
    subtitle: "Consultas, pacientes e atendimentos clinicos",
    emptyState: "Nenhuma consulta agendada para hoje.",
    labels: {
      customer: "Paciente",
      service: "Consulta/Procedimento",
      professional: "Profissional de saude",
      appointment: "Consulta",
      newAppointment: "Nova consulta",
      editAppointment: "Editar consulta",
      checklist: "Guia de atendimento"
    },
    cardFields: [
      timeField,
      { ...customerNameField, label: "Paciente" },
      { key: "tipo_de_consulta", label: "Tipo", source: "appointmentCustom", fallbackKeys: ["motivo_da_consulta"] },
      { ...professionalNameField, label: "Profissional" },
      { key: "healthInsurance", label: "Convenio", source: "customer", fallbackKeys: ["convenio"] },
      statusField
    ],
    previewFields: [
      { ...customerNameField, label: "Paciente" },
      { key: "phone", label: "Telefone", source: "customer" },
      { key: "email", label: "E-mail", source: "customer" },
      { key: "healthInsurance", label: "Convenio", source: "customer", fallbackKeys: ["convenio"] },
      { key: "healthInsuranceNumber", label: "Carteirinha", source: "customer", fallbackKeys: ["numero_carteirinha"] },
      { key: "motivo_da_consulta", label: "Motivo da consulta", source: "appointmentCustom" },
      { key: "tipo_de_consulta", label: "Tipo de consulta", source: "appointmentCustom" },
      { ...professionalNameField, label: "Profissional responsavel" },
      { key: "requiredCare", label: "Cuidados necessarios", source: "customer", sensitive: true, fallbackKeys: ["cuidados_necessarios"] },
      { key: "allergies", label: "Alergias", source: "customer", sensitive: true, fallbackKeys: ["alergias"] },
      { key: "medications", label: "Medicamentos em uso", source: "customer", sensitive: true, fallbackKeys: ["medicamentos_em_uso"] },
      { key: "preExistingConditions", label: "Doencas pre-existentes", source: "customer", sensitive: true },
      { key: "emergencyContact", label: "Contato de emergencia", source: "customer" },
      { key: "retorno_recomendado", label: "Retorno recomendado", source: "appointmentCustom" },
      { key: "observacao_atendimento", label: "Observacoes clinicas", source: "appointmentCustom", sensitive: true },
      statusField
    ],
    filters: [
      ...commonFilters.map((filter) => filter.key === "customerId" ? { ...filter, label: "Paciente" } : filter),
      { key: "healthInsurance", label: "Convenio", type: "text" },
      { key: "consultationType", label: "Tipo de consulta", type: "text" },
      { key: "returns", label: "Retornos", type: "quick" },
      { key: "today", label: "Hoje", type: "quick" }
    ],
    actions: ["view", "confirm", "start", "complete", "cancel", "reschedule", "create_checklist", "print_checklist"],
    tableColumns: [
      timeField,
      { ...customerNameField, label: "Paciente" },
      { ...serviceNameField, label: "Consulta" },
      { ...professionalNameField, label: "Profissional" },
      { key: "healthInsurance", label: "Convenio", source: "customer", fallbackKeys: ["convenio"] },
      statusField
    ],
    checklistTemplate: [
      "Confirmar dados do paciente",
      "Confirmar motivo da consulta",
      "Verificar alergias",
      "Verificar medicamentos em uso",
      "Registrar orientacao",
      "Confirmar necessidade de retorno"
    ],
    showFinancial: false
  },
  workshop: {
    key: "workshop",
    title: "Agenda da Oficina",
    subtitle: "Ordens de servico, veiculos e checklists",
    emptyState: "Nenhum servico agendado para hoje.",
    labels: {
      customer: "Cliente",
      service: "Servico automotivo",
      professional: "Mecanico/Tecnico",
      appointment: "Ordem de servico",
      newAppointment: "Nova ordem de servico",
      editAppointment: "Editar ordem de servico",
      checklist: "Checklist da oficina"
    },
    cardFields: [
      timeField,
      customerNameField,
      { key: "placa_do_veiculo", label: "Placa", source: "customerCustom" },
      { key: "modelo_do_veiculo", label: "Veiculo", source: "customerCustom", fallbackKeys: ["marca_veiculo"] },
      { ...professionalNameField, label: "Mecanico" },
      { key: "totalValue", label: "Total", source: "financial", financial: true },
      statusField
    ],
    previewFields: [
      customerNameField,
      { key: "phone", label: "Telefone", source: "customer" },
      { key: "placa_do_veiculo", label: "Placa", source: "customerCustom" },
      { key: "marca_veiculo", label: "Marca", source: "customerCustom" },
      { key: "modelo_do_veiculo", label: "Modelo", source: "customerCustom" },
      { key: "ano_veiculo", label: "Ano", source: "customerCustom" },
      { key: "quilometragem", label: "Quilometragem", source: "customerCustom" },
      { key: "cor_veiculo", label: "Cor", source: "customerCustom" },
      { key: "problema_relatado", label: "Problema relatado", source: "appointmentCustom" },
      { key: "diagnostico", label: "Diagnostico", source: "appointmentCustom" },
      { key: "pecas_utilizadas", label: "Pecas utilizadas", source: "appointmentCustom" },
      { key: "partsValue", label: "Valor das pecas", source: "financial", financial: true },
      { key: "laborValue", label: "Mao de obra", source: "financial", financial: true },
      { key: "discountPercent", label: "Desconto", source: "financial", financial: true },
      { key: "totalValue", label: "Valor total", source: "financial", financial: true },
      { key: "garantia_servico", label: "Garantia", source: "appointmentCustom" },
      { ...professionalNameField, label: "Mecanico responsavel" },
      statusField
    ],
    filters: [
      ...commonFilters,
      { key: "plate", label: "Placa", type: "text" },
      { key: "vehicle", label: "Veiculo", type: "text" },
      { key: "paymentStatus", label: "Pagamento", type: "select", requiresFinancial: true },
      { key: "inProgress", label: "Em andamento", type: "quick" },
      { key: "completed", label: "Concluidos", type: "quick" }
    ],
    actions: ["view", "start", "complete", "cancel", "reschedule", "create_checklist", "print_checklist", "customer_copy", "mark_paid"],
    tableColumns: [
      timeField,
      customerNameField,
      { key: "placa_do_veiculo", label: "Placa", source: "customerCustom" },
      { key: "modelo_do_veiculo", label: "Veiculo", source: "customerCustom" },
      { ...serviceNameField, label: "Servico" },
      { ...professionalNameField, label: "Mecanico" },
      { key: "totalValue", label: "Total", source: "financial", financial: true },
      statusField
    ],
    checklistTemplate: [
      "Conferir veiculo",
      "Conferir placa",
      "Registrar quilometragem",
      "Confirmar problema relatado",
      "Listar pecas utilizadas",
      "Conferir teste final",
      "Registrar garantia"
    ],
    showFinancial: true
  },
  beauty_salon: {
    key: "beauty_salon",
    title: "Agenda de Atendimentos",
    subtitle: "Procedimentos, profissionais e recomendacoes",
    emptyState: "Nenhum atendimento agendado para hoje.",
    labels: {
      customer: "Cliente",
      service: "Procedimento",
      professional: "Profissional",
      appointment: "Atendimento",
      newAppointment: "Novo atendimento",
      editAppointment: "Editar atendimento",
      checklist: "Checklist do atendimento"
    },
    cardFields: [
      timeField,
      customerNameField,
      { ...serviceNameField, label: "Procedimento" },
      professionalNameField,
      { key: "duration", label: "Duracao", source: "computed" },
      { key: "totalValue", label: "Valor", source: "financial", financial: true },
      statusField
    ],
    previewFields: [
      customerNameField,
      { key: "phone", label: "Telefone", source: "customer" },
      { ...serviceNameField, label: "Procedimento" },
      { key: "produto_utilizado", label: "Produto utilizado", source: "appointmentCustom" },
      professionalNameField,
      { key: "duration", label: "Tempo estimado", source: "computed" },
      { key: "totalValue", label: "Valor", source: "financial", financial: true },
      { key: "discountPercent", label: "Desconto", source: "financial", financial: true },
      { key: "comissao_profissional", label: "Comissao", source: "appointmentCustom", financial: true },
      { key: "recomendacoes_pos", label: "Recomendacoes", source: "appointmentCustom" },
      { key: "preferencia_de_atendimento", label: "Preferencias", source: "customerCustom" },
      { key: "historico_procedimentos", label: "Historico resumido", source: "customerCustom" },
      statusField
    ],
    filters: [
      ...commonFilters.map((filter) => filter.key === "serviceId" ? { ...filter, label: "Procedimento" } : filter),
      { key: "hour", label: "Horario", type: "text" },
      { key: "completed", label: "Concluidos", type: "quick" },
      { key: "cancelled", label: "Cancelados", type: "quick" }
    ],
    actions: ["view", "confirm", "start", "complete", "cancel", "reschedule", "customer_copy"],
    tableColumns: [
      timeField,
      customerNameField,
      { ...serviceNameField, label: "Procedimento" },
      professionalNameField,
      { key: "duration", label: "Duracao", source: "computed" },
      { key: "totalValue", label: "Valor", source: "financial", financial: true },
      statusField
    ],
    checklistTemplate: [
      "Confirmar procedimento",
      "Confirmar produto usado",
      "Registrar observacoes",
      "Registrar recomendacoes pos-procedimento"
    ],
    showFinancial: true
  },
  technical_support: {
    key: "technical_support",
    title: "Agenda de Reparos",
    subtitle: "Equipamentos, diagnosticos e reparos",
    emptyState: "Nenhum reparo agendado para hoje.",
    labels: {
      customer: "Cliente",
      service: "Servico/Reparo",
      professional: "Tecnico responsavel",
      appointment: "Reparo",
      newAppointment: "Novo reparo",
      editAppointment: "Editar reparo",
      checklist: "Checklist do reparo"
    },
    cardFields: [
      timeField,
      customerNameField,
      { key: "tipo_equipamento", label: "Equipamento", source: "customerCustom", fallbackKeys: ["equipamento"] },
      { key: "modelo_equipamento", label: "Modelo", source: "customerCustom", fallbackKeys: ["modelo"] },
      { key: "defeito_relatado", label: "Defeito", source: "appointmentCustom" },
      { ...professionalNameField, label: "Tecnico" },
      statusField
    ],
    previewFields: [
      customerNameField,
      { key: "phone", label: "Telefone", source: "customer" },
      { key: "tipo_equipamento", label: "Tipo de equipamento", source: "customerCustom", fallbackKeys: ["equipamento"] },
      { key: "marca_equipamento", label: "Marca", source: "customerCustom", fallbackKeys: ["marca"] },
      { key: "modelo_equipamento", label: "Modelo", source: "customerCustom", fallbackKeys: ["modelo"] },
      { key: "numero_serie", label: "Numero de serie", source: "customerCustom" },
      { key: "acessorios_recebidos", label: "Acessorios recebidos", source: "appointmentCustom" },
      { key: "defeito_relatado", label: "Defeito relatado", source: "appointmentCustom" },
      { key: "diagnostico", label: "Diagnostico", source: "appointmentCustom" },
      { key: "pecas_substituidas", label: "Pecas substituidas", source: "appointmentCustom", fallbackKeys: ["pecas_utilizadas"] },
      { key: "partsValue", label: "Valor da peca", source: "financial", financial: true },
      { key: "laborValue", label: "Mao de obra", source: "financial", financial: true },
      { key: "totalValue", label: "Valor total", source: "financial", financial: true },
      { key: "garantia", label: "Garantia", source: "appointmentCustom", fallbackKeys: ["garantia_servico"] },
      { ...professionalNameField, label: "Tecnico responsavel" },
      statusField
    ],
    filters: [
      ...commonFilters,
      { key: "equipmentType", label: "Tipo de equipamento", type: "text" },
      { key: "serialNumber", label: "Numero de serie", type: "text" },
      { key: "warranty", label: "Garantia", type: "text" },
      { key: "inProgress", label: "Em andamento", type: "quick" },
      { key: "completed", label: "Concluidos", type: "quick" }
    ],
    actions: ["view", "start", "complete", "cancel", "reschedule", "create_checklist", "print_checklist", "customer_copy"],
    tableColumns: [
      timeField,
      customerNameField,
      { key: "tipo_equipamento", label: "Equipamento", source: "customerCustom", fallbackKeys: ["equipamento"] },
      { key: "defeito_relatado", label: "Defeito", source: "appointmentCustom" },
      { ...professionalNameField, label: "Tecnico" },
      { key: "garantia", label: "Garantia", source: "appointmentCustom", fallbackKeys: ["garantia_servico"] },
      statusField
    ],
    checklistTemplate: [
      "Conferir equipamento recebido",
      "Conferir acessorios",
      "Registrar numero de serie",
      "Registrar defeito relatado",
      "Registrar diagnostico",
      "Conferir peca substituida",
      "Registrar garantia"
    ],
    showFinancial: true
  },
  generic: {
    key: "generic",
    title: "Agenda",
    subtitle: "Agenda operacional da empresa",
    emptyState: "Nenhum agendamento encontrado.",
    labels: {
      customer: "Cliente",
      service: "Servico",
      professional: "Profissional",
      appointment: "Agendamento",
      newAppointment: "Novo agendamento",
      editAppointment: "Editar agendamento",
      checklist: "Checklist"
    },
    cardFields: [timeField, customerNameField, serviceNameField, professionalNameField, statusField],
    previewFields: [
      customerNameField,
      { key: "phone", label: "Telefone", source: "customer" },
      serviceNameField,
      professionalNameField,
      { key: "startAt", label: "Data e horario", source: "computed" },
      statusField,
      { key: "notes", label: "Observacoes", source: "appointment" }
    ],
    filters: commonFilters,
    actions: ["view", "confirm", "start", "complete", "cancel", "reschedule"],
    tableColumns: [timeField, customerNameField, serviceNameField, professionalNameField, statusField],
    checklistTemplate: ["Confirmar dados", "Registrar atendimento", "Concluir atendimento"],
    showFinancial: false
  },
  custom: {
    key: "custom",
    title: "Agenda",
    subtitle: "Agenda configuravel por campos personalizados",
    emptyState: "Nenhum agendamento encontrado.",
    labels: {
      customer: "Cliente",
      service: "Servico",
      professional: "Profissional",
      appointment: "Agendamento",
      newAppointment: "Novo agendamento",
      editAppointment: "Editar agendamento",
      checklist: "Checklist"
    },
    cardFields: [timeField, customerNameField, serviceNameField, professionalNameField, statusField],
    previewFields: [
      customerNameField,
      { key: "phone", label: "Telefone", source: "customer" },
      serviceNameField,
      professionalNameField,
      { key: "startAt", label: "Data e horario", source: "computed" },
      statusField,
      { key: "notes", label: "Observacoes", source: "appointment" }
    ],
    filters: commonFilters,
    actions: ["view", "confirm", "start", "complete", "cancel", "reschedule"],
    tableColumns: [timeField, customerNameField, serviceNameField, professionalNameField, statusField],
    checklistTemplate: ["Confirmar dados", "Registrar atendimento", "Concluir atendimento"],
    showFinancial: false
  }
};

export function segmentToAgendaPresetKey(segment?: string | null): AgendaPresetKey {
  switch (segment) {
    case "CLINICA_MEDICA":
    case "CONSULTORIO":
      return "clinic";
    case "OFICINA_MECANICA":
      return "workshop";
    case "SALAO_BELEZA":
      return "beauty_salon";
    case "ASSISTENCIA_TECNICA":
      return "technical_support";
    case "PERSONALIZADO":
      return "custom";
    case "PRESTADOR_SERVICOS":
    default:
      return "generic";
  }
}

export function getAgendaPreset(segment?: string | null): AgendaPreset {
  return AGENDA_PRESETS[segmentToAgendaPresetKey(segment)];
}

export function isFinancialFieldKey(key: string) {
  return FINANCIAL_FIELD_KEYS.has(key);
}

export function isClinicalSensitiveFieldKey(key: string) {
  return CLINICAL_SENSITIVE_FIELD_KEYS.has(key);
}

export function canAccessAgendaFinancials(roleName: RoleName, planFeatures: PlanFeatures) {
  return planFeatures.allowFinancialControl && hasPermission(roleName, "financial:view");
}

export function canManageAgendaFinancials(roleName: RoleName, planFeatures: PlanFeatures) {
  return planFeatures.allowFinancialControl && hasPermission(roleName, "financial:manage");
}

export function canAccessClinicalSensitiveFields(roleName: RoleName) {
  return hasPermission(roleName, "clinical_notes:view");
}
