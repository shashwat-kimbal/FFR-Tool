import { transitionGovernedCatalogueVersion } from "../../../../../../../db/governance";
import {
  errorResponse,
  jsonNoStore,
  readJsonObject,
  requireGovernanceCapability,
} from "../../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ entityType: string; entityKey: string }> },
) {
  try {
    const body = await readJsonObject(request);
    const gate = await requireGovernanceCapability(
      request,
      body.targetStatus === "in_review"
        ? "manage_catalogue"
        : "review_rule_versions",
    );
    if ("response" in gate) return gate.response;
    const { entityType, entityKey } = await context.params;
    return jsonNoStore({
      version: await transitionGovernedCatalogueVersion(
        gate.access.actor,
        entityType,
        entityKey,
        Number(body.version),
        body.targetStatus,
        body.reviewNote,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
