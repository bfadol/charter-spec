/**
 * Integrations — the declared-external-systems contract.
 *
 * The charter.yaml `integrations` block declares the EXTERNAL systems an app
 * talks to — systems outside the platform boundary (public APIs, ministry
 * systems, third-party services). Shared platform capabilities (cache,
 * feature-flags, data-access, identity, observability) are NOT integrations
 * and never appear here.
 *
 * Phase 1 contract: declaration plus static conformance. The block is the
 * source of truth `charter check` verifies the code's outbound surface
 * against. Runtime egress enforcement is phase 2 and is not built.
 *
 * Strict on every axis: unknown fields are rejected, and credentials are
 * declared strictly by REFERENCE NAME — the secret name the platform config
 * seam (`getSecret`) resolves at runtime. A committed charter must never
 * carry a credential value; the reference pattern below structurally rejects
 * URLs, tokens, and anything value-shaped.
 */
import { z } from "zod";

export const INTEGRATION_MODES = ["live", "stubbed"] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];

export const INTEGRATION_CADENCES = ["on-demand", "scheduled"] as const;
export type IntegrationCadence = (typeof INTEGRATION_CADENCES)[number];

/**
 * A bare lowercase hostname — no scheme, no port, no path. Matching in the
 * conformance gate happens on hostnames, and hostnames are case-insensitive,
 * so the canonical declared form is lowercase. Single-label names are legal
 * (compose service names like "core-ledger-stub").
 */
const hostSchema = z
  .string()
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
    "must be a bare lowercase hostname (no scheme, port, or path)",
  );

/**
 * A credential REFERENCE name (e.g. "stats-api-key") — resolved through
 * the platform config seam at runtime, never a value. The pattern rejects
 * anything value-shaped: uppercase, dots, colons, slashes, equals, spaces.
 */
const credentialRefSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,63}$/,
    "must be a credential reference name (lowercase slug, e.g. \"stats-api-key\") — never a credential value",
  );

/** An environment-variable name, e.g. "DMS_API_URL". */
const envVarNameSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, "must be an environment variable name (e.g. \"DMS_API_URL\")");

export const integrationSchema = z
  .strictObject({
    /** The external system's name — matches the code's downstream label. */
    name: z.string().trim().min(1),
    /**
     * Outbound host(s) the app reaches for this system — repo-verifiable.
     * Exactly one of `hosts` / `hostsFrom` must be declared.
     */
    hosts: z
      .array(hostSchema)
      .min(1, "declare at least one outbound host")
      .refine((hs) => new Set(hs).size === hs.length, {
        message: "hosts must be unique",
      })
      .optional(),
    /**
     * The environment variable that supplies the host at deploy time —
     * deployment-trust, for systems whose hosts are cluster configuration by
     * design (ministry-internal systems). Mirrors the credentials-by-reference
     * discipline: the charter declares the shape of the external surface, the
     * deployment supplies the value. Static conformance can verify the
     * reference is wired but cannot confirm the actual target — the gate says
     * so. Exactly one of `hosts` / `hostsFrom` must be declared.
     */
    hostsFrom: envVarNameSchema.optional(),
    /**
     * Credential reference names this integration uses. Required so "no
     * credentials" is a declared decision (an explicit empty list), not an
     * omission.
     */
    credentials: z.array(credentialRefSchema),
    /** How the system is called: per-request, or on a schedule. */
    cadence: z.enum(INTEGRATION_CADENCES),
    /**
     * The cron expression alone (five whitespace-separated fields) —
     * machine-comparable, so a future declared-versus-wired check can verify
     * it against the actual cron config without a contract break. Required
     * when cadence is "scheduled"; rejected otherwise — a schedule on an
     * on-demand integration is dead config. Prose goes in `note`.
     */
    schedule: z
      .string()
      .regex(
        /^[0-9A-Za-z*,/-]+( +[0-9A-Za-z*,/-]+){4}$/,
        "must be a bare cron expression (five fields, e.g. \"0 6 * * 1\") — prose goes in note",
      )
      .optional(),
    /** Free-text annotation (e.g. the env var that overrides the schedule). */
    note: z.string().trim().min(1).optional(),
    /**
     * "live" — the app reaches the real external system.
     * "stubbed" — the declared hosts point at a stand-in (e.g. a compose
     * stub); the real system is not reached from this deployment.
     */
    mode: z.enum(INTEGRATION_MODES),
  })
  .superRefine((entry, ctx) => {
    if (entry.hosts !== undefined && entry.hostsFrom !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["hostsFrom"],
        message:
          "declare hosts (repo-verifiable) OR hostsFrom (deploy-resolved), never both — two sources of truth for one surface",
      });
    }
    if (entry.hosts === undefined && entry.hostsFrom === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["hosts"],
        message:
          "declare the outbound surface: hosts (repo-verifiable) or hostsFrom (deploy-resolved env reference)",
      });
    }
    if (entry.cadence === "scheduled" && !entry.schedule) {
      ctx.addIssue({
        code: "custom",
        path: ["schedule"],
        message: 'schedule is required when cadence is "scheduled"',
      });
    }
    if (entry.cadence === "on-demand" && entry.schedule) {
      ctx.addIssue({
        code: "custom",
        path: ["schedule"],
        message: 'schedule is only valid when cadence is "scheduled" — on an on-demand integration it is dead config',
      });
    }
  });

/**
 * The `integrations` block: one entry per external system. Optional at the
 * schema level — apps with no external systems carry no block, and absence
 * is never a schema error (the conformance gate names the vacuous pass).
 * An EMPTY block is rejected as dead config: declaring "integrations:" with
 * no entries says nothing a missing block doesn't.
 */
export const integrationsSchema = z
  .array(integrationSchema)
  .min(1, "an empty integrations block is dead config — omit the block instead")
  .refine((entries) => new Set(entries.map((e) => e.name)).size === entries.length, {
    message: "integration names must be unique",
  });

export type IntegrationDeclaration = z.infer<typeof integrationSchema>;
export type IntegrationsDeclaration = z.infer<typeof integrationsSchema>;
