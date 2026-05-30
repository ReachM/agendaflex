import { Users } from "lucide-react";
import { MasterPlaceholder } from "@/components/master-placeholder";

export default function MasterUsuariosPage() {
  return (
    <MasterPlaceholder
      title="Usuários"
      subtitle="Diretório global de todos os usuários da plataforma"
      icon={<Users size={32} />}
      description="Visão consolidada de todos os usuários: super admins, admins de empresa, gerentes, atendentes. Pesquisa por e-mail, papel ou empresa."
      features={[
        "Lista global filtrada por papel e status",
        "Resetar senha e enviar magic link",
        "Suspender ou reativar contas em escala",
        "Auditoria de últimas atividades por usuário"
      ]}
    />
  );
}
