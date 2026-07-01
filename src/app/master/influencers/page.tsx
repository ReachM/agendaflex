"use client";

import { Megaphone, Pencil, Plus, RefreshCcw, Search, Trash2, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SABiz,
  SAEmpty,
  SAError,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SAStatusDot,
  brl,
  num
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Influencer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pixKey: string | null;
  active: boolean;
  createdAt: string;
  couponsCount: number;
  subscribersCount: number;
  pendingCommission: number;
};
type Response = {
  metrics: { total: number; active: number; inactive: number; pendingCommissionTotal: number };
  influencers: Influencer[];
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  pixKey: string;
  active: boolean;
  notes: string;
};

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", pixKey: "", active: true, notes: "" };

export default function InfluencersPage() {
  const { data, error, loading, reload } = useSAData<Response>("/api/master/influencers");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Influencer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(inf: Influencer) {
    setForm({
      name: inf.name,
      email: inf.email ?? "",
      phone: inf.phone ?? "",
      pixKey: inf.pixKey ?? "",
      active: inf.active,
      notes: ""
    });
    setEditing(inf);
    setCreating(true);
  }

  async function save() {
    if (!form.name.trim()) {
      alert("Informe o nome do influenciador.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/master/influencers/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/api/master/influencers", {
          method: "POST",
          body: JSON.stringify(form)
        });
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

  async function remove(inf: Influencer) {
    if (!confirm(`Excluir o influenciador "${inf.name}"?`)) return;
    try {
      await apiFetch(`/api/master/influencers/${inf.id}`, { method: "DELETE" });
      void reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data.influencers;
    return data.influencers.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        (i.email ?? "").toLowerCase().includes(term)
    );
  }, [data, search]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Influenciadores" sub="Programa de indicação por cupons" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Influenciadores"
        sub={`${num(m.total)} cadastrados · ${num(m.active)} ativos`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} /> Novo influenciador
            </button>
          </>
        }
      />

      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(m.total)} label="influenciadores" icon={<Megaphone size={18} />} />
        <SAMiniKpi value={num(m.active)} label="ativos" icon={<Users size={18} />} variant="teal" />
        <SAMiniKpi
          value={brl(m.pendingCommissionTotal)}
          label="comissão pendente"
          icon={<Wallet size={18} />}
          variant="amber"
        />
      </div>

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input
              type="search"
              placeholder="Buscar por nome ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <SAEmpty icon={<Megaphone size={24} />} title="Nenhum influenciador" message="Cadastre o primeiro parceiro." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Influenciador</th>
                  <th>Cupons</th>
                  <th>Assinantes ativos</th>
                  <th>Comissão pendente</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/master/influencers/${i.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <SABiz name={i.name} sub={i.email ?? i.phone ?? "—"} seed={i.id} />
                      </Link>
                    </td>
                    <td>{num(i.couponsCount)}</td>
                    <td>{num(i.subscribersCount)}</td>
                    <td>{brl(i.pendingCommission)}</td>
                    <td>
                      <SAStatusDot status={i.active ? "ACTIVE" : "INACTIVE"} label={i.active ? "Ativo" : "Inativo"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="row-btn" title="Editar" onClick={() => openEdit(i)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="row-btn" title="Excluir" onClick={() => remove(i)}>
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
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{editing ? `Editar — ${editing.name}` : "Novo influenciador"}</h3>
              <button type="button" className="row-btn" onClick={() => setCreating(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Nome *</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>E-mail</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Chave PIX (para repasse da comissão)</label>
                <input className="input" value={form.pixKey} onChange={(e) => setForm((f) => ({ ...f, pixKey: e.target.value }))} />
              </div>
              <div className="field">
                <label>Observações</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
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
