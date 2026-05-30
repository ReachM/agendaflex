import { FileText } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterNotasFiscaisPage() {
  return (
    <MasterPlaceholder
      title="Notas fiscais (global)"
      subtitle="Status das emissões em todas as empresas"
      icon={<FileText size={32} />}
      description="Visão centralizada de emissões NFE.io de todos os tenants: autorizadas, processando, erro e canceladas. Útil para suporte técnico."
      features={[
        "Filtros por tenant, status e período",
        "Reprocessar emissões com erro em lote",
        "Métricas de tempo médio de emissão",
        "Custo agregado da integração NFE.io por mês"
      ]}
    />
  );
}
