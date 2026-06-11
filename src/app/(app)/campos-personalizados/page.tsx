import { redirect } from "next/navigation";

/**
 * Campos personalizados não estão disponíveis como tela standalone para tenants.
 * A funcionalidade é usada internamente (via API) no cadastro de clientes,
 * profissionais, serviços e agendamentos. O gerenciamento das definições é feito
 * pelo Super Admin (/api/master/custom-fields). Tenants caem no dashboard.
 */
export default function CamposPersonalizadosPage() {
  redirect("/dashboard");
}
