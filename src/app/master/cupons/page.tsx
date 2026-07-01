"use client";

import { Pencil, Plus, RefreshCcw, Search, Ticket, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SAEmpty,
  SAError,
  SALoading,
  SAPageHeader,
  SASysBadge,
  num
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Coupon = {
  id: string;
  code: string;
  discountPct: number | null;
  active: boolean;
  createdAt: string;
  influencerId: string;
  influencerName: string;
  redemptionsCount: number;
};
type CouponsResponse = { coupons: Coupon[] };
type InfluencersResponse = { influencers: { id: string; name: string; active: boolean }[] };

type FormState = { code: string; influencerId: string; discountPct: string; active: boolean };
const EMPTY_FORM: FormState = { code: "", influencerId: "", discountPct: "", active: true };

export default function CuponsPage() {
  const { data, error, loading, reload } = useSAData<CouponsResponse>("/api/master/coupons");
  const { data: infData } = useSAData<InfluencersResponse>("/api/master/influencers");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const influencers = infData?.influencers ?? [];

  function openCreate() {
    setForm({ ...EMPTY_FORM, influencerId: influencers[0]?.id ?? "" });
    setEditing(null);
    setCreating(true);
  }

  function openEdit(c: Coupon) {
    setForm({
      code: c.code,
      influencerId: c.influencerId,
      discountPct: c.discountPct != null ? String(c.discountPct) : "",
      active: c.active
    });
    setEditing(c);
    setCreating(true);
  }

  async function save() {
    if (!form.code.trim() || !form.influencerId) {
      alert("Informe o código e o influenciador.");
      return;
    }
    const payload = {
      code: form.code,
      influencerId: form.influencerId,
      discountPct: form.discountPct.trim() === "" ? null : Number(form.discountPct),
      active: form.active
    };
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/master/coupons/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/master/coupons", { method: "POST", body: JSON.stringify(payload) });
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

  async function remove(c: Coupon) {
    if (!confirm(`Excluir o cupom "${c.code}"?`)) return;
    try {
      await apiFetch(`/api/master/coupons/${c.id}`, { method: "DELETE" });
      void reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data.coupons;
    return data.coupons.filter(
      (c) => c.code.toLowerCase().includes(term) || c.influencerName.toLowerCase().includes(term)
    );
  }, [data, search]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Cupons" sub="Códigos de indicação vinculados a influenciadores" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  return (
    <>
      <SAPageHeader
        title="Cupons"
        sub={`${num(data.coupons.length)} cupons`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate} disabled={influencers.length === 0}>
              <Plus size={15} /> Novo cupom
            </button>
          </>
        }
      />
      {error ? <SAError>{error}</SAError> : null}
      {influencers.length === 0 ? (
        <SAError>Cadastre um influenciador antes de criar cupons.</SAError>
      ) : null}

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input
              type="search"
              placeholder="Buscar por código ou influenciador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <SAEmpty icon={<Ticket size={24} />} title="Nenhum cupom" message="Crie o primeiro código de indicação." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Influenciador</th>
                  <th>Desconto</th>
                  <th>Usos</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{c.code}</td>
                    <td style={{ fontSize: 12.5 }}>{c.influencerName}</td>
                    <td>{c.discountPct != null ? `${c.discountPct}%` : "—"}</td>
                    <td>{num(c.redemptionsCount)}</td>
                    <td>
                      <SASysBadge tone={c.active ? "ok" : "down"}>{c.active ? "ATIVO" : "INATIVO"}</SASysBadge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="row-btn" title="Editar" onClick={() => openEdit(c)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="row-btn" title="Excluir" onClick={() => remove(c)}>
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
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{editing ? `Editar cupom — ${editing.code}` : "Novo cupom"}</h3>
              <button type="button" className="row-btn" onClick={() => setCreating(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Código *</label>
                <input
                  className="input"
                  style={{ textTransform: "uppercase", fontFamily: "var(--mono)" }}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, "") }))}
                />
              </div>
              <div className="field">
                <label>Influenciador *</label>
                <select
                  className="input"
                  value={form.influencerId}
                  onChange={(e) => setForm((f) => ({ ...f, influencerId: e.target.value }))}
                >
                  {influencers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.active ? "" : " (inativo)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Desconto para o cliente (%) — opcional</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.discountPct}
                  onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Ativo
              </label>
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
