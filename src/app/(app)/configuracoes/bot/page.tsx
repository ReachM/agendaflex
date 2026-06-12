import { FeatureGate } from "@/components/FeatureGate";
import { getFeatureFlags } from "@/lib/server/feature-flags";
import BotSettingsClient from "./bot-client";

export default async function BotPage() {
  const features = await getFeatureFlags();
  return (
    <FeatureGate featureKey="bot_whatsapp" features={features} label="Bot WhatsApp">
      <BotSettingsClient />
    </FeatureGate>
  );
}
