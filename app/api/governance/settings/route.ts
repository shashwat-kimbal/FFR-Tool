import { getSharedSettings, updateSharedSettings } from "../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ settings: await getSharedSettings() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_shared_settings");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    const expectedVersion = body.expectedVersion;
    const settings = body.settings ?? body.value;
    return jsonNoStore(
      { settings: await updateSharedSettings(gate.access.actor, settings, Number(expectedVersion)) },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
