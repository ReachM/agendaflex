"use client";

import type { ReactNode } from "react";

/* ---------- Formatters ---------- */

export function brl(value: number, opts?: { compact?: boolean }) {
  if (opts?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value);
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}

export function num(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(new Date(value));
}

export function relativeTime(value: string | Date | null) {
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

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function avatarClass(seed: string | number) {
  const n = typeof seed === "number" ? seed : seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `av-${(n % 8) + 1}`;
}

/* ---------- KPI Card ---------- */

type KpiVariant = "violet" | "teal" | "amber" | "rose" | "sky";

export function SAKpiCard({
  label,
  value,
  unit,
  icon,
  variant = "violet",
  delta,
  deltaDown,
  foot
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  variant?: KpiVariant;
  delta?: string;
  deltaDown?: boolean;
  foot?: ReactNode;
}) {
  const cls = variant === "violet" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${cls}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        {icon ? <span className="kpi__icon">{icon}</span> : null}
      </div>
      <div className="kpi__value">
        {unit ? <span className="unit">{unit}</span> : null}
        {value}
      </div>
      <div className="kpi__foot">
        {delta ? (
          <span className={`kpi__delta ${deltaDown ? "kpi__delta--down" : ""}`}>{delta}</span>
        ) : null}
        {foot ? <span>{foot}</span> : null}
      </div>
    </div>
  );
}

/* ---------- Mini KPI ---------- */

export function SAMiniKpi({
  value,
  label,
  icon,
  variant = "violet"
}: {
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  variant?: KpiVariant;
}) {
  const cls = variant === "violet" ? "" : `mk--${variant}`;
  return (
    <div className={`mk ${cls}`}>
      {icon ? <span className="mk__ico">{icon}</span> : null}
      <div>
        <div className="mk__v">{value}</div>
        <div className="mk__l">{label}</div>
      </div>
    </div>
  );
}

/* ---------- Plan Tag ---------- */

export function SAPlanTag({ plan }: { plan?: string | null }) {
  const slug = (plan ?? "free").toLowerCase();
  const map: Record<string, { cls: string; label: string }> = {
    max: { cls: "plan-tag--max", label: "Max" },
    pro: { cls: "plan-tag--pro", label: "Pro" },
    starter: { cls: "plan-tag--starter", label: "Starter" },
    trial: { cls: "plan-tag--starter", label: "Trial" },
    free: { cls: "plan-tag--free", label: "Free" }
  };
  const cfg = map[slug] ?? { cls: "plan-tag--free", label: plan ?? "—" };
  return <span className={`plan-tag ${cfg.cls}`}>{cfg.label}</span>;
}

/* ---------- Role Tag ---------- */

export function SARoleTag({ role }: { role: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SUPER_ADMIN: { cls: "role-tag--super", label: "Super Admin" },
    COMPANY_ADMIN: { cls: "role-tag--owner", label: "Dono" },
    OWNER: { cls: "role-tag--owner", label: "Dono" },
    MANAGER: { cls: "role-tag--manager", label: "Gerente" },
    STAFF: { cls: "role-tag--staff", label: "Profissional" }
  };
  const cfg = map[role] ?? { cls: "role-tag--staff", label: role };
  return <span className={`role-tag ${cfg.cls}`}>{cfg.label}</span>;
}

/* ---------- Status Dot ---------- */

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: "status-dot--active", label: "Ativa" },
  TRIALING: { cls: "status-dot--trial", label: "Trial" },
  TRIAL: { cls: "status-dot--trial", label: "Trial" },
  PAST_DUE: { cls: "status-dot--overdue", label: "Inadimplente" },
  CANCELLED: { cls: "status-dot--churned", label: "Cancelada" },
  CANCELED: { cls: "status-dot--churned", label: "Cancelada" },
  SUSPENDED: { cls: "status-dot--suspended", label: "Suspensa" },
  INACTIVE: { cls: "status-dot--churned", label: "Inativa" }
};

export function SAStatusDot({ status, label }: { status: string; label?: string }) {
  const cfg = STATUS_MAP[status] ?? { cls: "status-dot--churned", label: status };
  return (
    <span className={`status-dot ${cfg.cls}`}>
      <span className="d" />
      {label ?? cfg.label}
    </span>
  );
}

/* ---------- System Badge ---------- */

export function SASysBadge({
  tone,
  children
}: {
  tone: "ok" | "warn" | "down" | "info";
  children: ReactNode;
}) {
  return <span className={`sys-badge sys-badge--${tone}`}>{children}</span>;
}

/* ---------- Switch ---------- */

export function SASwitch({
  checked,
  onChange,
  disabled
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="switch__track" />
    </label>
  );
}

/* ---------- Health Bar ---------- */

export function SAHealthBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 70 ? "good" : pct >= 40 ? "mid" : "low";
  return (
    <div className={`health health--${tone}`}>
      <div className="health__bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="health__v">{Math.round(pct)}</span>
    </div>
  );
}

/* ---------- Biz cell ---------- */

export function SABiz({
  name,
  sub,
  seed
}: {
  name: string;
  sub?: string | null;
  seed?: string | number;
}) {
  return (
    <div className="biz">
      <span className={`biz__avt ${avatarClass(seed ?? name)}`}>{initials(name)}</span>
      <div style={{ minWidth: 0 }}>
        <div className="biz__nm">{name}</div>
        {sub ? <div className="biz__sub">{sub}</div> : null}
      </div>
    </div>
  );
}

/* ---------- States ---------- */

export function SALoading() {
  return (
    <div className="sa-loading">
      <div className="sa-spinner" />
    </div>
  );
}

export function SAEmpty({ icon, title, message }: { icon?: ReactNode; title: string; message?: string }) {
  return (
    <div className="sa-empty">
      {icon ? <div className="sa-empty__icon">{icon}</div> : null}
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

export function SAError({ children }: { children: ReactNode }) {
  return <div className="sa-error">{children}</div>;
}

/* ---------- Page header ---------- */

export function SAPageHeader({
  title,
  sub,
  actions
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
