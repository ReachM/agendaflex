import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { requireAnyAuth } from "@/lib/security/auth";
import { featuresToBooleanMap, resolvePlanFeatures } from "@/lib/security/plan-guard";
import { getVisibleMenuItems, MASTER_MENU_ITEMS } from "@/lib/security/permissions";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAnyAuth(request);

    let planFeatures: Record<string, boolean> = {};
    let menuItems: { href: string; label: string; icon: string }[] = [];

    if (context.kind === "tenant") {
      const features = await resolvePlanFeatures(context.companyId);
      planFeatures = featuresToBooleanMap(features);
      menuItems = getVisibleMenuItems(context.roleName, planFeatures);
    } else {
      menuItems = MASTER_MENU_ITEMS;
    }

    return ok({
      kind: context.kind,
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email
      },
      role: context.roleName,
      company: context.company
        ? {
            id: context.company.id,
            name: context.company.name,
            tradeName: context.company.tradeName,
            status: context.company.status,
            segment: context.company.segment,
            plan: context.company.plan,
            slug: (context.company as any).slug ?? null,
            publicBookingEnabled: (context.company as any).publicBookingEnabled ?? false
          }
        : null,
      planFeatures,
      menuItems
    });
  } catch (error) {
    return handleApiError(error);
  }
}
