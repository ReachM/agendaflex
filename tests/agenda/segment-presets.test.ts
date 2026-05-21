import { describe, expect, it } from "vitest";
import { getAgendaPreset, segmentToAgendaPresetKey } from "@/config/agenda-presets";

function allPresetKeys(segment: string) {
  const preset = getAgendaPreset(segment);
  return [
    ...preset.cardFields,
    ...preset.previewFields,
    ...preset.tableColumns
  ].flatMap((field) => [field.key, ...(field.fallbackKeys ?? [])]);
}

describe("Agenda segment presets", () => {
  it("maps current Company.segment values to agenda presets", () => {
    expect(segmentToAgendaPresetKey("CLINICA_MEDICA")).toBe("clinic");
    expect(segmentToAgendaPresetKey("CONSULTORIO")).toBe("clinic");
    expect(segmentToAgendaPresetKey("OFICINA_MECANICA")).toBe("workshop");
    expect(segmentToAgendaPresetKey("SALAO_BELEZA")).toBe("beauty_salon");
    expect(segmentToAgendaPresetKey("ASSISTENCIA_TECNICA")).toBe("technical_support");
    expect(segmentToAgendaPresetKey("PERSONALIZADO")).toBe("custom");
    expect(segmentToAgendaPresetKey("PRESTADOR_SERVICOS")).toBe("generic");
  });

  it("clinic agenda uses patient/consultation language and not workshop fields", () => {
    const preset = getAgendaPreset("CLINICA_MEDICA");
    const keys = allPresetKeys("CLINICA_MEDICA");

    expect(preset.title).toBe("Agenda de Consultas");
    expect(preset.labels.customer).toBe("Paciente");
    expect(keys).toContain("convenio");
    expect(keys).toContain("motivo_da_consulta");
    expect(keys).not.toContain("placa_do_veiculo");
    expect(keys).not.toContain("quilometragem");
    expect(keys).not.toContain("pecas_utilizadas");
  });

  it("workshop agenda uses vehicle/service fields and not clinic fields", () => {
    const preset = getAgendaPreset("OFICINA_MECANICA");
    const keys = allPresetKeys("OFICINA_MECANICA");

    expect(preset.title).toBe("Agenda da Oficina");
    expect(keys).toContain("placa_do_veiculo");
    expect(keys).toContain("modelo_do_veiculo");
    expect(keys).toContain("problema_relatado");
    expect(keys).toContain("diagnostico");
    expect(keys).not.toContain("numero_carteirinha");
    expect(keys).not.toContain("medicamentos_em_uso");
  });

  it("beauty salon agenda exposes procedure/product fields", () => {
    const preset = getAgendaPreset("SALAO_BELEZA");
    const keys = allPresetKeys("SALAO_BELEZA");

    expect(preset.title).toBe("Agenda de Atendimentos");
    expect(preset.labels.service).toBe("Procedimento");
    expect(keys).toContain("produto_utilizado");
    expect(keys).toContain("recomendacoes_pos");
    expect(keys).toContain("preferencia_de_atendimento");
  });

  it("technical support agenda exposes equipment and repair fields", () => {
    const preset = getAgendaPreset("ASSISTENCIA_TECNICA");
    const keys = allPresetKeys("ASSISTENCIA_TECNICA");

    expect(preset.title).toBe("Agenda de Reparos");
    expect(keys).toContain("tipo_equipamento");
    expect(keys).toContain("numero_serie");
    expect(keys).toContain("defeito_relatado");
    expect(keys).toContain("pecas_substituidas");
  });

  it("custom agenda remains generic and configurable", () => {
    const preset = getAgendaPreset("PERSONALIZADO");
    const keys = allPresetKeys("PERSONALIZADO");

    expect(preset.key).toBe("custom");
    expect(preset.title).toBe("Agenda");
    expect(keys).toContain("name");
    expect(keys).not.toContain("placa_do_veiculo");
    expect(keys).not.toContain("convenio");
  });
});
