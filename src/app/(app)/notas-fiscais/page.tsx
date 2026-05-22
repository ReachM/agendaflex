"use client";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

// TODO [MVP-FUTURE] Módulo de notas fiscais — reativar na v2
// O código original foi preservado no histórico git.

export default function NotasFiscaisPage() {
  return (
    <>
      <PageHeader title="Notas Fiscais" subtitle="Solicitação e controle de notas fiscais" />
      <div className="upgrade-banner">
        <div className="upgrade-banner__icon"><FileText size={28} /></div>
        <div className="upgrade-banner__text">
          <strong>Funcionalidade em desenvolvimento</strong>
          <span>
            O módulo de notas fiscais estará disponível em uma versão futura do AgendaFlex.
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
