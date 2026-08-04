import { getRuleBundleVersion, transitionRuleBundleVersion } from "../../../../../../db/governance";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bundleId: string }> };

function toVersion(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await readJsonObject(request);
    const targetStatus = body.targetStatus;
    const version = toVersion(body.version);
    if (!version || typeof targetStatus !== "string") {
      return jsonNoStore({ error: "invalid_transition", message: "version and targetStatus are required." }, 400);
    }
    const capability =
      targetStatus === "provisional_active" || targetStatus === "approved_active"
        ? "review_rule_versions"
        : targetStatus === "retired"
          ? "publish_rule_versions"
          : "manage_rule_drafts";
    const gate = await requireGovernanceCapability(request, capability);
    if ("response" in gate) return gate.response;
    const { bundleId } = await context.params;
    const existing = await getRuleBundleVersion(bundleId, version);
    if (!existing) return jsonNoStore({ error: "bundle_version_not_found", message: "Rule bundle version was not found." }, 404);
    if (
      !gate.access.roles.includes("admin") &&
      (targetStatus === "draft" || targetStatus === "in_review") &&
      existing.createdByUserId !== gate.access.actor.userId
    ) {
      return jsonNoStore({ error: "forbidden", message: "Authors can submit only their own drafts for review." }, 403);
    }
    const bundle = await transitionRuleBundleVersion(
      gate.access.actor,
      bundleId,
      version,
      targetStatus,
      body.reviewNote,
    );
    return jsonNoStore({ bundle });
  } catch (error) {
    return errorResponse(error);
  }
}
