import { listAdapterDefinitions, upsertAdapterDefinition } from "../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ adapters: await listAdapterDefinitions(new URL(request.url).searchParams.get("productFamily")) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_catalogue");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    return jsonNoStore({ adapter: await upsertAdapterDefinition(gate.access.actor, body.adapter ?? body) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
