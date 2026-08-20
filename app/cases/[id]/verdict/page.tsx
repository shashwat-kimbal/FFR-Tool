import React from "react";
import VerdictClientView from "./verdict-client";

export default async function VerdictPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <VerdictClientView caseId={id} />;
}
