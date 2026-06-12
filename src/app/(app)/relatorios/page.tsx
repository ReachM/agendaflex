import { FeatureGate } from "@/components/FeatureGate";
import { getFeatureFlags } from "@/lib/server/feature-flags";
import RelatoriosClient from "./relatorios-client";

export default async function RelatoriosPage() {
  const features = await getFeatureFlags();
  return (
    <FeatureGate featureKey="relatorios" features={features} label="Relatórios">
      <RelatoriosClient />
    </FeatureGate>
  );
}
