"use client";
import { DollarSign, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

// TODO [MVP-FUTURE] Módulo financeiro completo — reativar na v2
// O código original foi preservado no histórico git.

export default function FinanceiroPage() {
  return (
    <>
      <PageHeader title="Financeiro" subtitle="Controle financeiro da empresa" />
      <div className="upgrade-banner">
        <div className="upgrade-banner__icon"><DollarSign size={28} /></div>
        <div className="upgrade-banner__text">
          <strong>Funcionalidade em desenvolvimento</strong>
          <span>
            O módulo financeiro estará disponível em uma versão futura do MarcaiFlex.
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
