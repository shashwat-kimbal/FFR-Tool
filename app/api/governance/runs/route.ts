import { createRunSummary, listRunSummaries } from "../../../../db/governance";
import { errorResponse, jsonNoStore, queryLimit, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "save_run_summary");
  if ("response" in gate) return gate.response;
  try {
    const includeAll = gate.access.roles.includes("admin") && new URL(request.url).searchParams.get("all") === "true";
    return jsonNoStore({ runs: await listRunSummaries(gate.access.actor, includeAll, queryLimit(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "save_run_summary");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    return jsonNoStore({ run: await createRunSummary(gate.access.actor, body.run ?? body) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
