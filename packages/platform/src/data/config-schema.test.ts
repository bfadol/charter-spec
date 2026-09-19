import { describe, it, expect } from "vitest";
import { dataAccessConfigSchema } from "./config-schema.js";

/** All field names an issue points at: paths, plus keys of unrecognized-key issues. */
function errorFields(
  result: ReturnType<typeof dataAccessConfigSchema.safeParse>,
): string[] {
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => [
    issue.path.join("."),
    ...("keys" in issue ? (issue.keys as string[]) : []),
  ]);
}

describe("dataAccessConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = dataAccessConfigSchema.safeParse({
      backend: "postgres",
      tables: ["exemption_requests", "audit_log"],
      idempotency: { table: "idempotency_keys" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a config missing the required tables field, naming it", () => {
    const result = dataAccessConfigSchema.safeParse({ backend: "postgres" });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("tables");
  });

  it("rejects unknown fields, naming them — connection strings never live in a charter", () => {
    const result = dataAccessConfigSchema.safeParse({
      backend: "postgres",
      tables: ["items"],
      connectionString: "postgres://user:secret@prod-host/db",
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("connectionString");
  });

  it("rejects a backend outside the allowed enum, naming the field", () => {
    const result = dataAccessConfigSchema.safeParse({ backend: "cosmos", tables: ["items"] });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("backend");
  });

  it("rejects a table name that is not a SQL identifier, naming the entry", () => {
    const result = dataAccessConfigSchema.safeParse({
      backend: "postgres",
      tables: ["items; DROP TABLE items"],
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("tables.0");
  });

  it("rejects duplicate table names, naming the field", () => {
    const result = dataAccessConfigSchema.safeParse({
      backend: "memory",
      tables: ["items", "items"],
    });
    expect(result.success).toBe(false);
    expect(errorFields(result)).toContain("tables");
  });
});
