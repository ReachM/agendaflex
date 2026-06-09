"use client";

import { RefreshCcw, Search, ToggleLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { SAEmpty, SAError, SALoading, SAPageHeader, SASwitch, SASysBadge, relativeTime } from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Flag = { id: string; key: string; value: boolean; description: string | null; updatedAt: string };
type FlagsResponse = { flags: Flag[] };

type Filter = "all" | "on" | "off";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "on", label: "Em produção" },
  { key: "off", label: "Desativadas" }
];

export default function FeatureFlagsPage() {
  const { data, error, reload, loading } = useSAData<FlagsResponse>("/api/master/feature-flags");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const flags = useMemo(() => {
    if (!data) return [];
    let rows = data.flags.map((f) => ({ ...f, value: overrides[f.key] ?? f.value }));
    if (filter === "on") rows = rows.filter((f) => f.value);
    else if (filter === "off") rows = rows.filter((f) => !f.value);
    const term = search.trim().toLowerCase();
    if (term) rows = rows.filter((f) => f.key.toLowerCase().includes(term) || (f.description ?? "").toLowerCase().includes(term));
    return rows;
  }, [data, search, filter, overrides]);

  async function toggle(flag: Flag, next: boolean) {
    setOverrides((o) => ({ ...o, [flag.key]: next }));
    setPending((p) => ({ ...p, [flag.key]: true }));
    try {
      await apiFetch("/api/master/feature-flags", {
        method: "PUT",
        body: JSON.stringify({ key: flag.key, value: next })
      });
    } catch {
      setOverrides((o) => ({ ...o, [flag.key]: flag.value }));
    } finally {
      setPending((p) => ({ ...p, [flag.key]: false }));
    }
  }

  if (!data) {
    return (
      <>
        <SAPageHeader title="Feature flags" sub="Ativação de recursos por ambiente" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const on = flags.filter((f) => f.value);
  const off = flags.filter((f) => !f.value);

  const renderFlag = (f: Flag & { value: boolean }) => (
    <div className="flag-row" key={f.key}>
      <div className="flag-row__info">
        <span className="flag-row__key">{f.key}</span>
        <div className="flag-row__desc">{f.description ?? "Sem descrição cadastrada."}</div>
        <div className={`flag-row__bar ${f.value ? "flag-row__bar--full" : ""}`}>
          <div style={{ width: f.value ? "100%" : "0%" }} />
        </div>
        <div className="flag-row__meta">
          <SASysBadge tone={f.value ? "ok" : "down"}>{f.value ? "Ativa · 100%" : "OFF"}</SASysBadge>
          <span>atualizado {relativeTime(f.updatedAt)}</span>
        </div>
      </div>
      <div className="flag-row__right">
        <div className="flag-row__tags">
          <span className="flag-row__env flag-row__env--prod">PROD</span>
          <span className="flag-row__env flag-row__env--stg">STG</span>
        </div>
        <SASwitch checked={f.value} disabled={pending[f.key]} onChange={(v) => toggle(f, v)} />
      </div>
    </div>
  );

  return (
    <>
      <SAPageHeader
        title="Feature flags"
        sub={`${data.flags.length} flags · ${on.length} em produção`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input type="search" placeholder="Buscar flag…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip-tab ${filter === f.key ? "is-on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {flags.length === 0 ? (
            <SAEmpty icon={<ToggleLeft size={24} />} title="Nenhuma flag" message="Cadastre flags via systemFlag ou ajuste a busca." />
          ) : (
            <>
              {on.length > 0 ? <div className="section-label">Em produção (100%)</div> : null}
              {on.map(renderFlag)}
              {off.length > 0 ? <div className="section-label">Desativadas / experimentais</div> : null}
              {off.map(renderFlag)}
            </>
          )}
        </div>
      </section>
    </>
  );
}
