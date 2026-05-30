import { Clock } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterFilasPage() {
  return (
    <MasterPlaceholder
      title="Filas & jobs"
      subtitle="Workers, jobs agendados e dead-letter"
      icon={<Clock size={32} />}
      description="Lembretes WhatsApp, e-mails, geração de relatórios, sync de notas fiscais — tudo passa por filas. Aqui você monitora throughput, atrasos e retry."
      features={[
        "Tamanho da fila e workers ativos em tempo real",
        "Dead-letter queue com retry manual",
        "Jobs lentos identificados (p95 > 30s)",
        "Cron scheduler health (próximas execuções)"
      ]}
    />
  );
}
