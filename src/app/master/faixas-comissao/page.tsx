"use client";

import { Pencil, Percent, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { SAEmpty, SAError, SALoading, SAPageHeader } from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Tier = {
  id: string;
  minSubscribers: number;
  maxSubscribers: number | null;
  commissionPct: number;
};
type Response = { tiers: Tier[] };

type FormState = { minSubscribers: string; maxSubscribers: string; commissionPct: string };
const EMPTY_FORM: FormState = { minSubscribers: "", maxSubscribers: "", commissionPct: "" };

export default function FaixasComissaoPage() {
  const { data, error, loading, reload } = useSAData<Response>("/api/master/commission-tiers");
  const [editing, setEditing] = useState<Tier | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(t: Tier) {
    setForm({
      minSubscribers: String(t.minSubscribers),
      maxSubscribers: t.maxSubscribers != null ? String(t.maxSubscribers) : "",
      commissionPct: String(t.commissionPct)
    });
    setEditing(t);
    setCreating(true);
  }

  async function save() {
    if (form.minSubscribers.trim() === "" || form.commissionPct.trim() === "") {
      alert("Informe o mínimo de assinantes e o percentual.");
      return;
    }
    const payload = {
      minSubscribers: Number(form.minSubscribers),
      maxSubscribers: form.maxSubscribers.trim() === "" ? null : Number(form.maxSubscribers),
      commissionPct: Number(form.commissionPct)
    };
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/master/commission-tiers/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/master/commission-tiers", { method: "POST", body: JSON.stringify(payload) });
      }
      setCreating(false);
      setEditing(null);
      void reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Tier) {
    if (!confirm("Remover esta faixa de comissão?")) return;
    try {
      await apiFetch(`/api/master/commission-tiers/${t.id}`, { method: "DELETE" });
      void reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (!data) {
    return (
      <>
        <SAPageHeader title="Faixas de comissão" sub="Percentual por quantidade de assinantes ativos" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  return (
    <>
      <SAPageHeader
        title="Faixas de comissão"
        sub="Percentual escalonado pela quantidade de assinantes ativos que o influenciador trouxe"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} /> Nova faixa
            </button>
          </>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <section className="panel">
        <div className="panel__body panel__body--flush">
          {data.tiers.length === 0 ? (
            <SAEmpty icon={<Percent size={24} />} title="Nenhuma faixa" message="Defina as faixas de comissão." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Faixa de assinantes</th>
                  <th>Comissão</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.tiers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.minSubscribers}
                      {t.maxSubscribers != null ? `–${t.maxSubscribers}` : "+"} assinantes
                    </td>
                    <td style={{ fontWeight: 700 }}>{t.commissionPct}%</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="row-btn" title="Editar" onClick={() => openEdit(t)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="row-btn" title="Remover" onClick={() => remove(t)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{editing ? "Editar faixa" : "Nova faixa"}</h3>
              <button type="button" className="row-btn" onClick={() => setCreating(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Mín. assinantes *</label>
                  <input className="input" type="number" min="0" value={form.minSubscribers} onChange={(e) => setForm((f) => ({ ...f, minSubscribers: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Máx. (vazio = ∞)</label>
                  <input className="input" type="number" min="0" value={form.maxSubscribers} onChange={(e) => setForm((f) => ({ ...f, maxSubscribers: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Comissão (%) *</label>
                <input className="input" type="number" min="0" max="100" step="0.01" value={form.commissionPct} onChange={(e) => setForm((f) => ({ ...f, commissionPct: e.target.value }))} />
              </div>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
