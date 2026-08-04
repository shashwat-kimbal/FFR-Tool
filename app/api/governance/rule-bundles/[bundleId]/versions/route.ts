import { createDraftRuleBundleVersion } from "../../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bundleId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "manage_rule_drafts");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    const { bundleId } = await context.params;
    const bundle = await createDraftRuleBundleVersion(gate.access.actor, bundleId, body.content);
    return jsonNoStore({ bundle }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
