import { releaseGovernedCatalogueVersion } from "../../../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ entityType: string; entityKey: string }> },
) {
  const gate = await requireGovernanceCapability(request, "publish_rule_versions");
  if ("response" in gate) return gate.response;
  try {
    const { entityType, entityKey } = await context.params;
    const body = await readJsonObject(request);
    return jsonNoStore({
      version: await releaseGovernedCatalogueVersion(
        gate.access.actor,
        entityType,
        entityKey,
        Number(body.version),
        { releaseKind: "rollback", reason: typeof body.reason === "string" ? body.reason : undefined },
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
