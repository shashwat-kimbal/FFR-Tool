"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  Download,
  FileJson,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { Card, SectionHead, Status } from "../components/ui";
import { complaintOptions } from "../lib/pilot-config";
import type { ProductFamily } from "../lib/pilot-types";
import type { RuleDefinition } from "../lib/dlms-analysis";
import { useSharedGovernance } from "../lib/use-shared-governance";

function normalise(text: unknown) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

const groups = [
  "Foundation",
  "Profile & data quality",
  "Events",
  "Complaint context",
] as const;

export default function RulesPage() {
  const shared = useSharedGovernance();
  const { bundle, canDraft, busyStage } = shared;
  const [selectedRuleId, setSelectedRuleId] = useState(
    bundle.rules[0]?.id ?? null,
  );
  const [expressionDrafts, setExpressionDrafts] = useState<
    Record<string, string>
  >({});

  const selectedRule =
    bundle.rules.find((rule) => rule.id === selectedRuleId) ??
    bundle.rules[0] ??
    null;
  const expressionDraft = selectedRule
    ? (expressionDrafts[selectedRule.id] ??
      JSON.stringify(selectedRule.expression, null, 2))
    : "";

  const setExpressionDraft = (value: string) => {
    if (!selectedRule) return;
    setExpressionDrafts((current) => ({
      ...current,
      [selectedRule.id]: value,
    }));
  };

  const applyExpression = () => {
    if (!selectedRule) return;
    try {
      const expression = JSON.parse(
        expressionDraft,
      ) as RuleDefinition["expression"];
      shared.updateRule(selectedRule.id, { expression });
      setExpressionDrafts((current) => {
        const next = { ...current };
        delete next[selectedRule.id];
        return next;
      });
      shared.setNotice(
        `${selectedRule.id} expression updated in this draft. Save the shared library to publish a new governed version.`,
      );
    } catch {
      shared.setNotice(
        "Rule expression must be valid JSON. The existing rule was not changed.",
      );
    }
  };

  const coverage = ["METER", "NIC", "GATEWAY"].map((family) => ({
    family,
    scopes: complaintOptions(family as ProductFamily).length,
  }));

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
              <BookOpenCheck size={22} />
            </div>
            <div>
              <span className="eyebrow">Shared modular rule library</span>
              <h1>Generic provisional DLMS bundle</h1>
              <p>
                {bundle.summary} Every rule says what it checks, why it ran,
                what it cannot prove, and the required next validation.
              </p>
            </div>
            <Status tone="warning">{bundle.lifecycle.toUpperCase()}</Status>
          </header>
          <Card>
            <SectionHead
              eyebrow="Coverage"
              title={`${bundle.rules.length} active definitions across all product families`}
              description="Each product family is scoped by shared data. A selected adapter is direct only after its governed definition and mapping are released; otherwise the report is explicitly contextual evidence."
              action={
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={shared.downloadBundle}
                  >
                    <Download size={15} /> Export bundle
                  </button>
                  {canDraft && (
                    <label className="button secondary">
                      <FileJson size={15} /> Import draft
                      <input
                        className="visually-hidden"
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) =>
                          shared.importBundle(event, setSelectedRuleId)
                        }
                      />
                    </label>
                  )}
                </div>
              }
            />
            <div className="rule-summary">
              {coverage.map((item) => (
                <div key={item.family}>
                  <strong>{item.scopes}</strong>
                  <span>{item.family} catalogue scopes</span>
                </div>
              ))}
              <div>
                <strong>
                  {bundle.rules.filter((rule) => rule.enabled).length}
                </strong>
                <span>enabled checks</span>
              </div>
            </div>
          </Card>
          <section className="rule-editor-layout">
            <Card>
              <SectionHead
                title="Rule coverage"
                description="Select a rule to inspect or edit it. Disabled rules are retained in the bundle and audit history, but do not run."
              />
              <div className="rule-list">
                {groups.map((group) => (
                  <div className="rule-group" key={group}>
                    <span className="eyebrow">{group}</span>
                    {bundle.rules
                      .filter((rule) => rule.group === group)
                      .map((rule) => (
                        <button
                          key={rule.id}
                          className={
                            rule.id === selectedRule?.id
                              ? "rule-list-item selected"
                              : "rule-list-item"
                          }
                          onClick={() => setSelectedRuleId(rule.id)}
                        >
                          <span>
                            <strong>{rule.title}</strong>
                            <small>
                              {rule.id} · {rule.complaintKeys.join(", ")}
                            </small>
                          </span>
                          <Status tone={rule.enabled ? "warning" : "neutral"}>
                            {rule.enabled ? "ENABLED" : "DISABLED"}
                          </Status>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </Card>
            {selectedRule && (
              <Card>
                <SectionHead
                  eyebrow="Selected rule"
                  title={selectedRule.id}
                  description="The fields below are data in the shared bundle, not hard-coded application behavior."
                  action={
                    canDraft ? (
                      <button
                        className="button primary"
                        disabled={busyStage === "saving"}
                        onClick={shared.saveRuleDraft}
                      >
                        <Save size={15} /> Create governed draft
                      </button>
                    ) : (
                      <Status tone="warning">AUTHOR ROLE REQUIRED</Status>
                    )
                  }
                />
                <div className="form-grid rule-editor-fields">
                  <label className="wide">
                    Rule title
                    <input
                      disabled={!canDraft}
                      value={selectedRule.title}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Severity
                    <select
                      disabled={!canDraft}
                      value={selectedRule.severity}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          severity: event.target
                            .value as RuleDefinition["severity"],
                        })
                      }
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="toggle">
                    <input
                      disabled={!canDraft}
                      type="checkbox"
                      checked={selectedRule.enabled}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          enabled: event.target.checked,
                        })
                      }
                    />{" "}
                    Enabled for future analyses
                  </label>
                  <label className="wide">
                    Why this rule runs
                    <textarea
                      disabled={!canDraft}
                      value={selectedRule.why}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          why: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    What it cannot prove
                    <textarea
                      disabled={!canDraft}
                      value={selectedRule.limitation}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          limitation: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    Required follow-up
                    <textarea
                      disabled={!canDraft}
                      value={selectedRule.followUp}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          followUp: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    Scope keys
                    <input
                      disabled={!canDraft}
                      value={selectedRule.complaintKeys.join(", ")}
                      onChange={(event) =>
                        shared.updateRule(selectedRule.id, {
                          complaintKeys: event.target.value
                            .split(",")
                            .map((value) => normalise(value))
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="rule-expression">
                  Rule expression (JSON)
                  <textarea
                    disabled={!canDraft}
                    value={expressionDraft}
                    onChange={(event) => setExpressionDraft(event.target.value)}
                  />
                  {canDraft && (
                    <button
                      className="button secondary"
                      onClick={applyExpression}
                    >
                      <SlidersHorizontal size={15} /> Apply expression
                    </button>
                  )}
                </label>
              </Card>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
