import { describe, it, expect } from "vitest";
import { cacheConfigSchema } from "./config-schema.js";

/** All field names an issue points at: paths, plus keys of unrecognized-key issues. */
function errorFields(result: ReturnType<typeof cacheConfigSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => [
    issue.path.join("."),
    ...("keys" in issue ? (issue.keys as string[]) : []),
  ]);
}

describe("cacheConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = cacheConfigSchema.safeParse({
      backend: "redis",
      keyPrefix: "orders:",
      defaultTtlSeconds: 300,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a config missing the required backend field, naming it", () => {
    const result = cacheConfigSchema.safeParse({ keyPrefix: "orders:" });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("backend");
  });

  it("rejects unknown fields, naming them — connection URLs never live in a charter", () => {
    const result = cacheConfigSchema.safeParse({
      backend: "redis",
      url: "redis://user:secret@prod-host:6379",
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("url");
  });

  it("rejects a backend outside the allowed enum, naming the field", () => {
    const result = cacheConfigSchema.safeParse({ backend: "azure-redis" });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("backend");
  });

  it("rejects a negative defaultTtlSeconds, naming the field", () => {
    const result = cacheConfigSchema.safeParse({ backend: "memory", defaultTtlSeconds: -5 });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("defaultTtlSeconds");
  });
});
