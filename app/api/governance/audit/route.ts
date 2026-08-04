import { listAuditEvents } from "../../../../db/governance";
import { errorResponse, jsonNoStore, queryLimit, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "view_audit");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ events: await listAuditEvents(queryLimit(request, 100)) });
  } catch (error) {
    return errorResponse(error);
  }
}
