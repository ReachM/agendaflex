"use client";

import { Loader2, ToggleLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Flag = {
  id: string;
  key: string;
  value: boolean;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function MasterFeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await apiFetch<{ flags: Flag[] }>("/api/master/feature-flags");
      setFlags(data.flags);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(flag: Flag) {
    setError("");
    setPending((prev) => ({ ...prev, [flag.key]: true }));
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, value: !f.value } : f)));
    try {
      const data = await apiFetch<{ flag: Flag }>("/api/master/feature-flags", {
        method: "PUT",
        body: JSON.stringify({ key: flag.key, value: !flag.value })
      });
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? data.flag : f)));
    } catch (err) {
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, value: flag.value } : f)));
      setError((err as Error).message);
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[flag.key];
        return next;
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Feature flags"
        subtitle="Liga e desliga funcionalidades globais da plataforma"
      />

      {error && <div className="error-box">{error}</div>}

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Flags do sistema</div>
            <div className="panel__sub">{flags.length} flags cadastradas</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div className="loading-spinner" />
            </div>
          ) : flags.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <ToggleLeft size={24} />
              </div>
              <h3>Nenhuma flag cadastrada</h3>
              <p>Rode a migration de seed para criar as flags iniciais.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {flags.map((flag) => {
                const isPending = !!pending[flag.key];
                return (
                  <div
                    key={flag.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 20px",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <code
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 13,
                            fontWeight: 700,
                            background: "var(--surface-muted)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "2px 8px",
                            color: "var(--text)"
                          }}
                        >
                          {flag.key}
                        </code>
                        <span className={`pill ${flag.value ? "pill--success" : "pill--muted"}`}>
                          {flag.value ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      {flag.description && (
                        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>
                          {flag.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--muted-2)" }}>
                        Atualizado em {formatDate(flag.updatedAt)}
                        {flag.updatedBy ? ` · por ${flag.updatedBy.slice(0, 8)}` : ""}
                      </div>
                    </div>

                    <label
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: isPending ? "wait" : "pointer",
                        opacity: isPending ? 0.6 : 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={flag.value}
                        onChange={() => toggle(flag)}
                        disabled={isPending}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: 0,
                          height: 0,
                          pointerEvents: "none"
                        }}
                      />
                      <span
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 999,
                          background: flag.value ? "var(--primary)" : "var(--border-strong)",
                          transition: "background var(--transition)",
                          position: "relative",
                          display: "inline-block"
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: flag.value ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#fff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            transition: "left var(--transition)"
                          }}
                        />
                      </span>
                      {isPending && (
                        <Loader2 size={14} className="spin" style={{ marginLeft: 10, color: "var(--muted)" }} />
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
