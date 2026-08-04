import { getSharedLogo, assertSupportedLogoUpload, uploadSharedLogo } from "../../../lib/governance-storage";
import { errorResponse, jsonNoStore, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

function expectedSettingsVersion(request: Request): number | undefined {
  const raw = request.headers.get("x-settings-version");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const gate = await requireGovernanceCapability(request, "read_shared_configuration");
  if ("response" in gate) return gate.response;
  try {
    const logo = await getSharedLogo();
    if (!logo) return jsonNoStore({ error: "logo_not_configured", message: "No shared logo has been uploaded." }, 404);
    return new Response(logo.body, {
      headers: {
        "content-type": logo.contentType,
        "content-disposition": "inline",
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_branding");
  if ("response" in gate) return gate.response;
  try {
    const multipart = request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data");
    const uploaded = multipart ? (await request.formData()).get("logo") : null;
    const bytes = uploaded instanceof File ? await uploaded.arrayBuffer() : await request.arrayBuffer();
    const requestedType = uploaded instanceof File ? uploaded.type : request.headers.get("content-type");
    const contentType = assertSupportedLogoUpload(requestedType, bytes.byteLength);
    const settings = await uploadSharedLogo(gate.access.actor, {
      bytes,
      contentType,
      expectedSettingsVersion: expectedSettingsVersion(request),
    });
    return jsonNoStore(
      {
        settings,
        logoUrl: "/api/governance/logo",
        logoObjectKey: settings.value.branding.logoObjectKey,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
