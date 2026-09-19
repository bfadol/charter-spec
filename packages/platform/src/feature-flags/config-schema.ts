/**
 * Feature-flags capability — declared-config contract.
 *
 * Pinned from the real config surface of the capability: `createFeatureFlags()`
 * itself takes no declarable options; what an app declares are the flag
 * definitions the ConfigFlagProvider evaluates (`FlagDefinition` in types.ts).
 * This is what an app's charter.yaml `capabilities.feature-flags` block may
 * declare. Strict: unknown fields are rejected.
 */
import { z } from "zod";

export const flagDefinitionConfigSchema = z.strictObject({
  enabled: z.boolean(),
  /** Enable only for these roles (any match). */
  enabledForRoles: z.array(z.string().trim().min(1)).min(1).optional(),
  /** Enable only for these tenants (any match). */
  enabledForTenants: z.array(z.string().trim().min(1)).min(1).optional(),
  /** 0–100 percentage rollout, hashed on userId for stable bucketing. */
  rolloutPercentage: z.number().min(0).max(100).optional(),
  /** Variant name → weight. All-zero weights are dead config — rejected. */
  variants: z
    .record(z.string().trim().min(1), z.number().finite().min(0))
    .refine((v) => Object.values(v).reduce((sum, w) => sum + w, 0) > 0, {
      message: "variant weights must sum to a positive number",
    })
    .optional(),
});

export const featureFlagsConfigSchema = z.strictObject({
  /** Flag name → definition. The map the ConfigFlagProvider evaluates. */
  flags: z.record(z.string().trim().min(1), flagDefinitionConfigSchema),
});

export type FeatureFlagsConfig = z.infer<typeof featureFlagsConfigSchema>;
