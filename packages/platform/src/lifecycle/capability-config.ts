/**
 * Capability-config registry — the pinned config contracts for the shared
 * capabilities, keyed by capability name.
 *
 * The charter.yaml `capabilities` block is validated against these schemas.
 * The block is the SOURCE OF TRUTH for shared-capability wiring: the
 * generation pipeline's stage 2 wires factory options from it, so for
 * harness-generated apps declared equals wired by construction.
 *
 * Strict on both axes: each configurable capability's config rejects
 * unknown fields, and a capability outside the block's key set cannot be
 * declared at all.
 *
 * Two kinds of entry (backlog item 4, ratified):
 *   - CONFIGURABLE capabilities (cache, feature-flags, data-access) carry
 *     their pinned config schema — value validation, unchanged.
 *   - PRESENCE-ONLY capabilities (identity, config, observability,
 *     resilience, lifecycle) carry an empty strict object: the entry
 *     declares that the app inherits the capability, so an auditor reads
 *     the app's complete inherited posture in one document. There is no
 *     config to validate — these capabilities take none at wiring time.
 *
 * Presence/absence CONFORMANCE (declared-versus-wired) is the
 * capability-conformance gate's job, not schema validation's.
 */
import { z } from "zod";
import { cacheConfigSchema } from "../cache/config-schema.js";
import { featureFlagsConfigSchema } from "../feature-flags/config-schema.js";
import { dataAccessConfigSchema } from "../data/config-schema.js";

export const CAPABILITY_CONFIG_SCHEMAS = {
  cache: cacheConfigSchema,
  "feature-flags": featureFlagsConfigSchema,
  "data-access": dataAccessConfigSchema,
} as const;

export type ConfiguredCapability = keyof typeof CAPABILITY_CONFIG_SCHEMAS;

/** Capabilities declared by presence alone — no config surface exists. */
export const PRESENCE_ONLY_CAPABILITIES = [
  "identity",
  "config",
  "observability",
  "resilience",
  "lifecycle",
] as const;
export type PresenceOnlyCapability = (typeof PRESENCE_ONLY_CAPABILITIES)[number];

/** An empty strict object: presence is the claim; any field is an error. */
const presenceOnlySchema = z.strictObject({});

export const capabilitiesConfigSchema = z.strictObject({
  cache: cacheConfigSchema.optional(),
  "feature-flags": featureFlagsConfigSchema.optional(),
  "data-access": dataAccessConfigSchema.optional(),
  identity: presenceOnlySchema.optional(),
  config: presenceOnlySchema.optional(),
  observability: presenceOnlySchema.optional(),
  resilience: presenceOnlySchema.optional(),
  lifecycle: presenceOnlySchema.optional(),
});

export type CapabilitiesConfig = z.infer<typeof capabilitiesConfigSchema>;
