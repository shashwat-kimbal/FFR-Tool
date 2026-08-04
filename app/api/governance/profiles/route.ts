import { listRuleProfiles, upsertRuleProfile } from "../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ profiles: await listRuleProfiles(new URL(request.url).searchParams.get("productFamily")) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_catalogue");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    return jsonNoStore({ profile: await upsertRuleProfile(gate.access.actor, body.profile ?? body) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
