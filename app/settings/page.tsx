"use client";
/* Shared logo URLs and browser-uploaded previews cannot use the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Info, Save, SlidersHorizontal, Settings, Upload, X } from "lucide-react";
import { Card, SectionHead, Status } from "../components/ui";
import { productFamilyOptions } from "../lib/pilot-config";
import type { ProductFamily } from "../lib/pilot-types";
import {
  catalogueDraftTemplate,
  useSharedGovernance,
  type CatalogueEditorKind,
} from "../lib/use-shared-governance";

function normalise(text: unknown) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export default function SettingsPage() {
  const shared = useSharedGovernance();
  const { settings, setSettings, profile, governance, isAdmin, canDraft, busyStage } =
    shared;

  const [mappingValue, setMappingValue] = useState("");
  const [mappingField, setMappingField] = useState<
    "Meter type" | "Old_Meter_Type"
  >("Old_Meter_Type");
  const [mappingFamily, setMappingFamily] = useState<ProductFamily>("METER");
  const [complaintFamily, setComplaintFamily] =
    useState<ProductFamily>("METER");
  const [complaintPhrases, setComplaintPhrases] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("");
  const [complaintSubcategory, setComplaintSubcategory] = useState("");
  const [complaintReason, setComplaintReason] = useState("");
  const [adapterFamily, setAdapterFamily] = useState<ProductFamily>("METER");
  const [adapterKey, setAdapterKey] = useState("bcs-16-sheet-v1");
  const [adapterMode, setAdapterMode] = useState<"direct" | "context_only">(
    "direct",
  );
  const [adapterDescription, setAdapterDescription] = useState("");
  const [catalogueEditorKind, setCatalogueEditorKind] =
    useState<CatalogueEditorKind>("adapter");
  const [catalogueEditorJson, setCatalogueEditorJson] = useState(() =>
    JSON.stringify(catalogueDraftTemplate("adapter"), null, 2),
  );

  const updateProfileParameter = (key: string, value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    shared.setProfile((current) => ({
      ...current,
      parameters: { ...current.parameters, [key]: numeric },
    }));
  };

  const addMapping = () => {
    if (!mappingValue.trim()) {
      shared.setNotice("Enter the exact FFR value before adding a mapping.");
      return;
    }
    setSettings((current) => ({
      ...current,
      productMappings: [
        ...current.productMappings,
        {
          id: `mapping-${Date.now()}`,
          sourceField: mappingField,
          sourceValue: mappingValue.trim(),
          productFamily: mappingFamily,
          basis: "Shared configuration draft",
        },
      ],
    }));
    setMappingValue("");
  };

  const addComplaintMapping = () => {
    const phrases = complaintPhrases
      .split(",")
      .map((phrase) => normalise(phrase))
      .filter(Boolean);
    if (!phrases.length || !complaintCategory.trim()) {
      shared.setNotice(
        "Add at least one exact complaint phrase and a catalogue category code.",
      );
      return;
    }
    setSettings((current) => ({
      ...current,
      complaintMappings: [
        ...current.complaintMappings,
        {
          id: `complaint-${Date.now()}`,
          productFamily: complaintFamily,
          phrases,
          categoryCode: complaintCategory.trim().toUpperCase(),
          subcategoryCode: complaintSubcategory.trim().toUpperCase() || null,
          reason: complaintReason.trim() || "Shared mapping draft",
        },
      ],
    }));
    setComplaintPhrases("");
    setComplaintCategory("");
    setComplaintSubcategory("");
    setComplaintReason("");
  };

  const addAdapterMapping = () => {
    if (!adapterKey.trim() || !adapterDescription.trim()) {
      shared.setNotice(
        "Provide an adapter key and explain what the mapping can and cannot establish.",
      );
      return;
    }
    setSettings((current) => ({
      ...current,
      adapterMappings: [
        ...current.adapterMappings.filter(
          (mapping) => mapping.productFamily !== adapterFamily,
        ),
        {
          id: `adapter-${Date.now()}`,
          productFamily: adapterFamily,
          adapterId: adapterKey.trim(),
          evidenceMode: adapterMode,
          description: adapterDescription.trim(),
        },
      ],
    }));
    setAdapterDescription("");
  };

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
              <Settings size={22} />
            </div>
            <div>
              <span className="eyebrow">Shared app settings</span>
              <h1>Profiles, mappings, and branding</h1>
              <p>
                These configuration values are read by the generic
                evaluator. Change a profile or mapping here, save a governed
                version, then re-run the same report to see the effect.
              </p>
            </div>
            {isAdmin ? (
              <button
                className="button primary"
                disabled={busyStage === "saving"}
                onClick={shared.saveSharedConfiguration}
              >
                <Save size={15} /> Save shared settings
              </button>
            ) : (
              <Status tone="warning">VIEW ONLY</Status>
            )}
          </header>
          <div className="callout neutral">
            <Info size={19} />
            <div>
              <strong>
                {governance.mode === "ready"
                  ? "Shared configuration loaded"
                  : "Shared configuration setup required"}
              </strong>
              <p>{governance.message}</p>
            </div>
          </div>
          <section className="settings-grid">
            <Card>
              <SectionHead
                eyebrow="Branding"
                title="Upload the Kimbal logo"
                description="The approved logo is stored in shared object storage and referenced from shared settings."
              />
              <div className="logo-setting">
                <div className="logo-preview">
                  {settings.branding.logoDataUrl ? (
                    <img
                      src={settings.branding.logoDataUrl}
                      alt="Uploaded organisation logo"
                    />
                  ) : (
                    <span>No logo uploaded</span>
                  )}
                </div>
                <div>
                  <label className="button secondary">
                    {" "}
                    <Upload size={15} /> Upload logo
                    <input
                      className="visually-hidden"
                      disabled={!isAdmin}
                      type="file"
                      accept=".svg,.png,.jpg,.jpeg,.webp"
                      onChange={shared.handleLogoUpload}
                    />
                  </label>
                  {settings.branding.logoFileName && (
                    <small>{settings.branding.logoFileName}</small>
                  )}
                </div>
              </div>
            </Card>
            <Card>
              <SectionHead
                eyebrow="Retention and access"
                title="Pilot configuration"
              />
              <div className="form-grid">
                <label>
                  Retention policy (days)
                  <input
                    disabled={!isAdmin}
                    type="number"
                    min="0"
                    value={settings.retentionDays}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        retentionDays: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Upload limit (MB)
                  <input
                    disabled={!isAdmin}
                    type="number"
                    min="1"
                    value={settings.uploadMaxMb}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        uploadMaxMb: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="wide">
                  Named role reference
                  <input
                    disabled={!isAdmin}
                    value={settings.pilotAccess.approvedRoles.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        pilotAccess: {
                          ...current.pilotAccess,
                          approvedRoles: event.target.value
                            .split(",")
                            .map((item) => normalise(item))
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <p className="helper-text">
                Raw evidence remains off by default. A retention value is a
                configuration preference; server-side retention is only
                enabled by an administrator.
              </p>
            </Card>
          </section>
          <Card>
            <SectionHead
              eyebrow="Provisional profile"
              title={profile.title}
              description="Meter configuration values take precedence when present; these fields are transparent editable fallbacks. All changes are configuration data, not application code."
              action={
                <Status tone="warning">{profile.status.toUpperCase()}</Status>
              }
            />
            <div className="parameter-grid">
              {Object.entries(profile.parameters)
                .filter(
                  ([key]) =>
                    !key.endsWith("_lower_v") && !key.endsWith("_upper_v"),
                )
                .map(([key, value]) => (
                  <label key={key}>
                    <span>
                      <strong>{key.replaceAll("_", " ")}</strong>
                      <small>
                        {profile.descriptions[key] ??
                          "Derived profile parameter"}
                      </small>
                    </span>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      step="any"
                      value={value}
                      onChange={(event) =>
                        updateProfileParameter(key, event.target.value)
                      }
                    />
                  </label>
                ))}
            </div>
            <p className="helper-text">
              Effective voltage bands are derived from nominal voltage plus
              the configured warning/critical percentages. If
              MeterConfiguration supplies a usable nominal voltage, it
              overrides the fallback for that run.
            </p>
          </Card>
          <Card>
            <SectionHead
              eyebrow="Product-family mapping"
              title="Map actual FFR values to Meter, NIC, or Gateway"
              description="Unmapped cases remain unresolved; no AI or free-text inference selects a product family."
            />
            <div className="mapping-list">
              {settings.productMappings.map((mapping) => (
                <div key={mapping.id}>
                  <span>
                    <strong>{mapping.sourceField}</strong>
                    <small>{mapping.basis}</small>
                  </span>
                  <strong>{mapping.sourceValue}</strong>
                  <Status tone="good">{mapping.productFamily}</Status>
                  {isAdmin && (
                    <button
                      aria-label={`Remove ${mapping.sourceValue} mapping`}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          productMappings: current.productMappings.filter(
                            (item) => item.id !== mapping.id,
                          ),
                        }))
                      }
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="inline-form">
                <select
                  value={mappingField}
                  onChange={(event) =>
                    setMappingField(
                      event.target.value as "Meter type" | "Old_Meter_Type",
                    )
                  }
                >
                  <option>Old_Meter_Type</option>
                  <option>Meter type</option>
                </select>
                <input
                  value={mappingValue}
                  onChange={(event) => setMappingValue(event.target.value)}
                  placeholder="Exact FFR value"
                />
                <select
                  value={mappingFamily}
                  onChange={(event) =>
                    setMappingFamily(event.target.value as ProductFamily)
                  }
                >
                  {productFamilyOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button className="button secondary" onClick={addMapping}>
                  <SlidersHorizontal size={15} /> Add mapping
                </button>
              </div>
            )}
          </Card>
          <Card>
            <SectionHead
              eyebrow="Complaint mapping"
              title="Map exact FFR complaint wording"
              description="These mappings control the product-family complaint scope. They never infer an unlisted subcategory and are saved as shared configuration."
            />
            <div className="mapping-list">
              {settings.complaintMappings.map((mapping) => (
                <div key={mapping.id}>
                  <span>
                    <strong>
                      {mapping.productFamily}:{mapping.categoryCode}
                      {mapping.subcategoryCode
                        ? `:${mapping.subcategoryCode}`
                        : ""}
                    </strong>
                    <small>{mapping.reason}</small>
                  </span>
                  <strong>{mapping.phrases.join(" · ")}</strong>
                  {isAdmin && (
                    <button
                      aria-label={`Remove ${mapping.phrases[0] ?? "complaint"} complaint mapping`}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          complaintMappings: current.complaintMappings.filter(
                            (item) => item.id !== mapping.id,
                          ),
                        }))
                      }
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="inline-form">
                <select
                  value={complaintFamily}
                  onChange={(event) =>
                    setComplaintFamily(event.target.value as ProductFamily)
                  }
                >
                  {productFamilyOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={complaintPhrases}
                  onChange={(event) => setComplaintPhrases(event.target.value)}
                  placeholder="Exact phrase(s), comma-separated"
                />
                <input
                  value={complaintCategory}
                  onChange={(event) =>
                    setComplaintCategory(event.target.value)
                  }
                  placeholder="Category code"
                />
                <input
                  value={complaintSubcategory}
                  onChange={(event) =>
                    setComplaintSubcategory(event.target.value)
                  }
                  placeholder="Subcategory (optional)"
                />
                <input
                  value={complaintReason}
                  onChange={(event) => setComplaintReason(event.target.value)}
                  placeholder="Why this mapping is permitted"
                />
                <button
                  className="button secondary"
                  onClick={addComplaintMapping}
                >
                  <SlidersHorizontal size={15} /> Add mapping
                </button>
              </div>
            )}
          </Card>
          <Card>
            <SectionHead
              eyebrow="Adapter mapping"
              title="Declare direct versus contextual evidence"
              description="NIC and Gateway retain the Meter report as contextual evidence until an approved dedicated adapter is mapped. A direct mapping does not remove device/manual verification requirements from physical-condition complaints."
            />
            <div className="mapping-list">
              {settings.adapterMappings.map((mapping) => (
                <div key={mapping.id}>
                  <span>
                    <strong>{mapping.productFamily}</strong>
                    <small>{mapping.description}</small>
                  </span>
                  <strong>{mapping.adapterId}</strong>
                  <Status
                    tone={mapping.evidenceMode === "direct" ? "good" : "warning"}
                  >
                    {mapping.evidenceMode === "direct"
                      ? "DIRECT"
                      : "CONTEXT ONLY"}
                  </Status>
                  {isAdmin && (
                    <button
                      aria-label={`Remove ${mapping.productFamily} adapter mapping`}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          adapterMappings: current.adapterMappings.filter(
                            (item) => item.id !== mapping.id,
                          ),
                        }))
                      }
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="inline-form">
                <select
                  value={adapterFamily}
                  onChange={(event) =>
                    setAdapterFamily(event.target.value as ProductFamily)
                  }
                >
                  {productFamilyOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={adapterKey}
                  onChange={(event) => setAdapterKey(event.target.value)}
                  placeholder="Adapter key"
                />
                <select
                  value={adapterMode}
                  onChange={(event) =>
                    setAdapterMode(
                      event.target.value as "direct" | "context_only",
                    )
                  }
                >
                  <option value="direct">Direct evidence</option>
                  <option value="context_only">Context only</option>
                </select>
                <input
                  value={adapterDescription}
                  onChange={(event) =>
                    setAdapterDescription(event.target.value)
                  }
                  placeholder="Evidence boundary and verification requirement"
                />
                <button
                  className="button secondary"
                  onClick={addAdapterMapping}
                >
                  <SlidersHorizontal size={15} /> Save mapping
                </button>
              </div>
            )}
          </Card>
          <Card>
            <SectionHead
              eyebrow="Adapter and feature definitions"
              title="Create an editable parsing catalogue draft"
              description="Use this controlled JSON editor for sheet/header mappings and derived features. An adapter remains contextual until its own reviewed version is released and a direct product-family mapping explicitly selects it."
              action={
                <Status tone={canDraft ? "good" : "warning"}>
                  {canDraft ? "AUTHOR DRAFTS ENABLED" : "VIEW ONLY"}
                </Status>
              }
            />
            <div className="inline-form">
              <select
                disabled={!canDraft}
                value={catalogueEditorKind}
                onChange={(event) => {
                  const next = event.target.value as CatalogueEditorKind;
                  setCatalogueEditorKind(next);
                  setCatalogueEditorJson(
                    JSON.stringify(catalogueDraftTemplate(next), null, 2),
                  );
                }}
              >
                <option value="adapter">Adapter definition</option>
                <option value="feature">Feature definition</option>
              </select>
              <button
                className="button secondary"
                disabled={!canDraft || busyStage === "saving"}
                onClick={() =>
                  void shared.saveCatalogueDefinitionDraft(
                    catalogueEditorKind,
                    catalogueEditorJson,
                  )
                }
              >
                <Save size={15} /> Create governed draft
              </button>
            </div>
            <label className="rule-expression">
              {catalogueEditorKind === "adapter"
                ? "Adapter definition JSON"
                : "Feature definition JSON"}
              <textarea
                disabled={!canDraft}
                value={catalogueEditorJson}
                onChange={(event) => setCatalogueEditorJson(event.target.value)}
              />
            </label>
            <p className="helper-text">
              The seed is a template, not fixed application logic. Edit it,
              submit it for independent review in Governance, release it,
              then save the corresponding direct/context-only mapping above.
            </p>
          </Card>
          <Card>
            <SectionHead
              eyebrow="AI provider"
              title="Provider and model references"
              description="Credentials are never entered or stored in the browser. A deployment administrator configures secret references separately; these fields document the configured provider and model choice."
            />
            <div className="form-grid">
              <label>
                Provider
                <input
                  disabled={!isAdmin}
                  value={settings.ai.provider}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ai: { ...current.ai, provider: event.target.value },
                    }))
                  }
                  placeholder="Not configured"
                />
              </label>
              <label>
                Reasoning model
                <input
                  disabled={!isAdmin}
                  value={settings.ai.reasoningModel}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ai: { ...current.ai, reasoningModel: event.target.value },
                    }))
                  }
                  placeholder="Not configured"
                />
              </label>
              <label>
                Vision model
                <input
                  disabled={!isAdmin}
                  value={settings.ai.visionModel}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ai: { ...current.ai, visionModel: event.target.value },
                    }))
                  }
                  placeholder="Not configured"
                />
              </label>
              <label>
                Credential reference
                <input
                  disabled={!isAdmin}
                  value={settings.ai.credentialReference}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ai: {
                        ...current.ai,
                        credentialReference: event.target.value,
                      },
                    }))
                  }
                  placeholder="Server-side secret reference only"
                />
              </label>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
