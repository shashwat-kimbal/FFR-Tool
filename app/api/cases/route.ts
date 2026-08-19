import { createCase, listCases } from "../../../db/cases";
import { errorResponse, jsonNoStore, queryLimit, readJsonObject, requireGovernanceCapability } from "../governance/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_cases");
  if ("response" in gate) return gate.response;
  try {
    const caseRef = new URL(request.url).searchParams.get("caseRef");
    return jsonNoStore({ cases: await listCases({ limit: queryLimit(request), caseRef }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_cases");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    const created = await createCase(gate.access.actor, body);
    return jsonNoStore({ case: created.case, meters: created.meters }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
