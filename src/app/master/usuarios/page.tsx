"use client";

import { KeyRound, MoreVertical, RefreshCcw, Search, Shield, ShieldCheck, UserCog, Users, UserX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  SABiz,
  SAEmpty,
  SAError,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SARoleTag,
  SAStatusDot,
  num,
  relativeTime
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Membership = { companyId: string; companyName: string; plan: string; roleName: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  systemRole: string | null;
  memberships: Membership[];
  lastAccessAt: string | null;
};
type UsersResponse = {
  metrics: { totalUsers: number; activeLast30: number; superAdmins: number; totalMemberships: number; inactiveCount: number };
  users: UserRow[];
};

type Filter = "all" | "super" | "owner" | "suspended";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "super", label: "Super admins" },
  { key: "owner", label: "Donos" },
  { key: "suspended", label: "Suspensos" }
];

function primaryRole(u: UserRow): string {
  if (u.systemRole === "SUPER_ADMIN") return "SUPER_ADMIN";
  return u.memberships[0]?.roleName ?? "STAFF";
}

export default function UsuariosPage() {
  const { data, error, loading, reload } = useSAData<UsersResponse>("/api/master/users");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setMenuUserId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  async function userAction(userId: string, action: "suspend" | "reactivate" | "reset_password") {
    const labels = {
      suspend: "Suspender este usuário?",
      reactivate: "Reativar este usuário?",
      reset_password: "Resetar senha? Uma senha temporária será gerada."
    };
    if (!confirm(labels[action])) return;

    setActionLoading(true);
    try {
      const res = await apiFetch<{ message: string; temporaryPassword?: string }>(`/api/master/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ action })
      });
      if (action === "reset_password" && res.temporaryPassword) {
        setTempPassword(res.temporaryPassword);
      }
      setMenuUserId(null);
      void reload();
    } catch {
      alert("Erro ao executar ação.");
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.users;
    if (filter === "super") rows = rows.filter((u) => u.systemRole === "SUPER_ADMIN");
    else if (filter === "owner") rows = rows.filter((u) => u.memberships.some((m) => m.roleName === "COMPANY_ADMIN" || m.roleName === "OWNER"));
    else if (filter === "suspended") rows = rows.filter((u) => u.status === "INACTIVE");
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.memberships.some((m) => m.companyName.toLowerCase().includes(term))
      );
    }
    return rows;
  }, [data, search, filter]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Usuários" sub="Diretório global de todos os usuários" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Usuários"
        sub={`${num(m.totalUsers)} usuários · ${num(m.totalMemberships)} vínculos`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />

      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(m.totalUsers)} label="usuários totais" icon={<Users size={18} />} />
        <SAMiniKpi value={num(m.activeLast30)} label="ativos (30d)" icon={<ShieldCheck size={18} />} variant="teal" />
        <SAMiniKpi value={num(m.superAdmins)} label="super admins" icon={<Shield size={18} />} variant="sky" />
        <SAMiniKpi value={num(m.inactiveCount)} label="contas inativas" icon={<UserX size={18} />} variant="rose" />
      </div>

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input
              type="search"
              placeholder="Buscar por nome, e-mail ou empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip-tab ${filter === f.key ? "is-on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <SAEmpty icon={<UserCog size={24} />} title="Nenhum usuário" message="Ajuste a busca ou o filtro." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Empresa</th>
                  <th>Papel</th>
                  <th>2FA</th>
                  <th>Último acesso</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <SABiz name={u.name} sub={u.email} seed={u.id} />
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {u.memberships[0]?.companyName ?? <span style={{ color: "var(--muted)" }}>—</span>}
                      {u.memberships.length > 1 ? (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}> +{u.memberships.length - 1}</span>
                      ) : null}
                    </td>
                    <td>
                      <SARoleTag role={primaryRole(u)} />
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>○ Inativo</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{relativeTime(u.lastAccessAt)}</td>
                    <td>
                      <SAStatusDot status={u.status} label={u.status === "ACTIVE" ? "Ativo" : "Suspenso"} />
                    </td>
                    <td>
                      <div className="row-actions" style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="row-btn"
                          title="Mais"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuUserId(menuUserId === u.id ? null : u.id);
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {menuUserId === u.id ? (
                          <div
                            className="dropdown"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 50,
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                              minWidth: 180,
                              padding: 4
                            }}
                          >
                            {u.status === "ACTIVE" ? (
                              <button
                                type="button"
                                className="dropdown-item dropdown-item--danger"
                                disabled={actionLoading}
                                onClick={() => userAction(u.id, "suspend")}
                              >
                                <UserX size={14} /> Suspender conta
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="dropdown-item"
                                disabled={actionLoading}
                                onClick={() => userAction(u.id, "reactivate")}
                              >
                                <ShieldCheck size={14} /> Reativar conta
                              </button>
                            )}
                            <button
                              type="button"
                              className="dropdown-item"
                              disabled={actionLoading}
                              onClick={() => userAction(u.id, "reset_password")}
                            >
                              <KeyRound size={14} /> Resetar senha
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {tempPassword ? (
        <div className="modal-overlay" onClick={() => setTempPassword(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Senha temporária gerada</h3>
              <button type="button" className="row-btn" onClick={() => setTempPassword(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Envie esta senha para o usuário. Ela não será exibida novamente.
              </p>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 18,
                  fontWeight: 700,
                  background: "var(--surface-2)",
                  padding: "12px 16px",
                  borderRadius: "var(--radius)",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  color: "var(--violet-light)"
                }}
              >
                {tempPassword}
              </div>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(tempPassword);
                  setTempPassword(null);
                }}
              >
                Copiar e fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
