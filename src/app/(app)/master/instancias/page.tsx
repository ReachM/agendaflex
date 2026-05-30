import { Bot } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterInstanciasPage() {
  return (
    <MasterPlaceholder
      title="Instâncias WhatsApp"
      subtitle="Status global de cada Evolution API conectada"
      icon={<Bot size={32} />}
      description="Visão consolidada das instâncias Evolution API por tenant: conexão, mensagens nas últimas 24h, lembretes enviados e erros de webhook."
      features={[
        "Lista de instâncias por empresa com status (CONNECTED, DISCONNECTED, ERROR)",
        "Reiniciar/reconectar instância remotamente",
        "Métricas: mensagens enviadas/recebidas, erros",
        "Logs detalhados do webhook por instância"
      ]}
    />
  );
}
