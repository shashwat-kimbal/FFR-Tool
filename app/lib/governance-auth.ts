import { getAssignedRoles } from "../../db/governance";
import { getRuntimeBindings } from "../../db";
import type { GovernanceActor, GovernanceRole } from "./governance-types";

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";

export const GOVERNANCE_CAPABILITIES = [
  "read_shared_configuration",
  "save_run_summary",
  "read_cases",
  "manage_cases",
  "manage_rule_drafts",
  "review_rule_versions",
  "publish_rule_versions",
  "manage_shared_settings",
  "manage_catalogue",
  "manage_roles",
  "manage_branding",
  "view_audit",
] as const;

export type GovernanceCapability = (typeof GOVERNANCE_CAPABILITIES)[number];

export type GovernanceAccess =
  | {
      kind: "setup_required";
      actor: GovernanceActor | null;
      setup: {
        requiredRuntimeVariable: "ADMIN_ALLOWLIST";
        message: string;
      };
    }
  | { kind: "unauthenticated" }
  | { kind: "authorized"; actor: GovernanceActor; roles: GovernanceRole[] };

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function getPlatformActor(request: Request): GovernanceActor | null {
  const emailHeader = request.headers.get(USER_EMAIL_HEADER);
  if (!emailHeader?.trim()) return null;
  const email = normaliseEmail(emailHeader);
  const fullName =
    request.headers.get(USER_FULL_NAME_ENCODING_HEADER) ===
    "percent-encoded-utf-8"
      ? safeDecode(request.headers.get(USER_FULL_NAME_HEADER) ?? "")
      : null;
  const userId =
    request.headers.get(USER_ID_HEADER)?.trim() || `email:${email}`;
  return {
    userId,
    email,
    displayName: fullName?.trim() || email,
  };
}

export function getConfiguredAdminEmails(): string[] {
  const raw = getRuntimeBindings().ADMIN_ALLOWLIST;
  if (typeof raw !== "string") return [];
  return [
    ...new Set(
      raw
        .split(/[\n,;]/)
        .map(normaliseEmail)
        .filter(Boolean),
    ),
  ];
}

export async function getGovernanceAccess(
  request: Request,
): Promise<GovernanceAccess> {
  const administrators = getConfiguredAdminEmails();
  let actor = getPlatformActor(request);

  if (administrators.length === 0) {
    return {
      kind: "setup_required",
      actor,
      setup: {
        requiredRuntimeVariable: "ADMIN_ALLOWLIST",
        message:
          "Shared governance is in setup mode. A deployment administrator must configure the server-side ADMIN_ALLOWLIST before shared settings or rule publishing can be used.",
      },
    };
  }

  const isWildcardAdmin = administrators.includes("*") || administrators.includes("all");

  if (!actor && isWildcardAdmin) {
    actor = {
      userId: "default-admin",
      email: "admin@local",
      displayName: "Local Administrator",
    };
  }

  if (!actor) return { kind: "unauthenticated" };

  if (isWildcardAdmin || administrators.includes(actor.email)) {
    return { kind: "authorized", actor, roles: ["admin", "user", "author", "reviewer"] };
  }

  const assigned = await getAssignedRoles(actor);
  return {
    kind: "authorized",
    actor,
    roles: [...new Set<GovernanceRole>(["user", ...assigned])],
  };
}

export function hasGovernanceCapability(
  access: GovernanceAccess,
  capability: GovernanceCapability,
): boolean {
  if (access.kind !== "authorized") return false;
  if (access.roles.includes("admin")) return true;
  if (
    capability === "read_shared_configuration" ||
    capability === "save_run_summary" ||
    capability === "read_cases" ||
    capability === "manage_cases"
  )
    return true;
  if (capability === "manage_rule_drafts" || capability === "manage_catalogue")
    return access.roles.includes("author");
  if (capability === "review_rule_versions")
    return access.roles.includes("reviewer");
  return false;
}

export function listGovernanceCapabilities(
  access: GovernanceAccess,
): GovernanceCapability[] {
  return GOVERNANCE_CAPABILITIES.filter((capability) =>
    hasGovernanceCapability(access, capability),
  );
}
