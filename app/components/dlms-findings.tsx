"use client";

import { RefreshCw } from "lucide-react";
import type { DlmsAnalysis, DlmsFinding } from "@/server/rules/dlms-analysis";
import { Card, SectionHead, Status } from "./ui";

export type FindingFilter = "all" | "attention" | "not_assessed";

function findingTone(finding: DlmsFinding) {
  if (finding.status === "attention" && finding.severity === "high")
    return "danger" as const;
  if (finding.status === "attention") return "warning" as const;
  if (finding.status === "pass") return "good" as const;
  return "neutral" as const;
}

const groups = [
  "Foundation",
  "Profile & data quality",
  "Events",
  "Complaint context",
] as const;

export function DlmsFindingsPanel({
  analysis,
  findingFilter,
  setFindingFilter,
  onRerun,
  rerunDisabled,
}: {
  analysis: DlmsAnalysis;
  findingFilter: FindingFilter;
  setFindingFilter: (filter: FindingFilter) => void;
  onRerun?: () => void;
  rerunDisabled?: boolean;
}) {
  const visible = analysis.findings.filter(
    (finding) => findingFilter === "all" || finding.status === findingFilter,
  );
  return (
    <Card className="technical-analysis">
      <SectionHead
        eyebrow="3. Technical DLMS analysis"
        title={`${analysis.summary.total} provisional checks ran`}
        description="Every result is source-linked and review-required. A technical finding can be shown for an identity mismatch, but no case-specific conclusion is created until the exact FFR meter and product mapping are valid."
        action={
          <div className="button-row">
            {onRerun && (
              <button
                className="button secondary"
                disabled={rerunDisabled}
                onClick={onRerun}
              >
                <RefreshCw size={15} className={rerunDisabled ? "spin" : ""} />{" "}
                Re-run with current profile
              </button>
            )}
            <Status tone="warning">PROVISIONAL FINDING</Status>
          </div>
        }
      />
      <div className="rule-summary">
        <div>
          <strong>{analysis.summary.total}</strong>
          <span>checks run</span>
        </div>
        <div>
          <strong>{analysis.summary.attention}</strong>
          <span>need review</span>
        </div>
        <div>
          <strong>{analysis.summary.high}</strong>
          <span>high context signals</span>
        </div>
        <div>
          <strong>{analysis.summary.notAssessed}</strong>
          <span>evidence gaps</span>
        </div>
      </div>
      <div className="filter-row" aria-label="Filter technical findings">
        <button
          className={findingFilter === "all" ? "selected" : ""}
          onClick={() => setFindingFilter("all")}
        >
          All {analysis.summary.total}
        </button>
        <button
          className={findingFilter === "attention" ? "selected" : ""}
          onClick={() => setFindingFilter("attention")}
        >
          Needs review {analysis.summary.attention}
        </button>
        <button
          className={findingFilter === "not_assessed" ? "selected" : ""}
          onClick={() => setFindingFilter("not_assessed")}
        >
          Evidence gaps {analysis.summary.notAssessed}
        </button>
      </div>
      <div className="finding-list">
        {groups.map((group) => {
          const findings = visible.filter((finding) => finding.group === group);
          if (!findings.length) return null;
          return (
            <details
              className="finding-group"
              key={group}
              open={findingFilter !== "all" || group === "Foundation"}
            >
              <summary>
                <span>
                  <strong>{group}</strong>
                  <small>
                    {
                      analysis.findings.filter(
                        (finding) => finding.group === group,
                      ).length
                    }{" "}
                    configured checks
                  </small>
                </span>
                <span>
                  {
                    findings.filter((finding) => finding.status === "attention")
                      .length
                  }{" "}
                  need review
                </span>
              </summary>
              {findings.map((finding) => (
                <details
                  className={`finding-row finding-${finding.status}`}
                  key={finding.id}
                >
                  <summary>
                    <Status tone={findingTone(finding)}>
                      {finding.status === "attention"
                        ? finding.severity === "high"
                          ? "HIGH REVIEW"
                          : "REVIEW"
                        : finding.status === "pass"
                          ? "CHECK PASSED"
                          : "NOT ASSESSED"}
                    </Status>
                    <span>
                      <strong>{finding.title}</strong>
                      <small>
                        {finding.id} · {finding.actual}
                      </small>
                    </span>
                  </summary>
                  <dl>
                    <div>
                      <dt>Threshold / rule</dt>
                      <dd>{finding.threshold}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>
                        {finding.sources
                          .map((item) => `${item.sheet}: ${item.locator}`)
                          .join("; ") || "Required evidence unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Why it ran</dt>
                      <dd>{finding.why}</dd>
                    </div>
                    <div>
                      <dt>What it cannot prove</dt>
                      <dd>{finding.limitation}</dd>
                    </div>
                    <div>
                      <dt>Required follow-up</dt>
                      <dd>{finding.followUp}</dd>
                    </div>
                  </dl>
                </details>
              ))}
            </details>
          );
        })}
      </div>
    </Card>
  );
}
