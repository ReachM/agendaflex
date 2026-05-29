"use client";

import { AlertTriangle, ArrowRight, CheckCircle, CreditCard, Shield, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type SessionData = {
  company?: { id: string; name: string; plan: string };
  subscription?: {
    status: string;
    isTrial: boolean;
    trialDaysLeft: number;
    isBlocked: boolean;
    planName: string;
    planSlug: string;
    gatewaySubscriptionId: string | null;
    canceledAt: string | null;
    periodEnd: string | null;
  } | null;
  role?: string;
};

const statusLabels: Record<string, { label: string; variant: string }> = {
  ACTIVE: { label: "Ativa", variant: "pill--success" },
  TRIALING: { label: "Trial", variant: "pill--info" },
  PAST_DUE: { label: "Pagamento pendente", variant: "pill--warn" },
  CANCELLED: { label: "Cancelada", variant: "pill--danger" },
  EXPIRED: { label: "Expirada", variant: "pill--danger" }
};

export function SubscriptionSection() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiFetch<SessionData>("/api/auth/me")
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel() {
    setError("");
    setSuccess("");
    setCancelling(true);
    try {
      await apiFetch("/api/subscription/cancel", { method: "POST" });
      setSuccess("Assinatura cancelada com sucesso. Seus dados serão mantidos.");
      setShowConfirm(false);
      // Reload session to reflect new status
      const refreshed = await apiFetch<SessionData>("/api/auth/me");
      setSession(refreshed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel__head"><span className="panel__title">Plano e Assinatura</span></div>
        <div className="panel__body" style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <div className="loading-spinner" />
        </div>
      </section>
    );
  }

  const sub = session?.subscription;
  const plan = sub?.planSlug ?? session?.company?.plan ?? "starter";
  const planName = sub?.planName ?? plan.charAt(0).toUpperCase() + plan.slice(1);
  const statusInfo = statusLabels[sub?.status ?? ""] ?? { label: sub?.status ?? "—", variant: "pill--muted" };
  const isAdmin = session?.role === "COMPANY_ADMIN";
  const canCancel = isAdmin && sub?.status !== "CANCELLED" && sub?.status !== "EXPIRED";
  const canUpgrade = plan !== "max";

  return (
    <>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <div>
            <div className="panel__title">
              <CreditCard size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
              Plano e Assinatura
            </div>
            <div className="panel__sub">Gerencie seu plano e método de pagamento</div>
          </div>
          {canUpgrade && (
            <button className="btn btn-amber btn-sm" type="button">
              Fazer upgrade <ArrowRight size={13} />
            </button>
          )}
        </div>
        <div className="panel__body">
          {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
          {success && <div className="success-box"><CheckCircle size={16} />{success}</div>}

          <div className="grid cols-3" style={{ gap: 16, marginBottom: 20 }}>
            {/* Plan */}
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface-muted)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>Plano Atual</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)" }}>{planName}</div>
              <span className={`pill ${statusInfo.variant}`} style={{ marginTop: 8 }}>
                <span className="dot-s" />
                {statusInfo.label}
              </span>
            </div>

            {/* Trial info */}
            {sub?.isTrial && (
              <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface-muted)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>Trial</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: sub.trialDaysLeft <= 3 ? "var(--danger)" : "var(--primary)" }}>
                  {sub.trialDaysLeft} dias
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>restantes no período gratuito</div>
              </div>
            )}

            {/* Payment */}
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface-muted)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>Pagamento</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {sub?.gatewaySubscriptionId ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield size={14} style={{ color: "var(--success)" }} />
                    Mercado Pago
                  </span>
                ) : (
                  <span className="muted">Não configurado</span>
                )}
              </div>
              {sub?.canceledAt && (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>
                  Cancelada em {new Date(sub.canceledAt).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          </div>

          {/* Cancel Section */}
          {canCancel && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              {!showConfirm ? (
                <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => setShowConfirm(true)}>
                  <XCircle size={14} /> Cancelar assinatura
                </button>
              ) : (
                <div style={{
                  padding: 20,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--danger)",
                  background: "var(--danger-light)"
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <AlertTriangle size={20} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong style={{ fontSize: 15 }}>Tem certeza que deseja cancelar?</strong>
                      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Após o cancelamento, sua empresa perderá acesso aos recursos do plano atual.
                        Seus dados serão mantidos por 30 dias. Esta ação não pode ser desfeita.
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={handleCancel}
                          disabled={cancelling}
                          style={{ background: "var(--danger)", color: "#fff" }}
                        >
                          {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowConfirm(false)}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
