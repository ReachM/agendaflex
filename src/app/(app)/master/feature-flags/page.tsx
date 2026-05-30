import { ToggleLeft } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterFeatureFlagsPage() {
  return (
    <MasterPlaceholder
      title="Feature flags"
      subtitle="Habilita/desabilita funcionalidades por tenant"
      icon={<ToggleLeft size={32} />}
      description="Rollout controlado de novas funcionalidades sem precisar deploy. Hoje, flags de plano (allowFinancialControl etc.) vivem em Plano. Esta tela centralizará flags de produto."
      features={[
        "Flag global com override por tenant",
        "Histórico de mudanças (quem ligou/desligou e quando)",
        "Rollout gradual (10% → 50% → 100%)",
        "Kill switch para emergências"
      ]}
    />
  );
}
