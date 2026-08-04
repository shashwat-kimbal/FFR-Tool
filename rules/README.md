# Kimbal FFR diagnostic knowledge base

This directory contains the version-controlled inputs used by the deterministic Phase 1 rule engine.

## Current contents

- `catalogues/customer-issue-catalogue.v1.json` contains the customer-reported issue catalogue for Meter, NIC and Gateway. Codes are scoped by product family.
- `catalogues/product-family-map.v1.json` contains the approved deterministic mapping from FFR values to Meter/NIC/Gateway. It is intentionally partial until actual values are supplied.
- `catalogues/complaint-synonyms.v1.json` contains deterministic mappings from observed FFR wording to complaint categories/subcategories. It never invents an unlisted subcategory.
- `templates/bcs-diagnostic-rule.template.yaml` is the authoring template for every BCS/DLMS diagnostic rule.

## Important distinction

The complaint catalogue is now populated, but the BCS diagnostic rule catalogue is not. Thresholds, causal effects and exceptions must be created and reviewed with Kimbal domain experts. The application must never convert an unreviewed example into an active rule.

## Phase 1 rule selection

Phase 1 selects applicable rules deterministically using:

1. product family;
2. customer complaint key;
3. meter model/variant where available;
4. required-source availability;
5. explicit rule conditions.

AI may interpret images and draft an explanation, but it does not choose which rules execute in Phase 1.

## Phase 2 change

Phase 2 may allow AI to recommend a subset or order of approved rules. The deterministic engine still validates applicability, prerequisites and prohibited combinations before executing the recommendation.

## Rule authoring process

1. Choose one product-family complaint key.
2. List the relevant workbook sheets, fields and derived features.
3. Write observable conditions and boundary values.
4. State which hypotheses are strengthened, weakened or ruled out.
5. State what the rule cannot prove.
6. Add positive, negative and boundary fixtures.
7. Obtain engineering/Quality review.
8. Publish an immutable versioned bundle.

Every rule change requires a new version and regression tests against reviewed historical cases.
