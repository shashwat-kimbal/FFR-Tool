import {
  ensureInitialSharedConfiguration,
  getCurrentRuleBundle,
  getSharedSettings,
  listAdapterDefinitions,
  listFeatureDefinitions,
  listRuleProfiles,
} from "../../../../db/governance";
import { errorResponse, jsonNoStore, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * The browser only evaluates a released, enabled configuration. Drafts and
 * disabled catalogue entries remain available through their management APIs,
 * but can never silently change a live DLMS assessment.
 */
const GENERIC_DLMS_SCOPE = "DLMS:generic-provisional-v1";
const GENERIC_PROFILE_KEY = "generic-provisional-v1";

function isActiveLifecycle(status: string): boolean {
  return status === "provisional_active" || status === "approved_active";
}

/**
 * One authenticated, read-only payload for the DLMS evaluator. Keeping this
 * endpoint narrow avoids the client stitching together independently changing
 * settings, releases, profiles, adapters, and feature catalogues.
 */
export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;

  try {
    // The page loads bootstrap and active configuration concurrently. Repeating
    // the idempotent admin-only guard here prevents a first-load race from
    // returning an empty bundle before `/bootstrap` finishes.
    if (gate.access.roles.includes("admin")) {
      await ensureInitialSharedConfiguration(gate.access.actor);
    }
    const [settings, bundle, profiles, adapters, features] = await Promise.all([
      getSharedSettings(),
      getCurrentRuleBundle(GENERIC_DLMS_SCOPE),
      listRuleProfiles(),
      listAdapterDefinitions(),
      listFeatureDefinitions(),
    ]);
    const profile =
      profiles.find(
        (candidate) =>
          candidate.profileKey === GENERIC_PROFILE_KEY &&
          candidate.enabled &&
          isActiveLifecycle(candidate.lifecycleStatus),
      ) ?? null;
    const activeAdapters = adapters.filter(
      (adapter) => adapter.enabled && isActiveLifecycle(adapter.lifecycleStatus),
    );
    const activeAdapterKeys = new Set(activeAdapters.map((adapter) => adapter.adapterKey));

    return jsonNoStore({
      scopeKey: GENERIC_DLMS_SCOPE,
      settings,
      // Null is meaningful: callers must use their labelled local provisional
      // fallback until an independently reviewed release exists.
      bundle,
      profile,
      adapters: activeAdapters,
      features: features.filter(
        (feature) => feature.enabled !== false && activeAdapterKeys.has(feature.adapterKey),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
