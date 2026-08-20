"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import TimelineClientView from "./timeline-client";

export default function TimelinePage() {
  const params = useParams();
  const id = (params?.id ? String(params.id) : "") || (typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "") || "13644";

  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    if (!id || id === "undefined") return;
    fetch(`/api/cases/${id}`)
      .then((res) => res.json())
      .then((data) => setCaseData(data.case))
      .catch(() => {});
  }, [id]);

  return <TimelineClientView caseId={id} caseData={caseData} />;
}
