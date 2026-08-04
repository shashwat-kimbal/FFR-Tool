import { GovernanceDataError } from "../../../../db/governance";
import {
  MAX_MULTIPART_EVIDENCE_REQUEST_BYTES,
  assertSupportedEvidenceUpload,
  getSupportedEvidenceContentType,
  purgeRetainedEvidence,
  requireEvidenceRetentionPolicy,
  retainRawEvidenceIfEnabled,
} from "../../../lib/governance-storage";
import { errorResponse, jsonNoStore, requireGovernanceCapability } from "../_shared";

export const dynamic = "force-dynamic";

type EvidenceUpload = {
  bytes: ArrayBuffer;
  contentType: string;
};

function parseContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  if (!/^\d+$/.test(raw.trim())) {
    throw new GovernanceDataError("Evidence Content-Length must be a whole number of bytes.", "invalid_evidence_content_length");
  }
  const size = Number(raw);
  if (!Number.isSafeInteger(size)) {
    throw new GovernanceDataError("Evidence Content-Length is too large.", "invalid_evidence_content_length", 413);
  }
  return size;
}

function assertRequestSize(request: Request, maximum: number, requireKnownLength = false): void {
  const contentLength = parseContentLength(request);
  if (requireKnownLength && contentLength === null) {
    throw new GovernanceDataError(
      "Multipart evidence uploads require Content-Length so the server can enforce the retention limit.",
      "evidence_content_length_required",
      411,
    );
  }
  if (contentLength !== null && contentLength > maximum) {
    throw new GovernanceDataError("Evidence upload exceeds the server retention size limit.", "invalid_evidence_size", 413);
  }
}

async function readRawEvidenceBody(request: Request, maximumBytes: number): Promise<ArrayBuffer> {
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximumBytes) {
        try {
          await reader.cancel("Evidence upload exceeds the server retention size limit.");
        } catch {
          // The request is already being rejected; preserve the policy error.
        }
        throw new GovernanceDataError("Evidence upload exceeds the server retention size limit.", "invalid_evidence_size", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/**
 * Raw evidence has its own explicit endpoint. It is intentionally separate
 * from run summaries so normal analysis uploads remain non-retaining.
 */
async function readEvidenceUpload(request: Request): Promise<EvidenceUpload> {
  const requestContentType = request.headers.get("content-type") ?? "";
  const isMultipart = requestContentType.toLowerCase().startsWith("multipart/form-data");

  if (!isMultipart) {
    const allowedType = getSupportedEvidenceContentType(requestContentType);
    assertRequestSize(request, allowedType.maximumBytes);
    return {
      bytes: await readRawEvidenceBody(request, allowedType.maximumBytes),
      contentType: allowedType.contentType,
    };
  }

  // formData() buffers the multipart body, so reject an unbounded or clearly
  // oversized request before asking the runtime to parse it. The stored File
  // is subsequently checked against the stricter per-type size limit.
  assertRequestSize(request, MAX_MULTIPART_EVIDENCE_REQUEST_BYTES, true);
  const uploaded = (await request.formData()).get("evidence");
  if (!(uploaded instanceof File)) {
    throw new GovernanceDataError(
      "Multipart evidence uploads must include an `evidence` file field.",
      "missing_evidence_file",
    );
  }
  // This checks File.type and File.size before allocating its ArrayBuffer.
  assertSupportedEvidenceUpload(uploaded.type, uploaded.size);
  return {
    bytes: await uploaded.arrayBuffer(),
    contentType: uploaded.type || "application/octet-stream",
  };
}

function caseRefFromRequest(request: Request): string | undefined {
  const value = request.headers.get("x-case-ref")?.trim();
  return value || undefined;
}

export async function POST(request: Request) {
  const gate = await requireGovernanceCapability(request, "save_run_summary");
  if ("response" in gate) return gate.response;

  try {
    // Check policy before reading the raw request body. Disabled retention is
    // an explicit no-upload state, rather than a successful upload discarded
    // after browser bytes have crossed the boundary.
    await requireEvidenceRetentionPolicy();
    const upload = await readEvidenceUpload(request);
    const evidence = await retainRawEvidenceIfEnabled(gate.access.actor, {
      ...upload,
      caseRef: caseRefFromRequest(request),
    });
    return jsonNoStore({ evidence }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * An administrator may remove either one overdue batch or all retained raw
 * evidence. Repeating a bounded all-purge is intentional: it avoids an
 * unbounded R2/D1 operation in a single Worker request.
 */
export async function DELETE(request: Request) {
  const gate = await requireGovernanceCapability(request, "manage_shared_settings");
  if ("response" in gate) return gate.response;

  try {
    const params = new URL(request.url).searchParams;
    const requestedMode = params.get("mode") ?? "expired";
    if (requestedMode !== "expired" && requestedMode !== "all") {
      throw new GovernanceDataError("Evidence purge mode must be expired or all.", "invalid_purge_mode");
    }
    const mode = requestedMode;
    const limitRaw = params.get("limit");
    const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : undefined;
    if (limitRaw !== null && (limit === undefined || limit < 1 || !Number.isSafeInteger(limit))) {
      throw new GovernanceDataError("Evidence purge limit must be a whole number.", "invalid_purge_limit");
    }
    const purge = await purgeRetainedEvidence(gate.access.actor, { mode, limit });
    return jsonNoStore({ purge });
  } catch (error) {
    return errorResponse(error);
  }
}
