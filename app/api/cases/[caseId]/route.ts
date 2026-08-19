import { getCaseById, getCaseMeters, getLatestDlmsReports } from "../../../../db/cases";
import { errorResponse, jsonNoStore, requireGovernanceCapability } from "../../governance/_shared";
import { GovernanceDataError } from "../../../../db/governance";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "read_cases");
  if ("response" in gate) return gate.response;
  try {
    const { caseId } = await context.params;
    const record = await getCaseById(caseId);
    if (!record) throw new GovernanceDataError("Case was not found.", "case_not_found", 404);
    const [meters, latestReports] = await Promise.all([getCaseMeters(caseId), getLatestDlmsReports(caseId)]);
    return jsonNoStore({
      case: record,
      meters: meters.map((meter) => ({
        role: meter.role,
        meterSerial: meter.meterSerial,
        latestReport: latestReports[meter.role],
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
