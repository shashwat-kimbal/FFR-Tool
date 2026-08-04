import { getD1, getObjectStore } from "../../db";
import {
  GovernanceDataError,
  getSharedSettings,
  recordStoredObject,
  removeStoredObject,
  updateSharedSettings,
  writeAuditEvent,
} from "../../db/governance";
import type { GovernanceActor, SettingsRecord } from "./governance-types";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Evidence is deliberately a small, allow-listed subset of the formats the
 * intake can understand. R2 is a byte store, so this prevents it becoming a
 * general-purpose file drop while keeping the actual FFR/DLMS and photo flow
 * intact.
 */
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_MULTIPART_EVIDENCE_REQUEST_BYTES = MAX_EVIDENCE_BYTES + 64 * 1024;
export const MAX_EVIDENCE_PURGE_BATCH = 250;

const EVIDENCE_CONTENT_TYPE_LIMITS = new Map<string, number>([
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", MAX_EVIDENCE_BYTES],
  ["application/vnd.ms-excel", MAX_EVIDENCE_BYTES],
  ["application/vnd.ms-excel.sheet.macroenabled.12", MAX_EVIDENCE_BYTES],
  ["text/csv", MAX_EVIDENCE_BYTES],
  ["application/csv", MAX_EVIDENCE_BYTES],
  ["image/png", MAX_IMAGE_EVIDENCE_BYTES],
  ["image/jpeg", MAX_IMAGE_EVIDENCE_BYTES],
  ["image/webp", MAX_IMAGE_EVIDENCE_BYTES],
]);

export type EvidenceRetentionPolicy = {
  enabled: true;
  retentionDays: number;
};

export type EvidencePurgeMode = "expired" | "all";

export type EvidencePurgeResult = {
  mode: EvidencePurgeMode;
  retentionDays: number | null;
  cutoffAt: string | null;
  attempted: number;
  deleted: number;
  remainingMayExist: boolean;
};

type StoredEvidenceRow = {
  object_key?: unknown;
  content_type?: unknown;
  size_bytes?: unknown;
  case_ref?: unknown;
  created_at?: unknown;
};

