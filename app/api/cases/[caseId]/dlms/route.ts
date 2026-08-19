import { createDlmsReport } from "../../../../../db/cases";
import { GovernanceDataError } from "../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../governance/_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "manage_cases");
  if ("response" in gate) return gate.response;
  try {
    const { caseId } = await context.params;
    const body = await readJsonObject(request);
    if (body.meterRole !== "old" && body.meterRole !== "new") {
      throw new GovernanceDataError("meterRole must be 'old' or 'new'.", "invalid_input");
    }
    const report = await createDlmsReport(gate.access.actor, caseId, body.meterRole, body);
    return jsonNoStore({ report }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
