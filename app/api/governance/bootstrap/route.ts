import { ensureInitialSharedConfiguration, getSharedSettings } from "../../../../db/governance";
import { getRuntimeBindings } from "../../../../db";
import { getGovernanceAccess } from "../../../lib/governance-auth";
import { bootstrapPayload, errorResponse, jsonNoStore } from "../_shared";

export const dynamic = "force-dynamic";

/** A safe health/setup endpoint for the Settings screen and deployment checks. */
export async function GET(request: Request) {
  try {
    const access = await getGovernanceAccess(request);
    if (access.kind === "setup_required") return jsonNoStore(bootstrapPayload(access), 428);
    if (access.kind === "unauthenticated") return jsonNoStore(bootstrapPayload(access), 401);
    // Only an authenticated runtime named admin can cause the first-write
    // bootstrap. Ordinary users can read existing shared configuration but
    // never create seed records merely by opening the app.
    const initialConfiguration = access.roles.includes("admin")
      ? await ensureInitialSharedConfiguration(access.actor)
      : null;
    const settings = await getSharedSettings();
    const bindings = getRuntimeBindings();
    const role = access.roles.includes("admin")
      ? "admin"
      : access.roles.includes("reviewer")
        ? "reviewer"
        : access.roles.includes("author")
          ? "author"
          : "user";
    return jsonNoStore({
      ...bootstrapPayload(access),
      // Compatibility fields keep the existing Settings UI simple while all
      // authorization remains server-side.
      role,
      settings,
      sharedSettings: {
        version: settings.version,
        updatedAt: settings.updatedAt,
        logoConfigured: Boolean(settings.value.branding.logoObjectKey),
        rawEvidenceRetentionEnabled: settings.value.evidenceRetention.enabled,
      },
      storage: {
        d1Configured: Boolean(bindings.DB),
        r2Configured: Boolean(bindings.EVIDENCE),
      },
      initialConfiguration,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
