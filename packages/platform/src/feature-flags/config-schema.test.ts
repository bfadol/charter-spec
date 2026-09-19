import { describe, it, expect } from "vitest";
import { featureFlagsConfigSchema } from "./config-schema.js";

/** All field names an issue points at: paths, plus keys of unrecognized-key issues. */
function errorFields(
  result: ReturnType<typeof featureFlagsConfigSchema.safeParse>,
): string[] {
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => [
    issue.path.join("."),
    ...("keys" in issue ? (issue.keys as string[]) : []),
  ]);
}

describe("featureFlagsConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = featureFlagsConfigSchema.safeParse({
      flags: {
        "beta-ui": {
          enabled: true,
          enabledForRoles: ["admin"],
          rolloutPercentage: 25,
          variants: { control: 1, treatment: 3 },
        },
        "new-pricing": { enabled: false },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a config missing the required flags map, naming it", () => {
    const result = featureFlagsConfigSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("flags");
  });

  it("rejects unknown fields on a flag definition, naming them", () => {
    const result = featureFlagsConfigSchema.safeParse({
      flags: { "beta-ui": { enabled: true, rollout: 10 } },
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("rollout");
  });

  it("rejects a rolloutPercentage above 100, naming the field", () => {
    const result = featureFlagsConfigSchema.safeParse({
      flags: { "beta-ui": { enabled: true, rolloutPercentage: 150 } },
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("flags.beta-ui.rolloutPercentage");
  });

  it("rejects all-zero variant weights — dead config — naming the field", () => {
    const result = featureFlagsConfigSchema.safeParse({
      flags: { "beta-ui": { enabled: true, variants: { a: 0, b: 0 } } },
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("flags.beta-ui.variants");
  });
});
