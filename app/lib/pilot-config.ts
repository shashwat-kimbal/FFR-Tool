import productMap from "../../rules/catalogues/product-family-map.v1.json";
import issueCatalogue from "../../rules/catalogues/customer-issue-catalogue.v1.json";
import complaintSynonyms from "../../rules/catalogues/complaint-synonyms.v1.json";
import adapterMappings from "../../config/adapter-mappings.v1.json";
import workbookContract from "../../config/pilot-workbook-contract.v1.json";
import configurationDefaults from "../../config/pilot-configuration-defaults.v1.json";
import diagnosticRuleTemplate from "../../config/diagnostic-rule-template.v1.json";
import caseDisplay from "../../config/ffr-case-display.v1.json";
import type { AdapterMapping, AppSettings, ComplaintMapping, DiagnosticRule, ProductFamily } from "./pilot-types";

export const pilotContract = workbookContract;

const configuredComplaintMappings = complaintSynonyms.mappings as Array<{
  productFamily: ProductFamily;
  phrases: string[];
  classification: { categoryCode: string; subcategoryCode: string | null };
  reason: string;
}>;

const configuredAdapterMappings = adapterMappings.mappings as Array<{
  productFamily: ProductFamily;
  adapterId: string;
  evidenceMode: AdapterMapping["evidenceMode"];
  description: string;
}>;

export const defaultComplaintMappings: ComplaintMapping[] = configuredComplaintMappings.map((mapping, index) => ({
  id: `complaint-${index + 1}`,
  productFamily: mapping.productFamily,
  phrases: [...mapping.phrases],
  categoryCode: mapping.classification.categoryCode,
  subcategoryCode: mapping.classification.subcategoryCode,
  reason: mapping.reason,
}));

export const defaultAdapterMappings: AdapterMapping[] = configuredAdapterMappings.map((mapping, index) => ({
  id: `adapter-${index + 1}`,
  ...mapping,
}));

export const defaultSettings: AppSettings = {
  productMappings: productMap.mappings.map((mapping, index) => ({
    id: `mapping-${index + 1}`,
    sourceField: mapping.sourceField as "Meter type" | "Old_Meter_Type",
    sourceValue: mapping.sourceValue,
    productFamily: mapping.productFamily as ProductFamily,
    basis: mapping.basis,
  })),
  complaintMappings: defaultComplaintMappings.map((mapping) => ({ ...mapping, phrases: [...mapping.phrases] })),
  adapterMappings: defaultAdapterMappings.map((mapping) => ({ ...mapping })),
  retentionDays: configurationDefaults.retentionDays,
  uploadMaxMb: configurationDefaults.uploadMaxMb,
  ai: { ...configurationDefaults.ai },
  pilotAccess: { ...configurationDefaults.pilotAccess, approvedRoles: [...configurationDefaults.pilotAccess.approvedRoles] },
  branding: { ...configurationDefaults.branding },
  rcaTemplate: configurationDefaults.rcaTemplate,
  capaTemplate: configurationDefaults.capaTemplate,
};

export const ruleTemplate = diagnosticRuleTemplate as DiagnosticRule;
export const caseDisplayGroups = caseDisplay.groups;

type CatalogueFamily = {
  code: string;
  categories: Array<{ code: string; name: string; subcategories: Array<{ code: string; name: string }> }>;
};

const catalogueFamilies = (issueCatalogue.productFamilies ?? []) as CatalogueFamily[];

export function productFamilyOptions() {
  return catalogueFamilies.map((family) => ({ value: family.code as ProductFamily, label: family.code }));
}

export function complaintOptions(family?: ProductFamily | null) {
  const selected = catalogueFamilies.find((item) => item.code === family);
  if (!selected) return [];
  return selected.categories.flatMap((category) => {
    const categoryKey = `${selected.code}:${category.code}`;
    const base = [{ value: categoryKey, label: `${category.code} — ${category.name}` }];
    return base.concat(
      category.subcategories.map((subcategory) => ({
        value: `${categoryKey}:${subcategory.code}`,
        label: `${subcategory.code} — ${subcategory.name}`,
      })),
    );
  });
}

function normalise(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function classifyComplaint(
  productFamily: ProductFamily | null,
  phrases: string[],
  mappings: ComplaintMapping[] = defaultComplaintMappings,
) {
  if (!productFamily) return null;
  const source = phrases.map(normalise).filter(Boolean);
  const match = mappings.find((mapping) =>
    mapping.productFamily === productFamily && mapping.phrases.some((phrase) => source.includes(normalise(phrase))),
  );
  if (!match) return { key: `${productFamily}:UNCLASSIFIED`, label: "Unclassified complaint" };
  const category = catalogueFamilies
    .find((family) => family.code === productFamily)
    ?.categories.find((item) => item.code === match.categoryCode);
  const subcategory = category?.subcategories.find((item) => item.code === match.subcategoryCode);
  return {
    key: [productFamily, match.categoryCode, match.subcategoryCode].filter(Boolean).join(":"),
    label: subcategory?.name ?? category?.name ?? "Classified complaint",
  };
}
