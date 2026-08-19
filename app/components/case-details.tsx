"use client";

import { caseDisplayGroups } from "../lib/pilot-config";
import { canonicalField, ffrValue } from "../lib/workbook-parser";
import type { FfrRow } from "../lib/pilot-types";

export function CaseDetailsList({ row }: { row: FfrRow }) {
  return (
    <div className="case-context-list">
      {caseDisplayGroups.map((group) => (
        <details
          key={group.id}
          open={
            group.id === "case_context" ||
            group.id === "asset_context" ||
            group.id === "complaint_context"
          }
        >
          <summary>{group.title}</summary>
          <dl>
            {group.fields.map((field) => (
              <div key={field}>
                <dt>{row.labels[canonicalField(field)] ?? field}</dt>
                <dd>{ffrValue(row, field) || "Not supplied"}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );
}
