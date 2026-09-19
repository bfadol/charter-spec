/**
 * Lifecycle module — schema validation for charter.yaml.
 *
 * Backed by a Zod schema (`appMetadataSchema`) which is the single source of
 * truth for the config contract. The schema is exported so other tooling
 * (e.g. the AI-generation flow) can validate configs at authoring time.
 *
 * `validateAppMetadata()` keeps the original result shape — it collects every
 * error before returning rather than failing on the first.
 */

import { z } from "zod";
import { capabilitiesConfigSchema } from "./capability-config.js";
import { integrationsSchema } from "./integration-config.js";
import type { AppMetadata } from "./types.js";

// ── Allowed values ───────────────────────────────────────────

export const RUNTIME_PATTERNS = ["api", "worker", "both"] as const;
export const STORAGE_TYPES = [
  "azure-sql",
  "cosmos",
  "blob",
  "postgres",
  "none",
] as const;
export const OWNERSHIP_TYPES = ["own", "consume"] as const;
export const CLASSIFICATION_TYPES = [
  "public",
  "internal",
  "restricted",
  "confidential",
] as const;
export const RETENTION_TYPES = ["90d", "1y", "permanent"] as const;
export const LIFECYCLE_STATUSES = ["active", "review", "archived"] as const;
export const REVIEW_TIERS = ["standard", "heightened"] as const;

/** Classifications that route to heightened review on their own. */
export const HEIGHTENED_CLASSIFICATIONS: readonly string[] = ["restricted", "confidential"];

/**
 * The review tier a charter derives to. Owning data routes to heightened
 * review (as always); a restricted or confidential classification does too.
 * Classification never lowers a tier — it can only raise one, so the result
 * is the max of the two grounds.
 */
export function derivedReviewTier(
  ownership: string,
  classification: string,
): (typeof REVIEW_TIERS)[number] {
  return ownership === "own" || HEIGHTENED_CLASSIFICATIONS.includes(classification)
    ? "heightened"
    : "standard";
}

/** Human-readable grounds for a heightened derivation — for warnings and notes. */
export function heightenedGrounds(ownership: string, classification: string): string[] {
  const grounds: string[] = [];
  if (ownership === "own") grounds.push("owns data (governed tier)");
  if (HEIGHTENED_CLASSIFICATIONS.includes(classification)) {
    grounds.push(`classification "${classification}"`);
  }
  return grounds;
}

// ── Schema ───────────────────────────────────────────────────

const nonEmptyString = z.string().trim().min(1);

export const dependencySchema = z.object({
  name: nonEmptyString,
  type: nonEmptyString,
  critical: z.boolean(),
});

export const dataPatternSchema = z
  .object({
    storage: z.enum(STORAGE_TYPES),
    ownership: z.enum(OWNERSHIP_TYPES),
    /**
     * Declared sensitivity of the data this app touches (owned or consumed).
     * Required on every app: an undeclared classification is an unmade
     * decision, not a default.
     */
    classification: z.enum(CLASSIFICATION_TYPES),
    retention: z.enum(RETENTION_TYPES),
    auditRequired: z.boolean(),
    // Governed-tier fields: required when ownership is "own" (enforced below).
    systemOfRecord: z.string().trim().min(1).optional(),
    residency: z.string().trim().min(1).optional(),
  })
  .superRefine((dp, ctx) => {
    // Owning data is a governed tier — non-invasiveness (consume) is the default.
    // An owning app must declare what it is the system of record for and where
    // the data lives, so "Charter-compliant" is machine-checkable, not a slogan.
    if (dp.ownership === "own") {
      if (!dp.systemOfRecord) {
        ctx.addIssue({
          code: "custom",
          path: ["systemOfRecord"],
          message:
            'systemOfRecord is required when ownership is "own" (declare the authoritative boundary this app owns)',
        });
      }
      if (!dp.residency) {
        ctx.addIssue({
          code: "custom",
          path: ["residency"],
          message:
            'residency is required when ownership is "own" (declare where owned data lives)',
        });
      }
    }
  });

/**
 * Accountability for the RUNNING asset — who answers for the app after it
 * ships, distinct from the respondent identity recorded at generation time
 * (the run report's translation record) and from `owner` (the authoring
 * team). `reviewBy` is the date by which the declaration must be re-reviewed;
 * enforcement of expiry is a `charter check` concern, not schema validation —
 * the schema only pins the shape.
 */
export const accountabilitySchema = z.object({
  /** Named organizational unit responsible for the running asset. */
  owner: nonEmptyString,
  /** ISO calendar date (YYYY-MM-DD) the charter must be re-reviewed by. */
  reviewBy: z.iso.date(),
});

