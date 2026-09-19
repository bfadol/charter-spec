/**
 * Lifecycle module — type definitions.
 *
 * These types model the charter.yaml schema and the telemetry
 * event structure used by the reporter.
 */

import type { CacheConfig } from "../cache/config-schema.js";
import type { FeatureFlagsConfig } from "../feature-flags/config-schema.js";
import type { DataAccessConfig } from "../data/config-schema.js";
import type { IntegrationDeclaration } from "./integration-config.js";

// ── Config schema enums ──────────────────────────────────────

export type RuntimePattern = "api" | "worker" | "both";

export type StorageType =
  | "azure-sql"
  | "cosmos"
  | "blob"
  | "postgres"
  | "none";
export type OwnershipType = "own" | "consume";
export type ClassificationType = "public" | "internal" | "restricted" | "confidential";
export type RetentionType = "90d" | "1y" | "permanent";

export type LifecycleStatus = "active" | "review" | "archived";

export type ReviewTier = "standard" | "heightened";

// ── Config schema interfaces ─────────────────────────────────

export interface DependencyDeclaration {
  name: string;
  type: string; // open-ended: "api", "database", "datastore", "queue", etc.
  critical: boolean;
}

export interface DataPatternDeclaration {
  storage: StorageType;
  ownership: OwnershipType;
  /** Declared sensitivity of the data this app touches (owned or consumed). */
  classification: ClassificationType;
  retention: RetentionType;
  auditRequired: boolean;
  /**
   * Required when ownership is "own": the authoritative boundary this app is the
   * system of record for. Owning data is a governed tier — non-invasiveness
   * (ownership: "consume") is the default.
   */
  systemOfRecord?: string;
  /** Required when ownership is "own": data residency / jurisdiction. */
  residency?: string;
}

/**
 * Accountability for the RUNNING asset — who answers for the app after it
 * ships, distinct from the respondent identity recorded at generation and
 * from `owner` (the authoring team).
 */
export interface AccountabilityDeclaration {
  /** Named organizational unit responsible for the running asset. */
  owner: string;
  /** ISO calendar date (YYYY-MM-DD) the charter must be re-reviewed by. */
  reviewBy: string;
}

/** Gate results recorded at generation time (the shape `charter check --json` emits). */
export interface ProvenanceValidation {
  configValid: boolean;
  testsPassed: boolean;
  coveragePercent: number;
  securityScanPassed: boolean;
}

/**
 * Reference to the predecessor generation: its run report (the same
 * repo-relative anchor promotion linkage uses) plus the fields pinning the
 * predecessor's charter provenance, which an in-place regeneration replaces.
 */
export interface LineagePredecessorRef {
  /** The predecessor's generation number. */
  generation: number;
  /** Repo-relative path to the predecessor generation's run report. */
  runReport: string;
  /** The predecessor charter provenance's specHash ("none" on retro-certified predecessors). */
  specHash: string;
  /** The predecessor charter provenance's generatedAt. */
  generatedAt: string;
}

/**
 * Regeneration lineage — the machine-verified version chain. Identity anchor:
 * two runs are the same app when they generate from the same promoted spec.
 * Required on every provenance block: generation 1 declares no predecessor
 * and no reason; every later generation declares both.
 */
export interface LineageDeclaration {
  /** 1 for a first generation; must exceed the predecessor's on regenerations. */
  generation: number;
  /** Absent on generation 1; required from generation 2 on. */
  predecessor?: LineagePredecessorRef;
  /** The regeneration reason, verbatim from the human answer. Generation ≥ 2 only. */
  reason?: string;
}

/**
 * Generation provenance — the app's birth certificate. Stamped by the harness
 * when an app is generated, so "AI-generated" is an audit trail (which harness,
 * which model, from which spec, passing which gates) rather than a flag.
 */
export interface ProvenanceDeclaration {
  /** Version of the Charter harness that generated (or retro-certified) the app. */
  harnessVersion: string;
  /** Generation engine driven by the harness (e.g. "example-engine"). */
  engine: string;
  /** Exact model identifier used by the engine ("unrecorded (pre-harness)" on retro). */
  model: string;
  /** SHA-256 of the spec ("sha256:<64 hex>"), or "none" on retro-certified apps. */
  specHash: string;
  /** ISO-8601 timestamp: generation time (pipeline) or certification time (retro). */
  generatedAt: string;
  /** Review tier the harness routed the app to. Owned-data apps must be "heightened". */
  reviewTier: ReviewTier;
  /** Gate results at generation/certification time. */
  validation: ProvenanceValidation;
  /** The regeneration version chain — required; generation 1 is explicit. */
  lineage: LineageDeclaration;
  /**
   * Repo-relative path to the run report carrying the capture record
   * (per-stage prompt artifacts, model identity, schema hash). Required on
   * pipeline provenance; absent on retro-certified apps.
   */
  runReport?: string;
  /**
   * Repo-relative path to the run report whose translation stage produced
   * the generating spec — the record of the human Q&A. Present when the spec
   * declared a translation origin; `charter check` fails the app if the
   * claim cannot be resolved.
   */
  translationRunReport?: string;
  /** Present only when provenance was issued post-hoc by `charter stamp --retro`. */
  retroCertified?: true;
}

/**
 * Declared config for the shared capabilities — the charter.yaml
 * `capabilities` block. Source of truth for stage-2 wiring; validated
 * against the pinned schemas in capability-config.ts.
 */
export interface CapabilitiesDeclaration {
  cache?: CacheConfig;
  "feature-flags"?: FeatureFlagsConfig;
  "data-access"?: DataAccessConfig;
  /**
   * Presence-only capabilities — the entry declares the app inherits the
   * capability; there is no config surface. Declared so an auditor reads
   * the complete inherited posture in one document.
   */
  identity?: Record<string, never>;
  config?: Record<string, never>;
  observability?: Record<string, never>;
  resilience?: Record<string, never>;
  lifecycle?: Record<string, never>;
}

/**
 * Validated metadata from charter.yaml.
 * Every Charter app must declare this file at its project root.
 */
export interface AppMetadata {
  name: string;
  owner: string;
  /** Accountability for the running asset — required on all apps. */
  accountability: AccountabilityDeclaration;
  domainBoundary: string;
  runtimePattern: RuntimePattern;
  dependencies: DependencyDeclaration[];
  dataPattern: DataPatternDeclaration;
  lifecycle: LifecycleStatus;
  aiGenerated: boolean;
  aiTools: string[];
  /** Declared shared-capability config; absent when the app declares none. */
  capabilities?: CapabilitiesDeclaration;
  /**
   * Declared external systems (outside the platform boundary); absent when
   * the app has none. Shared platform capabilities are never integrations.
   */
  integrations?: IntegrationDeclaration[];
  /** Present on harness-generated apps; absent on hand-written ones. */
  provenance?: ProvenanceDeclaration;
}

// ── Telemetry event types ────────────────────────────────────

export type EventType = "api_request" | "worker_job" | "startup" | "custom";

export interface TelemetryEvent {
  appName: string;
  eventType: EventType;
  timestamp: Date;
  /** Duration in milliseconds, if applicable */
  durationMs?: number;
  /** Arbitrary key-value metadata */
  attributes: Record<string, string | number | boolean>;
}

// ── Deprecated types (backward compatibility) ────────────────

/** @deprecated Use TelemetryEvent instead */
export interface UsageEvent {
  appName: string;
  timestamp: Date;
  eventType: string;
}

/** @deprecated Use AppMetadata instead */
export interface LifecycleInfo {
  status: LifecycleStatus;
  daysSinceLastUsage: number;
  thresholds: number[];
}