function normaliseContentType(contentType: string | null | undefined): string {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function asDbText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asDbNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normaliseEvidenceCaseRef(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const caseRef = value.trim();
  if (!caseRef) return null;
  if (caseRef.length > 160 || /[\u0000-\u001f\u007f]/.test(caseRef)) {
    throw new GovernanceDataError(
      "Evidence case reference must be at most 160 printable characters.",
      "invalid_evidence_case_ref",
    );
  }
  return caseRef;
}

function retentionCutoffTimestamp(retentionDays: number, now = new Date()): string {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

/**
 * This is intentionally fail-closed. A settings document with retention
 * toggled on but no valid duration must not create an indefinite raw-evidence
 * store.
 */
export async function requireEvidenceRetentionPolicy(): Promise<EvidenceRetentionPolicy> {
  const settings = await getSharedSettings();
  const retention = settings.value.evidenceRetention;
  if (!retention.enabled) {
    throw new GovernanceDataError(
      "Raw evidence retention is disabled by the shared administrator policy. No file bytes were accepted.",
      "evidence_retention_disabled",
      409,
    );
  }
  if (!Number.isInteger(retention.retentionDays) || !retention.retentionDays || retention.retentionDays < 1) {
    throw new GovernanceDataError(
      "Raw evidence retention is enabled without a valid expiry period. Ask an administrator to configure retention days.",
      "invalid_evidence_retention_policy",
      409,
    );
  }
  return { enabled: true, retentionDays: retention.retentionDays };
}

export function assertSupportedEvidenceUpload(contentType: string | null, size: number): string {
  const { contentType: normalized, maximumBytes: maximum } = getSupportedEvidenceContentType(contentType);
  if (!Number.isInteger(size) || size < 1 || size > maximum) {
    const maximumMb = maximum / (1024 * 1024);
    throw new GovernanceDataError(
      `Retained ${normalized.startsWith("image/") ? "image" : "report"} evidence must be between 1 byte and ${maximumMb} MB.`,
      "invalid_evidence_size",
      413,
    );
  }
  return normalized;
}

export function getSupportedEvidenceContentType(contentType: string | null): {
  contentType: string;
  maximumBytes: number;
} {
  const normalized = normaliseContentType(contentType);
  const maximumBytes = EVIDENCE_CONTENT_TYPE_LIMITS.get(normalized);
  if (!maximumBytes) {
    throw new GovernanceDataError(
      "Retained evidence must be an XLSX/XLS/XLSM/CSV report or a PNG/JPEG/WebP image.",
      "unsupported_evidence_type",
      415,
    );
  }
  return { contentType: normalized, maximumBytes };
}

function startsWithBytes(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

/**
 * Content-Type alone is caller-controlled. Verify inexpensive, non-executing
 * signatures before raw bytes are admitted to R2, while leaving workbook
 * parsing and all DLMS logic outside this storage boundary.
 */
function assertEvidenceSignature(contentType: string, bytes: ArrayBuffer): void {
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16));
  const isZip = startsWithBytes(header, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = startsWithBytes(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const isPng = startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = startsWithBytes(header, [0xff, 0xd8, 0xff]);
  const isWebp = startsWithBytes(header, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(header, [0x57, 0x45, 0x42, 0x50], 8);
  const isCsv = !header.includes(0);
  const valid =
    ((contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      contentType === "application/vnd.ms-excel.sheet.macroenabled.12") && isZip) ||
    (contentType === "application/vnd.ms-excel" && isOle) ||
    ((contentType === "text/csv" || contentType === "application/csv") && isCsv) ||
    (contentType === "image/png" && isPng) ||
    (contentType === "image/jpeg" && isJpeg) ||
    (contentType === "image/webp" && isWebp);
  if (!valid) {
    throw new GovernanceDataError(
      "Evidence bytes do not match the declared retained-evidence content type.",
      "invalid_evidence_signature",
      415,
    );
  }
}

export function assertSupportedLogoUpload(contentType: string | null, size: number): string {
  const normalized = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_LOGO_CONTENT_TYPES.has(normalized)) {
    throw new GovernanceDataError("Logo must be a PNG, JPEG, or WebP image.", "unsupported_logo_type");
  }
  if (size < 1 || size > MAX_LOGO_BYTES) {
    throw new GovernanceDataError("Logo must be between 1 byte and 2 MB.", "invalid_logo_size");
  }
  return normalized;
}

export async function uploadSharedLogo(
  actor: GovernanceActor,
  input: { bytes: ArrayBuffer; contentType: string; expectedSettingsVersion?: number },
): Promise<SettingsRecord> {
  const settings = await getSharedSettings();
  if (
    input.expectedSettingsVersion !== undefined &&
    input.expectedSettingsVersion !== settings.version
  ) {
    throw new GovernanceDataError(
      "Shared settings changed since the logo page was loaded. Reload before uploading.",
      "settings_conflict",
      409,
    );
  }
  const objectKey = `branding/logo/${crypto.randomUUID()}`;
  const previousObjectKey = settings.value.branding.logoObjectKey;
  const objectStore = getObjectStore();
  let metadataRecorded = false;
  let settingsSaved = false;
  try {
    await objectStore.put(objectKey, input.bytes, {
      httpMetadata: { contentType: input.contentType },
      customMetadata: { purpose: "shared-brand-logo" },
    });
    await recordStoredObject(actor, {
      objectKey,
      objectType: "branding_logo",
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      retained: true,
    });
    metadataRecorded = true;
    const nextSettings = {
      ...settings.value,
      branding: {
        ...settings.value.branding,
        logoObjectKey: objectKey,
        logoUrl: "/api/governance/logo",
        updatedAt: new Date().toISOString(),
      },
    };
    const saved = await updateSharedSettings(actor, nextSettings, settings.version, {
      allowBrandingObjectUpdate: true,
    });
    settingsSaved = true;
    await writeAuditEvent(actor, "branding.logo_uploaded", "branding", objectKey, {
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
    });

    if (previousObjectKey && previousObjectKey !== objectKey) {
      try {
        await objectStore.delete(previousObjectKey);
        await removeStoredObject(previousObjectKey);
      } catch {
        // The new logo remains valid. A stale prior logo can be removed by storage maintenance.
      }
    }
    return saved;
  } catch (error) {
    if (!settingsSaved) {
      try {
        await objectStore.delete(objectKey);
      } catch {
        // Preserve the original failure; cleanup can be retried separately.
      }
      if (metadataRecorded) {
        try {
          await removeStoredObject(objectKey);
        } catch {
          // Preserve the original failure; metadata cleanup can be retried separately.
        }
      }
    }
    throw error;
  }
}

export async function getSharedLogo(): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
} | null> {
  const settings = await getSharedSettings();
  const objectKey = settings.value.branding.logoObjectKey;
  if (!objectKey) return null;
  const object = await getObjectStore().get(objectKey);
  if (!object) return null;
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

/**
 * Delete a bounded page of R2 evidence that has reached the configured expiry
 * time. It is called before every retained upload and can also be invoked by
 * an administrator through the evidence endpoint. The immutable audit stream
 * keeps the retained and purge decisions after the operational metadata row
 * has been removed.
 */
export async function purgeRetainedEvidence(
  actor: GovernanceActor | null,
  input: { mode?: EvidencePurgeMode; limit?: number } = {},
): Promise<EvidencePurgeResult> {
  const mode = input.mode ?? "expired";
  const limit = Math.max(1, Math.min(MAX_EVIDENCE_PURGE_BATCH, Math.floor(input.limit ?? MAX_EVIDENCE_PURGE_BATCH)));
  const settings = await getSharedSettings();
  const retention = settings.value.evidenceRetention;

  if (mode === "expired" && (!retention.enabled || !Number.isInteger(retention.retentionDays) || !retention.retentionDays || retention.retentionDays < 1)) {
    return {
      mode,
      retentionDays: null,
      cutoffAt: null,
      attempted: 0,
      deleted: 0,
      remainingMayExist: false,
    };
  }

  const retentionDays = retention.enabled && Number.isInteger(retention.retentionDays)
    ? retention.retentionDays
    : null;
  const cutoffAt = mode === "expired" && retentionDays ? retentionCutoffTimestamp(retentionDays) : null;
  const statement = mode === "all"
    ? getD1().prepare(
      `SELECT object_key, content_type, size_bytes, case_ref, created_at
       FROM stored_objects
       WHERE object_type = 'evidence' AND retained = 1
       ORDER BY datetime(created_at) ASC, object_key ASC
       LIMIT ?`,
    ).bind(limit)
    : getD1().prepare(
      `SELECT object_key, content_type, size_bytes, case_ref, created_at
       FROM stored_objects
       WHERE object_type = 'evidence' AND retained = 1 AND datetime(created_at) <= datetime(?)
       ORDER BY datetime(created_at) ASC, object_key ASC
       LIMIT ?`,
    ).bind(cutoffAt, limit);
  const rows = (await statement.all<StoredEvidenceRow>()).results ?? [];

  let deleted = 0;
  for (const row of rows) {
    const objectKey = asDbText(row.object_key);
    if (!objectKey) {
      throw new GovernanceDataError("Stored evidence metadata is invalid.", "invalid_stored_evidence_metadata", 500);
    }
    await getObjectStore().delete(objectKey);
    await getD1().prepare(
      "DELETE FROM stored_objects WHERE object_key = ? AND object_type = 'evidence'",
    ).bind(objectKey).run();
    deleted += 1;
    await writeAuditEvent(actor, "evidence.purged", "stored_object", objectKey, {
      reason: mode === "all" ? "administrator_requested" : "retention_expired",
      retentionDays,
      cutoffAt,
      contentType: asDbText(row.content_type),
      sizeBytes: asDbNumber(row.size_bytes),
      caseRef: asDbText(row.case_ref),
      originallyStoredAt: asDbText(row.created_at),
    });
  }

  return {
    mode,
    retentionDays,
    cutoffAt,
    attempted: rows.length,
    deleted,
    // A full page can have another page behind it. The caller can repeat the
    // explicit admin purge; upload cleanup is deliberately bounded.
    remainingMayExist: rows.length === limit,
  };
}

/**
 * Server-side callers may use this for raw files only after an administrator
 * explicitly enables evidence retention. The run-summary API never accepts raw
 * evidence, so default execution remains non-retaining.
 */
export async function retainRawEvidenceIfEnabled(
  actor: GovernanceActor,
  input: { bytes: ArrayBuffer; contentType: string; caseRef?: string | null },
): Promise<{ retained: true; objectKey: string; retentionDays: number }> {
  // Re-check immediately before writing. The route does the same check before
  // it reads the request body, so a disabled policy accepts neither bytes nor
  // storage writes even when settings change during an upload.
  await requireEvidenceRetentionPolicy();
  const cleanup = await purgeRetainedEvidence(actor, { mode: "expired" });
  if (cleanup.remainingMayExist) {
    throw new GovernanceDataError(
      "Expired evidence cleanup needs another administrative purge before new raw evidence can be retained.",
      "evidence_retention_cleanup_required",
      503,
    );
  }
  const policy = await requireEvidenceRetentionPolicy();
  const contentType = assertSupportedEvidenceUpload(input.contentType, input.bytes.byteLength);
  assertEvidenceSignature(contentType, input.bytes);
  const caseRef = normaliseEvidenceCaseRef(input.caseRef);
  // Keep the object namespace independent from untrusted identity header text.
  const objectKey = `evidence/${crypto.randomUUID()}`;
  await getObjectStore().put(objectKey, input.bytes, {
    httpMetadata: { contentType },
    customMetadata: { purpose: "retained-evidence", retentionDays: String(policy.retentionDays) },
  });
  try {
    await recordStoredObject(actor, {
      objectKey,
      objectType: "evidence",
      contentType,
      sizeBytes: input.bytes.byteLength,
      retained: true,
      caseRef,
    });
    await writeAuditEvent(actor, "evidence.retained", "stored_object", objectKey, {
      caseRef,
      contentType,
      sizeBytes: input.bytes.byteLength,
      retentionDays: policy.retentionDays,
      expiresAfterDays: policy.retentionDays,
      scheduledExpiryAt: new Date(Date.now() + policy.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    });
    return {
      retained: true,
      objectKey,
      retentionDays: policy.retentionDays,
    };
  } catch (error) {
    try {
      await getObjectStore().delete(objectKey);
    } catch {
      // Preserve the original error; an orphaned object can be removed by maintenance.
    }
    throw error;
  }
}
