"use client";

import {
  Database,
  FileJson,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Card, SectionHead, Status } from "../components/ui";
import { useSharedGovernance } from "../lib/use-shared-governance";

const readinessChecklist = [
  [
    "Readiness checklist",
    "Rule bundle input is governed: RULE_BUNDLE_INPUT_REQUIRED applies until an administrator configures named access and a reviewed version is released.",
  ],
  [
    "Identity and evidence",
    "FFR case matching remains mandatory before case-specific findings, RCA, CAPA, or workbook write-back. Technical DLMS checks still run for a mismatched report.",
  ],
  [
    "Shared governance",
    "Named admins publish shared bundles and profiles; authors draft and reviewers approve. Browser storage is never authoritative.",
  ],
  [
    "Provisional guardrail",
    "The initial 60 checks create review-required findings only. They never create an approved RCA/CAPA or prove a physical root cause.",
  ],
  [
    "Retention",
    "Raw workbooks and images are not retained by default. An admin must explicitly enable a retention policy before evidence bytes are stored.",
  ],
] as const;

export default function GovernancePage() {
  const shared = useSharedGovernance();
  const {
    governance,
    canDraft,
    canReview,
    canPublish,
    busyStage,
    catalogueDraft,
    catalogueRollbackVersion,
    auditEvents,
    roleEmail,
    roleToAssign,
    roleAssignments,
    rollbackVersion,
  } = shared;
  const draft = governance.draftBundle;
  const active = governance.activeBundle;

  return (
    <>
      <header className="topbar">
        <div>
          <span>Private pilot workspace</span>
          <strong>Staged evidence and governed rules</strong>
        </div>
      </header>
      <div className="content">
        <div className="page-stack">
          <header className="page-header">
            <div className="page-symbol">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="eyebrow">Governed release controls</span>
              <h1>Readiness and audit policy</h1>
              <p>
                The shared library replaces browser-local activation. It
                keeps drafts, review, provisional release, approval,
                retirement, and historical version references separate.
              </p>
            </div>
            <Status tone={governance.mode === "ready" ? "good" : "warning"}>
              {governance.mode === "ready" ? "CONNECTED" : "SETUP REQUIRED"}
            </Status>
          </header>
          <Card>
            <SectionHead
              title="Shared governance status"
              description={governance.message}
              action={
                <button
                  className="button secondary"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={15} /> Refresh connection
                </button>
              }
            />
            <div className="guard-grid">
              <div>
                <Database size={19} />
                <strong>D1 shared state</strong>
                <span>
                  Settings, bundles, roles, run summaries, fixtures metadata,
                  and audit events are server-owned.
                </span>
              </div>
              <div>
                <LockKeyhole size={19} />
                <strong>Named-admin publishing</strong>
                <span>
                  Only the server-recognized admin role can modify shared
                  settings or create bundle versions.
                </span>
              </div>
              <div>
                <ShieldCheck size={19} />
                <strong>Provisional output gate</strong>
                <span>
                  Initial findings are always review-required and never
                  create approved RCA/CAPA text.
                </span>
              </div>
            </div>
          </Card>
          <div className="readiness-grid">
            {readinessChecklist.map(([title, detail], index) => (
              <Card key={title} className="readiness-card">
                <SectionHead
                  eyebrow={`Control ${index + 1}`}
                  title={title}
                  description={detail}
                />
              </Card>
            ))}
          </div>
          <Card>
            <SectionHead
              eyebrow="Shared release workflow"
              title="Draft, review, release, and rollback"
              description="Published versions are immutable. A person who drafted a version cannot approve the same version, and only a named administrator can release or roll it back."
              action={
                <Status tone={active ? "good" : "warning"}>
                  {active ? `ACTIVE V${active.version}` : "FALLBACK ONLY"}
                </Status>
              }
            />
            <div className="data-list">
              <div>
                <dt>Your server role</dt>
                <dd>{governance.role ?? "Not connected"}</dd>
              </div>
              <div>
                <dt>Active bundle</dt>
                <dd>
                  {active
                    ? `${active.bundleId} v${active.version} (${active.lifecycle})`
                    : "No shared release — generic provisional fallback"}
                </dd>
              </div>
              <div>
                <dt>Active profile</dt>
                <dd>
                  {governance.activeProfile
                    ? `${governance.activeProfile.profileKey} v${governance.activeProfile.version}`
                    : "Labelled provisional fallback"}
                </dd>
              </div>
              <div>
                <dt>Active adapters / features</dt>
                <dd>
                  {governance.adapterCount ?? 0} adapters ·{" "}
                  {governance.featureCount ?? 0} features
                </dd>
              </div>
              <div>
                <dt>Current draft</dt>
                <dd>
                  {draft
                    ? `${draft.bundleId} v${draft.version} (${draft.lifecycle})`
                    : "None"}
                </dd>
              </div>
            </div>
            <div className="button-row">
              {canDraft && (
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={shared.saveRuleDraft}
                >
                  <Save size={15} /> Create draft from working bundle
                </button>
              )}
              {canDraft && (
                <label className="button secondary">
                  <FileJson size={15} /> Import draft bundle
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => shared.importBundle(event)}
                  />
                </label>
              )}
              {canDraft && draft?.lifecycle === "draft" && (
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={() => void shared.transitionDraft("in_review")}
                >
                  Submit for review
                </button>
              )}
              {canReview && draft?.lifecycle === "in_review" && (
                <>
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() =>
                      void shared.transitionDraft("provisional_active")
                    }
                  >
                    Approve provisional
                  </button>
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() =>
                      void shared.transitionDraft("approved_active")
                    }
                  >
                    Approve active
                  </button>
                </>
              )}
              {canPublish &&
                (draft?.lifecycle === "provisional_active" ||
                  draft?.lifecycle === "approved_active") && (
                  <button
                    className="button primary"
                    disabled={busyStage === "saving"}
                    onClick={shared.publishDraft}
                  >
                    <ShieldCheck size={15} /> Release shared version
                  </button>
                )}
            </div>
            {canPublish && active && (
              <div className="inline-form">
                <input
                  type="number"
                  min="1"
                  value={rollbackVersion}
                  onChange={(event) =>
                    shared.setRollbackVersion(event.target.value)
                  }
                  placeholder="Reviewed version number"
                />
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={shared.rollbackRuleBundle}
                >
                  <RefreshCw size={15} /> Roll back to version
                </button>
                <button
                  className="button secondary"
                  onClick={shared.refreshAuditEvents}
                >
                  <ListChecks size={15} /> Refresh audit
                </button>
              </div>
            )}
          </Card>
          {catalogueDraft && (
            <Card>
              <SectionHead
                eyebrow="Profile, adapter, or feature workflow"
                title={`Governed ${catalogueDraft.entityType} version`}
                description="Catalogue definitions are immutable once reviewed. Publishing changes only the shared server projection; it never changes a historical run record."
                action={
                  <Status
                    tone={
                      catalogueDraft.lifecycle === "draft" ||
                      catalogueDraft.lifecycle === "in_review"
                        ? "warning"
                        : "good"
                    }
                  >
                    {catalogueDraft.lifecycle.toUpperCase()}
                  </Status>
                }
              />
              <div className="data-list">
                <div>
                  <dt>Entity</dt>
                  <dd>{catalogueDraft.entityType}</dd>
                </div>
                <div>
                  <dt>Key</dt>
                  <dd>{catalogueDraft.entityKey}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>v{catalogueDraft.version}</dd>
                </div>
                <div>
                  <dt>Lifecycle</dt>
                  <dd>{catalogueDraft.lifecycle}</dd>
                </div>
              </div>
              <div className="button-row">
                {canDraft && catalogueDraft.lifecycle === "draft" && (
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() =>
                      void shared.transitionCatalogueDraft("in_review")
                    }
                  >
                    Submit for review
                  </button>
                )}
                {canReview && catalogueDraft.lifecycle === "in_review" && (
                  <>
                    <button
                      className="button secondary"
                      disabled={busyStage === "saving"}
                      onClick={() =>
                        void shared.transitionCatalogueDraft(
                          "provisional_active",
                        )
                      }
                    >
                      Approve provisional
                    </button>
                    <button
                      className="button secondary"
                      disabled={busyStage === "saving"}
                      onClick={() =>
                        void shared.transitionCatalogueDraft("approved_active")
                      }
                    >
                      Approve active
                    </button>
                  </>
                )}
                {canPublish &&
                  (catalogueDraft.lifecycle === "provisional_active" ||
                    catalogueDraft.lifecycle === "approved_active") && (
                    <button
                      className="button primary"
                      disabled={busyStage === "saving"}
                      onClick={() => void shared.publishCatalogueDraft()}
                    >
                      <ShieldCheck size={15} /> Release shared version
                    </button>
                  )}
              </div>
              {canPublish && (
                <div className="inline-form">
                  <input
                    type="number"
                    min="1"
                    value={catalogueRollbackVersion}
                    onChange={(event) =>
                      shared.setCatalogueRollbackVersion(event.target.value)
                    }
                    placeholder="Reviewed catalogue version"
                  />
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() => void shared.rollbackCatalogueDraft()}
                  >
                    <RefreshCw size={15} /> Roll back catalogue
                  </button>
                </div>
              )}
            </Card>
          )}
          {canPublish && auditEvents.length > 0 && (
            <Card>
              <SectionHead
                eyebrow="Audit history"
                title="Latest governed actions"
              />
              <div className="mapping-list">
                {auditEvents.map((event) => (
                  <div key={event.id}>
                    <span>
                      <strong>{event.action}</strong>
                      <small>
                        {event.entityType} · {event.entityId}
                      </small>
                    </span>
                    <small>{event.createdAt}</small>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {canPublish && (
            <Card>
              <SectionHead
                eyebrow="Role assignments"
                title="Author and reviewer access"
                description="Administrators are server-allowlisted outside the app. Assign only author, reviewer, or user roles here."
                action={
                  <button
                    className="button secondary"
                    onClick={shared.refreshRoleAssignments}
                  >
                    <RefreshCw size={15} /> Refresh roles
                  </button>
                }
              />
              <div className="inline-form">
                <input
                  type="email"
                  value={roleEmail}
                  onChange={(event) => shared.setRoleEmail(event.target.value)}
                  placeholder="team.member@example.com"
                />
                <select
                  value={roleToAssign}
                  onChange={(event) =>
                    shared.setRoleToAssign(
                      event.target.value as "author" | "reviewer" | "user",
                    )
                  }
                >
                  <option value="author">Author</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="user">User</option>
                </select>
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={shared.assignRole}
                >
                  <ShieldCheck size={15} /> Assign role
                </button>
              </div>
              {roleAssignments.length > 0 && (
                <div className="mapping-list">
                  {roleAssignments.map((assignment) => (
                    <div key={assignment.id}>
                      <strong>{assignment.email}</strong>
                      <Status tone={assignment.enabled ? "good" : "neutral"}>
                        {assignment.role.toUpperCase()}
                      </Status>
                      <small>
                        {assignment.enabled ? "Enabled" : "Disabled"}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          <Card>
            <SectionHead
              eyebrow="Access boundary"
              title="Named server roles"
              description="The pilot-role text in Settings is descriptive only. Administrators assign author and reviewer access through the server-side role controls; administrator access itself comes only from the deployment allowlist."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
