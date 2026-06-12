import { FeatureGate } from "@/components/FeatureGate";
import { getFeatureFlags } from "@/lib/server/feature-flags";
import FinanceiroClient from "./financeiro-client";

export default async function FinanceiroPage() {
  const features = await getFeatureFlags();
  return (
    <FeatureGate featureKey="financeiro" features={features} label="Financeiro">
      <FinanceiroClient />
    </FeatureGate>
  );
}
