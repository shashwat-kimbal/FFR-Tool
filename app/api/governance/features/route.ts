import { listFeatureDefinitions, upsertFeatureDefinition } from "../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ features: await listFeatureDefinitions(new URL(request.url).searchParams.get("adapterKey")) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_catalogue");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    return jsonNoStore({ feature: await upsertFeatureDefinition(gate.access.actor, body.feature ?? body) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
