"use client";
import { CheckSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

// TODO [MVP-FUTURE] Módulo de checklists — reativar na v2
// O código original foi preservado no histórico git.

export default function ChecklistsPage() {
  return (
    <>
      <PageHeader title="Checklists" subtitle="Checklist de atendimento e via do cliente" />
      <div className="upgrade-banner">
        <div className="upgrade-banner__icon"><CheckSquare size={28} /></div>
        <div className="upgrade-banner__text">
          <strong>Funcionalidade em desenvolvimento</strong>
          <span>
            O módulo de checklists estará disponível em uma versão futura do AgendaFlex.
            Fique atento às atualizações!
          </span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link className="button secondary" href="/dashboard">
          <ArrowLeft size={16} />
          Voltar ao Dashboard
        </Link>
      </div>
    </>
  );
}
