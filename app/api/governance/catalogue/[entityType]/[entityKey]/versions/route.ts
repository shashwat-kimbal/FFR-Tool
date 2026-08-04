import { listGovernedCatalogueVersions } from "../../../../../../../db/governance";
import { errorResponse, jsonNoStore, requireGovernanceCapability } from "../../../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ entityType: string; entityKey: string }> },
) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    const { entityType, entityKey } = await context.params;
    return jsonNoStore({ versions: await listGovernedCatalogueVersions(entityType, entityKey) });
  } catch (error) {
    return errorResponse(error);
  }
}
