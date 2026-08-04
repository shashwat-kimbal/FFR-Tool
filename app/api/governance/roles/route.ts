import { listRoleAssignments, setRoleAssignment } from "../../../../db/governance";
import type { GovernanceRole } from "../../../lib/governance-types";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_roles");
  if ("response" in gate) return gate.response;
  try {
    return jsonNoStore({ assignments: await listRoleAssignments() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_roles");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    await setRoleAssignment(gate.access.actor, {
      email: String(body.email ?? ""),
      role: body.role as GovernanceRole,
      enabled: body.enabled !== false,
      userId: typeof body.userId === "string" ? body.userId : null,
    });
    return jsonNoStore({ assignments: await listRoleAssignments() }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
