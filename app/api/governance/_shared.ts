import { isDatabaseSchemaError, GovernanceDataError } from "../../../db/governance";
import {
  getGovernanceAccess,
  hasGovernanceCapability,
  listGovernanceCapabilities,
  type GovernanceAccess,
  type GovernanceCapability,
} from "../../lib/governance-auth";
import { isRecord } from "../../lib/governance-contract";

export const dynamic = "force-dynamic";

export type AuthorizedRouteAccess = Extract<GovernanceAccess, { kind: "authorized" }>;

export async function requireGovernanceCapability(
  request: Request,
  capability: GovernanceCapability,
): Promise<{ access: AuthorizedRouteAccess } | { response: Response }> {
  try {
    const access = await getGovernanceAccess(request);
    if (access.kind === "setup_required") {
      return {
        response: Response.json(
          {
            error: "setup_required",
            bootstrap: {
              mode: "setup_required",
              authenticated: Boolean(access.actor),
              actor: access.actor,
              ...access.setup,
            },
          },
          { status: 428, headers: { "cache-control": "no-store" } },
        ),
      };
    }
    if (access.kind === "unauthenticated") {
      return ResponseGate(401, "authentication_required", "Sign in with ChatGPT to use shared governance data.");
    }
    if (!hasGovernanceCapability(access, capability)) {
      return ResponseGate(403, "forbidden", "Your assigned role does not allow this action.");
    }
    return { access };
  } catch (error) {
    return { response: errorResponse(error) };
  }
}

function ResponseGate(status: number, error: string, message: string): { response: Response } {
  return {
    response: Response.json({ error, message }, { status, headers: { "cache-control": "no-store" } }),
  };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new GovernanceDataError("Request body must be valid JSON.", "invalid_json");
  }
  if (!isRecord(value)) throw new GovernanceDataError("Request body must be a JSON object.", "invalid_json");
  return value;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof GovernanceDataError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  if (isDatabaseSchemaError(error)) {
    return Response.json(
      {
        error: "migration_required",
        message: "Shared governance storage is not ready. Deploy the D1 migration before using this endpoint.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: "governance_unavailable", message: "Shared governance data is temporarily unavailable." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export function jsonNoStore(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

export function queryLimit(request: Request, fallback = 50): number {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number(raw) : fallback;
  return Number.isInteger(parsed) ? Math.max(1, Math.min(200, parsed)) : fallback;
}

export function bootstrapPayload(access: GovernanceAccess): Record<string, unknown> {
  if (access.kind === "setup_required") {
    return {
      mode: "setup_required",
      authenticated: Boolean(access.actor),
      actor: access.actor,
      ...access.setup,
    };
  }
  if (access.kind === "unauthenticated") {
    return {
      mode: "authentication_required",
      authenticated: false,
      message: "Sign in with ChatGPT to use shared governance data.",
    };
  }
  return {
    mode: "ready",
    authenticated: true,
    actor: access.actor,
    roles: access.roles,
    capabilities: listGovernanceCapabilities(access),
  };
}
