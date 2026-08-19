"use client";
/* Shared logo URLs cannot use the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Layers3 } from "lucide-react";

export function BrandHeader() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/governance/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !payload || typeof payload !== "object") return;
        const settings = (payload as Record<string, unknown>).settings;
        if (!settings || typeof settings !== "object") return;
        const value = (settings as Record<string, unknown>).value;
        if (!value || typeof value !== "object") return;
        const branding = (value as Record<string, unknown>).branding;
        if (!branding || typeof branding !== "object") return;
        const url = (branding as Record<string, unknown>).logoUrl;
        if (typeof url === "string" && url) setLogoUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="brand">
        {logoUrl ? (
          <img className="brand-logo-image" src={logoUrl} alt="Organisation logo" />
        ) : (
          <div className="brand-mark">K</div>
        )}
        <div>
          <strong>Kimbal</strong>
          <span>FFR Intelligence</span>
        </div>
      </div>
      <div className="pilot-chip">
        <Layers3 size={14} /> Shared provisional rule pilot
      </div>
    </>
  );
}
