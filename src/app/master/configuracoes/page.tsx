"use client";

import { useEffect, useState } from "react";
import { SAPageHeader, SASwitch } from "@/components/master/sa-bits";
import { apiFetch } from "@/lib/client-api";

export default function MasterSettingsPage() {
  return (
    <>
      <SAPageHeader title="Configurações" sub="Suporte, manutenção e avisos globais da plataforma" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SupportSettings />
        <MaintenanceCard />
        <AnnouncementCard />
      </div>
    </>
  );
}

/* ───────────────── WhatsApp de Suporte ───────────────── */

function SupportSettings() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ settings?: Record<string, string> }>("/api/master/settings")
      .then((data) => {
        setPhone(data.settings?.support_whatsapp ?? "");
        setMessage(data.settings?.support_message ?? "");
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/master/settings", {
        method: "PATCH",
        body: JSON.stringify({
          support_whatsapp: phone.replace(/\D/g, ""),
          support_message: message
        })
      });
      setSaved(true);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">WhatsApp de Suporte</div>
          <div className="panel__sub">Número exibido no painel das empresas para suporte</div>
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label>Número (apenas dígitos, com DDI)</label>
          <input placeholder="5511999998888" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </div>
        <div className="field">
          <label>Mensagem pré-definida</label>
          <input
            placeholder="Olá! Preciso de ajuda com o MarcaiFlex."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
            {saving ? "Salvando…" : "Salvar"}
          </button>
          {saved && <span style={{ fontSize: 13, color: "var(--success)" }}>Salvo!</span>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Modo Manutenção ───────────────── */

function MaintenanceCard() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ enabled: boolean; message: string }>("/api/master/maintenance")
      .then((d) => {
        setEnabled(d.enabled);
        setMessage(d.message);
      })
      .catch(() => {});
  }, []);

  async function patch(next: boolean) {
    setSaving(true);
    try {
      await apiFetch("/api/master/maintenance", {
        method: "PATCH",
        body: JSON.stringify({ enabled: next, message })
      });
      setEnabled(next);
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ border: enabled ? "1px solid var(--accent)" : undefined }}>
      <div className="panel__head">
        <div>
          <div className="panel__title">🔧 Modo Manutenção</div>
          <div className="panel__sub">Bloqueia acesso de visitantes e mostra aviso para empresas</div>
        </div>
        <SASwitch checked={enabled} disabled={saving} onChange={(v) => patch(v)} />
      </div>
      {enabled && (
        <div style={{ padding: "12px 20px 16px" }}>
          <div className="field">
            <label>Mensagem de manutenção</label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Estamos em manutenção. Voltamos em breve!"
              maxLength={500}
            />
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} type="button" disabled={saving} onClick={() => patch(true)}>
            Salvar mensagem
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────── Aviso Global ───────────────── */

type AnnouncementType = "info" | "warning" | "success";

function AnnouncementCard() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AnnouncementType>("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ message: string; type: AnnouncementType }>("/api/master/announcement")
      .then((d) => {
        setMessage(d.message ?? "");
        setType(d.type ?? "info");
      })
      .catch(() => {});
  }, []);

  async function publish(nextMessage: string) {
    setSaving(true);
    try {
      await apiFetch("/api/master/announcement", {
        method: "PATCH",
        body: JSON.stringify({ message: nextMessage, type })
      });
      setMessage(nextMessage);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">📢 Aviso Global</div>
          <div className="panel__sub">Aparece no topo do painel de todas as empresas</div>
        </div>
      </div>
      <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label>Mensagem (vazio = sem aviso)</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex: Nova funcionalidade disponível! Acesse Relatórios."
            maxLength={500}
          />
        </div>
        <div className="field">
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as AnnouncementType)}>
            <option value="info">ℹ️ Informativo (azul)</option>
            <option value="warning">⚠️ Aviso (amarelo)</option>
            <option value="success">✅ Sucesso (verde)</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" type="button" onClick={() => publish(message)} disabled={saving}>
            {saving ? "Salvando…" : "Publicar aviso"}
          </button>
          {message && (
            <button className="btn btn-ghost" type="button" onClick={() => publish("")} disabled={saving}>
              Remover aviso
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
