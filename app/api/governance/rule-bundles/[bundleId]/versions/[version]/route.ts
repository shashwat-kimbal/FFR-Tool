import { getRuleBundleVersion, updateDraftRuleBundleVersion } from "../../../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bundleId: string; version: string }> };

function toVersion(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    const { bundleId, version: versionText } = await context.params;
    const version = toVersion(versionText);
    if (!version) return jsonNoStore({ error: "invalid_version", message: "version must be a positive integer." }, 400);
    const bundle = await getRuleBundleVersion(bundleId, version);
    return bundle
      ? jsonNoStore({ bundle })
      : jsonNoStore({ error: "bundle_version_not_found", message: "Rule bundle version was not found." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "manage_rule_drafts");
  if ("response" in gate) return gate.response;
  try {
    const { bundleId, version: versionText } = await context.params;
    const version = toVersion(versionText);
    if (!version) return jsonNoStore({ error: "invalid_version", message: "version must be a positive integer." }, 400);
    const existing = await getRuleBundleVersion(bundleId, version);
    if (!existing) return jsonNoStore({ error: "bundle_version_not_found", message: "Rule bundle version was not found." }, 404);
    if (!gate.access.roles.includes("admin") && existing.createdByUserId !== gate.access.actor.userId) {
      return jsonNoStore({ error: "forbidden", message: "Authors can edit only their own drafts." }, 403);
    }
    const body = await readJsonObject(request);
    const bundle = await updateDraftRuleBundleVersion(gate.access.actor, bundleId, version, body.content ?? body);
    return jsonNoStore({ bundle });
  } catch (error) {
    return errorResponse(error);
  }
}
