import {
  createDraftRuleBundleVersion,
  createRuleBundle,
  getCurrentRuleBundle,
  getRuleBundleIdByKey,
  listRuleBundles,
} from "../../../../db/governance";
import { adaptDlmsRuleBundle } from "../../../lib/governance-adapters";
import { errorResponse, jsonNoStore, readJsonObject, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get("scopeKey");
    if (url.searchParams.get("current") === "true") {
      if (!scopeKey) return jsonNoStore({ error: "scope_key_required", message: "scopeKey is required for current bundle lookup." }, 400);
      return jsonNoStore({ bundle: await getCurrentRuleBundle(scopeKey) });
    }
    return jsonNoStore({ bundles: await listRuleBundles(scopeKey) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_rule_drafts");
  if ("response" in gate) return gate.response;
  try {
    const body = await readJsonObject(request);
    const content = adaptDlmsRuleBundle(body.content ?? body.bundle ?? body);
    const existingBundleId = await getRuleBundleIdByKey(content.bundleKey);
    const bundle = existingBundleId
      ? await createDraftRuleBundleVersion(gate.access.actor, existingBundleId, content)
      : await createRuleBundle(gate.access.actor, content);
    return jsonNoStore({ bundle, createdDraftVersion: true }, existingBundleId ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
