"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";
import { FileImage, FileSpreadsheet, Upload } from "lucide-react";
import type { UploadedArtifact } from "../lib/pilot-types";

export function Status({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "danger" | "ai";
  children: ReactNode;
}) {
  return (
    <span className={`status status-${tone}`}>
      <span />
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function formatSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

function truncateHash(hash: string | null) {
  return hash
    ? `${hash.slice(0, 12)}…${hash.slice(-8)}`
    : "Hash unavailable in this browser";
}

export function ArtifactSummary({ artifact }: { artifact: UploadedArtifact }) {
  const icon =
    artifact.kind === "IMAGE" ? (
      <FileImage size={18} />
    ) : (
      <FileSpreadsheet size={18} />
    );
  return (
    <article className="artifact-card">
      <span className={`artifact-icon artifact-${artifact.kind.toLowerCase()}`}>
        {icon}
      </span>
      <div>
        <strong title={artifact.name}>{artifact.name}</strong>
        <small>{artifact.detail}</small>
      </div>
      <Status tone={artifact.kind === "UNRECOGNIZED" ? "danger" : "good"}>
        {artifact.kind.replaceAll("_", " ")}
      </Status>
      <small>
        {formatSize(artifact.size)} · SHA-256 {truncateHash(artifact.sha256)}
      </small>
    </article>
  );
}

export function UploadStage({
  title,
  description,
  buttonText,
  accept,
  multiple = false,
  disabled = false,
  onChange,
  children,
}: {
  title: string;
  description: string;
  buttonText: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="stage-card">
      <SectionHead title={title} description={description} />
      <button
        className="drop-zone stage-upload"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <span className="drop-icon">
          <Upload size={23} />
        </span>
        <strong>{buttonText}</strong>
        <span>
          {multiple
            ? "You may select several image files."
            : "Select one workbook for this stage."}
        </span>
        <em>
          {disabled ? "Complete the previous stage first" : "Select file"}
        </em>
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
      />
      {children}
    </Card>
  );
}