/** Gate results recorded at generation time (the shape `charter check --json` emits). */
export const provenanceValidationSchema = z.object({
  configValid: z.boolean(),
  testsPassed: z.boolean(),
  coveragePercent: z.number().min(0).max(100),
  securityScanPassed: z.boolean(),
});

/**
 * Reference to the predecessor generation — its run report (the same
 * repo-relative run-report anchor promotion linkage uses) plus the fields
 * that pin the predecessor's charter provenance (specHash, generatedAt),
 * because an in-place regeneration replaces the predecessor's charter and
 * the run report is what survives. `generation` is the predecessor's own
 * generation number, declared here so the monotonicity rule is checkable
 * without file IO; chain resolution (the reference resolves, the report is
 * for the same promoted spec, numbers strictly increase along the chain)
 * is `charter check`'s concern — schema validation never reads files.
 */
export const lineagePredecessorSchema = z.object({
  /** The predecessor's generation number (this block's generation must exceed it). */
  generation: z.number().int().min(1),
  /** Repo-relative path to the predecessor generation's run report. */
  runReport: nonEmptyString,
  /** The predecessor charter provenance's specHash ("none" only on retro-certified predecessors). */
  specHash: z.union([
    z
      .string()
      .regex(
        /^sha256:[0-9a-f]{64}$/,
        'specHash must be "sha256:" followed by 64 lowercase hex characters',
      ),
    z.literal("none"),
  ]),
  /** The predecessor charter provenance's generatedAt. */
  generatedAt: z.iso.datetime(),
});

/**
 * Regeneration lineage — the machine-verified version chain. Identity anchor:
 * two runs are the same app when they generate from the same promoted spec,
 * the same anchor promotion linkage already uses. Every provenance block
 * carries a lineage block: absence is not a valid state — a first generation
 * says so explicitly (generation 1, no predecessor, no reason), and a
 * regeneration declares its predecessor and the human-recorded reason.
 * Lineage is a record, never a bypass: regeneration goes through every
 * existing gate unchanged.
 */
export const lineageSchema = z
  .object({
    /** 1 for a first generation; each regeneration must exceed its predecessor's. */
    generation: z.number().int().min(1),
    /** Required from generation 2 on; a first generation has none. */
    predecessor: lineagePredecessorSchema.optional(),
    /**
     * The regeneration reason, recorded verbatim from the human answer.
     * Required and non-empty from generation 2 on; absent on generation 1 —
     * a first generation has nothing to explain.
     */
    reason: nonEmptyString.optional(),
  })
  .superRefine((lineage, ctx) => {
    if (lineage.generation === 1) {
      if (lineage.predecessor !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["predecessor"],
          message:
            "generation 1 declares no predecessor — a first generation regenerates nothing",
        });
      }
      if (lineage.reason !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message:
            "generation 1 carries no regeneration reason — the reason records why an app was regenerated, and a first generation was not",
        });
      }
      return;
    }
    if (lineage.predecessor === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["predecessor"],
        message: `generation ${lineage.generation} must declare its predecessor — a regeneration without a predecessor reference breaks the version chain`,
      });
    } else if (lineage.generation <= lineage.predecessor.generation) {
      ctx.addIssue({
        code: "custom",
        path: ["generation"],
        message: `generation must exceed the predecessor's (${lineage.generation} ≤ ${lineage.predecessor.generation})`,
      });
    }
    if (lineage.reason === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: `generation ${lineage.generation} must record its regeneration reason — the human answer, verbatim, is part of the record`,
      });
    }
  });

/**
 * Generation provenance — the app's birth certificate. Stamped by the harness
 * at generation time, or retro-certified (`charter stamp --retro`) for apps
 * generated before the harness existed. Optional on the charter (hand-written
 * apps have none), but strict when present: a partial birth certificate is
 * worse than none, and a backfilled one that does not declare itself
 * retro-certified is a forged audit record.
 */
