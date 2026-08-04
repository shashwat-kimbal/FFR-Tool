import { listGovernanceFixtures, upsertGovernanceFixture } from "../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

/** Metadata endpoint only. Raw fixture evidence stays in the repository or an explicit retention store. */
export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ fixtures: await listGovernanceFixtures() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_catalogue");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    return jsonNoStore({ fixture: await upsertGovernanceFixture(gate.access.actor, body.fixture ?? body) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
