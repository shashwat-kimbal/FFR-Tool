import { releaseRuleBundleVersion } from "../../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bundleId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireGovernanceCapability(request, "publish_rule_versions");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    const version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) {
      return jsonNoStore({ error: "invalid_version", message: "version must be a positive integer." }, 400);
    }
    const { bundleId } = await context.params;
    const bundle = await releaseRuleBundleVersion(gate.access.actor, bundleId, version, {
      scopeKey: typeof body.scopeKey === "string" ? body.scopeKey : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      releaseKind: "publish",
    });
    return jsonNoStore({ bundle, released: true });
  } catch (error) {
    return errorResponse(error);
  }
}
