"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search, Shield, UserCheck, UserCog, Users, UserX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Membership = {
  companyId: string;
  companyName: string;
  companySlug: string | null;
  plan: string;
  roleName: string;
};

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

type Response = {
  metrics: {
    totalUsers: number;
    activeLast30: number;
    superAdmins: number;
    totalMemberships: number;
    inactiveCount: number;
  };
  users: UserRow[];
};

type RoleFilter = "all" | "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "STAFF" | "ORPHAN";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Admin",
  MANAGER: "Gerente",
  STAFF: "Atendente",
  USER: "Usuário"
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) return "nunca";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export default function MasterUsuariosPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Response>("/api/master/users");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.users;
    if (roleFilter !== "all") {
      rows = rows.filter(u => {
        if (roleFilter === "SUPER_ADMIN") return u.systemRole === "SUPER_ADMIN";
        if (roleFilter === "ORPHAN") return !u.systemRole && u.memberships.length === 0;
        return u.memberships.some(m => m.roleName === roleFilter);
      });
    }
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.memberships.some(m => m.companyName.toLowerCase().includes(term))
      );
    }
    return rows;
  }, [data, search, roleFilter]);

  if (!data) {
    return (
      <>
        <PageHeader title="Usuários" subtitle="Diretório global de todos os usuários" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle={`${m.totalUsers} usuários · ${m.totalMemberships} vínculos com empresas`}
        actions={
          <>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <Kpi label="Total" value={m.totalUsers} icon={<Users size={18} />} />
        <Kpi label="Ativos (30d)" value={m.activeLast30} icon={<UserCheck size={18} />} variant="emerald" hint={`${m.inactiveCount} sem atividade recente`} />
        <Kpi label="Super Admins" value={m.superAdmins} icon={<Shield size={18} />} variant="amber" />
        <Kpi label="Vínculos ativos" value={m.totalMemberships} icon={<UserCog size={18} />} variant="sky" hint="usuário × empresa" />
      </div>

      {/* Tabela */}
      <section className="panel">
        <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel__title">Diretório</div>
              <div className="panel__sub">{filtered.length} de {data.users.length} exibidos</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={`chip-tab ${roleFilter === "all" ? "is-on" : ""}`} onClick={() => setRoleFilter("all")}>Todos</button>
              <button type="button" className={`chip-tab ${roleFilter === "SUPER_ADMIN" ? "is-on" : ""}`} onClick={() => setRoleFilter("SUPER_ADMIN")}>Super Admin</button>
              <button type="button" className={`chip-tab ${roleFilter === "COMPANY_ADMIN" ? "is-on" : ""}`} onClick={() => setRoleFilter("COMPANY_ADMIN")}>Admin empresa</button>
              <button type="button" className={`chip-tab ${roleFilter === "MANAGER" ? "is-on" : ""}`} onClick={() => setRoleFilter("MANAGER")}>Gerentes</button>
              <button type="button" className={`chip-tab ${roleFilter === "STAFF" ? "is-on" : ""}`} onClick={() => setRoleFilter("STAFF")}>Atendentes</button>
              <button type="button" className={`chip-tab ${roleFilter === "ORPHAN" ? "is-on" : ""}`} onClick={() => setRoleFilter("ORPHAN")}>Órfãos</button>
            </div>
          </div>
          <div className="inline-search">
            <Search size={14} />
            <input type="search" placeholder="Buscar por nome, e-mail ou empresa..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><UserX size={24} /></div>
              <h3>Nenhum usuário no filtro</h3>
              <p>Ajuste a busca ou troque o filtro de papel.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Papel global</th>
                    <th>Empresas / Papel</th>
                    <th className="col-hide-mobile">Cadastrado</th>
                    <th className="col-hide-mobile">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => {
                    const initials = u.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="biz">
                            <span className={`biz__avt av-${(idx % 8) + 1}`}>{initials}</span>
                            <div>
                              <div className="biz__nm">{u.name}</div>
                              <div className="biz__sub">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.systemRole === "SUPER_ADMIN" ? (
                            <span className="pill pill--violet"><Shield size={11} /> Super Admin</span>
                          ) : u.status === "INACTIVE" ? (
                            <span className="pill pill--muted">Inativo</span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          {u.memberships.length === 0 ? (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>Sem vínculo</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {u.memberships.slice(0, 3).map(mem => (
                                <div key={mem.companyId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                  <strong>{mem.companyName}</strong>
                                  <span className="pill pill--muted" style={{ fontSize: 10 }}>{ROLE_LABEL[mem.roleName] ?? mem.roleName}</span>
                                </div>
                              ))}
                              {u.memberships.length > 3 ? (
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>+ {u.memberships.length - 3} outras</span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="col-hide-mobile" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="col-hide-mobile" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {formatRelative(u.lastAccessAt)}
                          {u.lastAccessAt ? <div style={{ fontSize: 10 }}>{formatDate(u.lastAccessAt)}</div> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, icon, variant = "default", hint }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "rose" | "amber";
  hint?: string;
}) {
  const cls = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${cls}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      {hint ? <div className="kpi__foot"><span>{hint}</span></div> : null}
    </div>
  );
}
