import { CreditCard } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterAssinaturasPage() {
  return (
    <MasterPlaceholder
      title="Assinaturas & MRR"
      subtitle="Receita recorrente, churn e cohorts"
      icon={<CreditCard size={32} />}
      description="Painel detalhado de receita: MRR/ARR, conversão de trial, churn por plano, LTV e cohort analysis. Hoje os indicadores principais aparecem em Visão geral."
      features={[
        "Gráficos de MRR/ARR com breakdown por plano",
        "Cohort de retenção e churn mensal",
        "Histórico de pagamentos Mercado Pago",
        "Recobrança automática e disputa de chargeback"
      ]}
    />
  );
}
