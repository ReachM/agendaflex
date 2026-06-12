import { FeatureGate } from "@/components/FeatureGate";
import { getFeatureFlags } from "@/lib/server/feature-flags";
import NotasFiscaisClient from "./notas-fiscais-client";

export default async function NotasFiscaisPage() {
  const features = await getFeatureFlags();
  return (
    <FeatureGate featureKey="notas_fiscais" features={features} label="Notas Fiscais">
      <NotasFiscaisClient />
    </FeatureGate>
  );
}