export const provenanceSchema = z
  .object({
    harnessVersion: nonEmptyString,
    engine: nonEmptyString,
    model: nonEmptyString,
    // "none" is truthful only for retro-certified apps: pre-harness apps had
    // no spec file, and inventing a hash would forge the audit record.
    specHash: z.union([
      z
        .string()
        .regex(
          /^sha256:[0-9a-f]{64}$/,
          'specHash must be "sha256:" followed by 64 lowercase hex characters',
        ),
      z.literal("none"),
    ]),
    // Pipeline: generation time. Retro-certified: certification time (the
    // original generation time was not recorded — saying otherwise would lie).
    generatedAt: z.iso.datetime(),
    reviewTier: z.enum(REVIEW_TIERS),
    validation: provenanceValidationSchema,
    /**
     * The regeneration version chain. Required on every provenance block,
     * pipeline and retro-certified alike: a birth certificate that does not
     * say which generation it is leaves the chain unverifiable, so absence
     * is not a valid state — first generations declare `generation: 1`
     * explicitly (backfilled 2026-07-15 for apps stamped before this field).
     */
    lineage: lineageSchema,
    /**
     * Repo-relative path to the run report carrying the full capture record
     * (per-stage prompt artifacts, model identity, schema hash). Required on
     * pipeline provenance; absent on retro-certified apps, which have no run.
     */
    runReport: nonEmptyString.optional(),
    /**
     * Repo-relative run report of the translation stage that produced the
     * generating spec (the human Q&A record). Present when the spec declared
     * a translation origin; resolvability is enforced by `charter check`,
     * not here — schema validation never does file IO.
     */
    translationRunReport: nonEmptyString.optional(),
    /** Present only on provenance issued post-hoc by `charter stamp --retro`. */
    retroCertified: z.literal(true).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.specHash === "none" && p.retroCertified !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["specHash"],
        message:
          'specHash "none" is only valid on retro-certified provenance (retroCertified: true) — pipeline-generated apps always have a real spec hash',
      });
    }
    if (p.retroCertified !== true && !p.runReport) {
      ctx.addIssue({
        code: "custom",
        path: ["runReport"],
        message:
          "pipeline provenance must point at its run report (the capture record); only retro-certified provenance may omit it",
      });
    }
  });

/**
 * Zod schema for charter.yaml. The single source of truth for the
 * micro-app metadata contract.
 */
export const appMetadataSchema = z
  .object({
    name: nonEmptyString,
    owner: nonEmptyString,
    /** Accountability for the running asset — required on all apps. */
    accountability: accountabilitySchema,
    domainBoundary: nonEmptyString,
    runtimePattern: z.enum(RUNTIME_PATTERNS),
    dependencies: z.array(dependencySchema),
    dataPattern: dataPatternSchema,
    lifecycle: z.enum(LIFECYCLE_STATUSES),
    // Lenient, matching prior behavior: anything non-boolean (or missing)
    // collapses to false rather than erroring.
    aiGenerated: z.boolean().catch(false),
    aiTools: z.array(z.string()).default([]),
    /**
     * Declared config for shared capabilities (cache, feature-flags,
     * data-access) — the source of truth stage-2 wiring reads from.
     * Optional: apps declaring no shared-capability config omit it, and
     * its absence is never an error (declared-versus-wired conformance
     * is out of scope). When present, each entry must satisfy its pinned
     * capability schema.
     */
    capabilities: capabilitiesConfigSchema.optional(),
    /**
     * Declared external systems (outside the platform boundary) — one entry
     * per system: name, outbound hosts, credentials by reference name,
     * cadence, and live/stubbed mode. Optional: apps with no external
     * systems carry no block, and absence is never a schema error — the
     * static conformance gate in `charter check` names the vacuous pass.
     * Shared platform capabilities are never integrations.
     */
    integrations: integrationsSchema.optional(),
    provenance: provenanceSchema.optional(),
  })
  .superRefine((app, ctx) => {
    // Review-tier routing is enforced by schema, not convention: an app whose
    // charter derives to heightened review — it owns data (governed tier)
    // and/or its classification is restricted/confidential — cannot carry a
    // "standard" review tier in its birth certificate. Over-routing (standard
    // derivation, heightened tier) stays legal: classification and ownership
    // only ever raise the tier, never cap it.
    const derived = derivedReviewTier(
      app.dataPattern.ownership,
      app.dataPattern.classification,
    );
    if (app.provenance && derived === "heightened" && app.provenance.reviewTier !== "heightened") {
      ctx.addIssue({
        code: "custom",
        path: ["provenance", "reviewTier"],
        message:
          `reviewTier must be "heightened" — this charter routes to heightened review: ` +
          heightenedGrounds(app.dataPattern.ownership, app.dataPattern.classification).join("; "),
      });
    }
  });

// ── Public interface ─────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  /** Stable, named failure code (e.g. OWNER_UNREGISTERED) when the check has one. */
  code?: string;
}

export type ValidationResult =
  | { valid: true; data: AppMetadata }
  | { valid: false; errors: ValidationError[] };

/**
 * Validate a raw parsed YAML object against the charter.yaml schema.
 * Returns either `{ valid: true, data }` or `{ valid: false, errors }`.
 */
export function validateAppMetadata(raw: unknown): ValidationResult {
  const result = appMetadataSchema.safeParse(raw);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
  }));

  return { valid: false, errors };
}
