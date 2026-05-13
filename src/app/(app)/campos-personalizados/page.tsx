import { redirect } from "next/navigation";

// Custom field management has been moved to the Super Admin panel.
// Tenant users are redirected to the dashboard.
export default function CamposPersonalizadosPage() {
  redirect("/dashboard");
}
