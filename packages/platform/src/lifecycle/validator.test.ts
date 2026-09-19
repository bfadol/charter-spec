import { describe, it, expect } from "vitest";
import { validateAppMetadata } from "./validator.js";

const validConfig = {
  name: "test-app",
  owner: "test-team",
  accountability: { owner: "test-org-unit", reviewBy: "2027-01-01" },
  domainBoundary: "Testing domain",
  runtimePattern: "api",
  dependencies: [
    { name: "db", type: "database", critical: true },
    { name: "cache", type: "datastore", critical: false },
  ],
  dataPattern: {
    storage: "azure-sql",
    ownership: "own",
    classification: "internal",
    retention: "90d",
    auditRequired: false,
    systemOfRecord: "Authoritative for test entities",
    residency: "eu-west",
  },
  lifecycle: "active",
  aiGenerated: false,
  aiTools: [],
};

describe("validateAppMetadata", () => {
  it("accepts a valid config", () => {
    const result = validateAppMetadata(validConfig);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.name).toBe("test-app");
      expect(result.data.owner).toBe("test-team");
      expect(result.data.runtimePattern).toBe("api");
      expect(result.data.lifecycle).toBe("active");
      expect(result.data.dependencies).toHaveLength(2);
      expect(result.data.dependencies[0].critical).toBe(true);
      expect(result.data.dataPattern.storage).toBe("azure-sql");
    }
  });

  it("accepts all valid runtimePattern values", () => {
    for (const pattern of ["api", "worker", "both"]) {
      const result = validateAppMetadata({ ...validConfig, runtimePattern: pattern });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid lifecycle values", () => {
    for (const status of ["active", "review", "archived"]) {
      const result = validateAppMetadata({ ...validConfig, lifecycle: status });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid storage types", () => {
    for (const storage of ["azure-sql", "cosmos", "blob", "none"]) {
      const dp = { ...validConfig.dataPattern, storage };
      const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects missing name", () => {
    const { name: _, ...noName } = validConfig;
    const result = validateAppMetadata(noName);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("rejects empty string name", () => {
    const result = validateAppMetadata({ ...validConfig, name: "  " });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid runtimePattern", () => {
    const result = validateAppMetadata({ ...validConfig, runtimePattern: "serverless" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "runtimePattern")).toBe(true);
    }
  });

  it("rejects invalid lifecycle status", () => {
    const result = validateAppMetadata({ ...validConfig, lifecycle: "deprecated" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "lifecycle")).toBe(true);
    }
  });

  it("rejects missing dependencies", () => {
    const { dependencies: _, ...noDeps } = validConfig;
    const result = validateAppMetadata(noDeps);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "dependencies")).toBe(true);
    }
  });

  it("rejects dependency with missing critical field", () => {
    const result = validateAppMetadata({
      ...validConfig,
      dependencies: [{ name: "db", type: "database" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes("critical"))).toBe(true);
    }
  });

  it("rejects missing dataPattern", () => {
    const { dataPattern: _, ...noData } = validConfig;
    const result = validateAppMetadata(noData);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "dataPattern")).toBe(true);
    }
  });

  it("rejects invalid dataPattern.storage", () => {
    const dp = { ...validConfig.dataPattern, storage: "mysql" };
    const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "dataPattern.storage")).toBe(true);
    }
  });

  it("requires systemOfRecord and residency when ownership is 'own' (governed tier)", () => {
    const dp = {
      storage: "postgres",
      ownership: "own",
      classification: "internal",
      retention: "1y",
      auditRequired: true,
    };
    const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.field === "dataPattern.systemOfRecord")
      ).toBe(true);
      expect(
        result.errors.some((e) => e.field === "dataPattern.residency")
      ).toBe(true);
    }
  });

  it("does not require governance fields when ownership is 'consume'", () => {
    const dp = {
      storage: "none",
      ownership: "consume",
      classification: "internal",
      retention: "90d",
      auditRequired: false,
    };
    const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
    expect(result.valid).toBe(true);
  });

  it("requires accountability with a named owner and an ISO reviewBy date", () => {
    const { accountability: _, ...noAccountability } = validConfig;
    const result = validateAppMetadata(noAccountability);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "accountability")).toBe(true);
    }
  });

  it("rejects an empty accountability.owner", () => {
    const result = validateAppMetadata({
      ...validConfig,
      accountability: { owner: "  ", reviewBy: "2027-01-01" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "accountability.owner")).toBe(true);
    }
  });

  it("rejects a non-date accountability.reviewBy (full datetimes included)", () => {
    for (const reviewBy of ["soon", "2027-13-01", "2027-01-01T00:00:00Z"]) {
      const result = validateAppMetadata({
        ...validConfig,
        accountability: { owner: "test-org-unit", reviewBy },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === "accountability.reviewBy")).toBe(true);
      }
    }
  });

  it("requires dataPattern.classification", () => {
    const { classification: _, ...dp } = validConfig.dataPattern;
    const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "dataPattern.classification")).toBe(true);
    }
  });

  it("accepts exactly the four classification levels and nothing else", () => {
    for (const classification of ["public", "internal", "restricted", "confidential"]) {
      const dp = { ...validConfig.dataPattern, classification };
      expect(validateAppMetadata({ ...validConfig, dataPattern: dp }).valid).toBe(true);
    }
    for (const classification of ["secret", "PUBLIC", "Internal", ""]) {
      const dp = { ...validConfig.dataPattern, classification };
      const result = validateAppMetadata({ ...validConfig, dataPattern: dp });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === "dataPattern.classification")).toBe(true);
      }
    }
  });

  it("collects all errors at once", () => {
    const result = validateAppMetadata({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Should report errors for name, owner, domainBoundary, runtimePattern,
      // lifecycle, dependencies, dataPattern — at least 7 errors
      expect(result.errors.length).toBeGreaterThanOrEqual(7);
    }
  });

  it("defaults aiGenerated to false if missing", () => {
    const { aiGenerated: _, ...noAi } = validConfig;
    const result = validateAppMetadata(noAi);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.aiGenerated).toBe(false);
    }
  });

  it("defaults aiTools to [] if missing", () => {
    const { aiTools: _, ...noTools } = validConfig;
    const result = validateAppMetadata(noTools);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.aiTools).toEqual([]);
    }
  });

  it("validates aiTools items are strings", () => {
    const result = validateAppMetadata({ ...validConfig, aiTools: [42, true] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.startsWith("aiTools"))).toBe(true);
    }
  });

  it("rejects non-object input", () => {
    const result = validateAppMetadata("not an object");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0].field).toBe("root");
    }
  });

  it("rejects null input", () => {
    const result = validateAppMetadata(null);
    expect(result.valid).toBe(false);
  });

  it("accepts config with aiGenerated true and aiTools populated", () => {
    const result = validateAppMetadata({
      ...validConfig,
      aiGenerated: true,
      aiTools: ["example-tool-a", "example-tool-b"],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.aiGenerated).toBe(true);
      expect(result.data.aiTools).toEqual(["example-tool-a", "example-tool-b"]);
    }
  });
});

// ── Provenance (birth certificate) ───────────────────────────

const validProvenance = {
  harnessVersion: "0.1.0",
  engine: "example-engine",
  model: "example-model",
  specHash: `sha256:${"a".repeat(64)}`,
  generatedAt: "2026-07-03T12:00:00Z",
  runReport: "ai-generation/runs/test-app-2026-07-03.json",
  reviewTier: "heightened",
  validation: {
    configValid: true,
    testsPassed: true,
    coveragePercent: 82.5,
    securityScanPassed: true,
  },
  lineage: { generation: 1 },
};

describe("provenance", () => {
  it("accepts a config without provenance (hand-written apps)", () => {
    const result = validateAppMetadata(validConfig);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance).toBeUndefined();
    }
  });

  it("accepts a fully-declared provenance block", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: validProvenance,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance?.engine).toBe("example-engine");
      expect(result.data.provenance?.validation.coveragePercent).toBe(82.5);
    }
  });

  it("rejects a partial provenance block — no partial birth certificates", () => {
    const { model: _, ...noModel } = validProvenance;
    const result = validateAppMetadata({ ...validConfig, provenance: noModel });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.model")).toBe(true);
    }
  });

  it("rejects a malformed specHash", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...validProvenance, specHash: "sha256:short" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.specHash")).toBe(true);
    }
  });

  it("rejects a non-ISO generatedAt", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...validProvenance, generatedAt: "yesterday" },
    });
    expect(result.valid).toBe(false);
  });

  it("enforces heightened review tier for owned-data apps by schema", () => {
    // validConfig owns data; a "standard" tier in its birth certificate must fail.
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...validProvenance, reviewTier: "standard" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.field === "provenance.reviewTier")
      ).toBe(true);
    }
  });

  it("accepts standard review tier for consume-tier apps", () => {
    const consume = {
      ...validConfig,
      dataPattern: {
        storage: "none",
        ownership: "consume",
        classification: "internal",
        retention: "90d",
        auditRequired: false,
      },
    };
    const result = validateAppMetadata({
      ...consume,
      provenance: { ...validProvenance, reviewTier: "standard" },
    });
    expect(result.valid).toBe(true);
  });

  it("enforces heightened review tier when classification is restricted/confidential — classification never lowers a tier", () => {
    for (const classification of ["restricted", "confidential"]) {
      const consume = {
        ...validConfig,
        dataPattern: {
          storage: "none",
          ownership: "consume",
          classification,
          retention: "90d",
          auditRequired: false,
        },
      };
      const rejected = validateAppMetadata({
        ...consume,
        provenance: { ...validProvenance, reviewTier: "standard" },
      });
      expect(rejected.valid).toBe(false);
      if (!rejected.valid) {
        expect(rejected.errors.some((e) => e.field === "provenance.reviewTier")).toBe(true);
      }
      const accepted = validateAppMetadata({
        ...consume,
        provenance: { ...validProvenance, reviewTier: "heightened" },
      });
      expect(accepted.valid).toBe(true);
    }
  });

  it("allows over-routing: a standard-derivation charter may still carry a heightened tier", () => {
    const consume = {
      ...validConfig,
      dataPattern: {
        storage: "none",
        ownership: "consume",
        classification: "internal",
        retention: "90d",
        auditRequired: false,
      },
    };
    const result = validateAppMetadata({
      ...consume,
      provenance: { ...validProvenance, reviewTier: "heightened" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects out-of-range coveragePercent", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: {
        ...validProvenance,
        validation: { ...validProvenance.validation, coveragePercent: 101 },
      },
    });
    expect(result.valid).toBe(false);
  });
});

// ── Regeneration lineage (the version chain) ─────────────────

describe("lineage", () => {
  const predecessor = {
    generation: 1,
    runReport: "ai-generation/runs/test-app-2026-07-03.json",
    specHash: `sha256:${"c".repeat(64)}`,
    generatedAt: "2026-07-03T12:00:00Z",
  };
  const gen2Lineage = {
    generation: 2,
    predecessor,
    reason: "platform version bump — regenerate against the new capability schema",
  };
  const withLineage = (lineage: unknown) => ({
    ...validConfig,
    provenance: { ...validProvenance, lineage },
  });

  it("accepts the generation-1 backfill shape (no predecessor, no reason)", () => {
    const result = validateAppMetadata(withLineage({ generation: 1 }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance?.lineage.generation).toBe(1);
      expect(result.data.provenance?.lineage.predecessor).toBeUndefined();
      expect(result.data.provenance?.lineage.reason).toBeUndefined();
    }
  });

  it("rejects provenance without a lineage block — absence is not a valid state", () => {
    const { lineage: _, ...noLineage } = validProvenance;
    const result = validateAppMetadata({ ...validConfig, provenance: noLineage });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.lineage")).toBe(true);
    }
  });

  it("accepts a lineage block with a predecessor reference (generation 2)", () => {
    const result = validateAppMetadata(withLineage(gen2Lineage));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance?.lineage.generation).toBe(2);
      expect(result.data.provenance?.lineage.predecessor?.runReport).toBe(
        predecessor.runReport,
      );
      expect(result.data.provenance?.lineage.reason).toContain("platform version bump");
    }
  });

  it("requires the generation number to exceed the predecessor's", () => {
    // predecessor.generation 2 and 3 against generation 2: equal and higher both fail
    for (const predecessorGeneration of [2, 3]) {
      const result = validateAppMetadata(
        withLineage({
          ...gen2Lineage,
          predecessor: { ...predecessor, generation: predecessorGeneration },
        }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.field === "provenance.lineage.generation"),
        ).toBe(true);
      }
    }
  });

  it("requires a non-empty reason from generation 2 on", () => {
    const { reason: _, ...noReason } = gen2Lineage;
    const missing = validateAppMetadata(withLineage(noReason));
    expect(missing.valid).toBe(false);
    if (!missing.valid) {
      expect(missing.errors.some((e) => e.field === "provenance.lineage.reason")).toBe(true);
    }
    const empty = validateAppMetadata(withLineage({ ...gen2Lineage, reason: "   " }));
    expect(empty.valid).toBe(false);
  });

  it("rejects a reason on generation 1 — there is nothing to explain", () => {
    const result = validateAppMetadata(
      withLineage({ generation: 1, reason: "should not be here" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.lineage.reason")).toBe(true);
    }
  });

  it("rejects a predecessor on generation 1 — a first generation regenerates nothing", () => {
    const result = validateAppMetadata(
      withLineage({ generation: 1, predecessor }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.field === "provenance.lineage.predecessor"),
      ).toBe(true);
    }
  });

  it("requires a predecessor from generation 2 on", () => {
    const { predecessor: _, ...noPredecessor } = gen2Lineage;
    const result = validateAppMetadata(withLineage(noPredecessor));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.field === "provenance.lineage.predecessor"),
      ).toBe(true);
    }
  });

  it("rejects a partial predecessor reference — the chain must be resolvable", () => {
    const { runReport: _, ...noRunReport } = predecessor;
    const result = validateAppMetadata(
      withLineage({ ...gen2Lineage, predecessor: noRunReport }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.field === "provenance.lineage.predecessor.runReport"),
      ).toBe(true);
    }
  });

  it("rejects non-positive and non-integer generation numbers", () => {
    for (const generation of [0, -1, 1.5]) {
      const result = validateAppMetadata(withLineage({ generation }));
      expect(result.valid).toBe(false);
    }
  });

  it("accepts a retro-certified predecessor reference (specHash none)", () => {
    const result = validateAppMetadata(
      withLineage({
        ...gen2Lineage,
        predecessor: { ...predecessor, specHash: "none" },
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("retro-certified provenance", () => {
  const retroProvenance = {
    ...validProvenance,
    model: "unrecorded (pre-harness)",
    specHash: "none",
    retroCertified: true,
  };

  it("accepts specHash none when retroCertified", () => {
    const result = validateAppMetadata({ ...validConfig, provenance: retroProvenance });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance?.retroCertified).toBe(true);
      expect(result.data.provenance?.specHash).toBe("none");
    }
  });

  it("rejects specHash none without retroCertified — no silent backfills", () => {
    const { retroCertified: _, ...sneaky } = retroProvenance;
    const result = validateAppMetadata({ ...validConfig, provenance: sneaky });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.specHash")).toBe(true);
    }
  });

  it("still accepts a real specHash alongside retroCertified", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...retroProvenance, specHash: `sha256:${"b".repeat(64)}` },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects retroCertified: false (the field is present-or-absent, never false)", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...retroProvenance, retroCertified: false },
    });
    expect(result.valid).toBe(false);
  });

  it("requires runReport on pipeline provenance — the capture pointer is not optional", () => {
    const { runReport: _, ...noPointer } = validProvenance;
    const result = validateAppMetadata({ ...validConfig, provenance: noPointer });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.runReport")).toBe(true);
    }
  });

  it("allows retro-certified provenance to omit runReport — retro apps have no run", () => {
    const { runReport: _, ...rest } = retroProvenance;
    const result = validateAppMetadata({ ...validConfig, provenance: rest });
    expect(result.valid).toBe(true);
  });

  it("keeps the owned-data heightened rule on retro-certified provenance", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...retroProvenance, reviewTier: "standard" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "provenance.reviewTier")).toBe(true);
    }
  });
});

describe("provenance translation-origin reference", () => {
  it("accepts provenance carrying translationRunReport", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: {
        ...validProvenance,
        translationRunReport: "ai-generation/runs/sample-2026-07-04.json",
      },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provenance?.translationRunReport).toBe(
        "ai-generation/runs/sample-2026-07-04.json",
      );
    }
  });

  it("rejects an empty translationRunReport — claim something or claim nothing", () => {
    const result = validateAppMetadata({
      ...validConfig,
      provenance: { ...validProvenance, translationRunReport: "  " },
    });
    expect(result.valid).toBe(false);
  });
});

describe("charter capabilities block (declared shared-capability config)", () => {
  it("accepts a charter with no capabilities block — absence is never an error", () => {
    const result = validateAppMetadata(validConfig);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.capabilities).toBeUndefined();
  });

  it("accepts a valid capabilities block and carries it through as data", () => {
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: {
        cache: { backend: "redis", keyPrefix: "test:", defaultTtlSeconds: 300 },
        "feature-flags": { flags: { "beta-ui": { enabled: true } } },
        "data-access": { backend: "postgres", tables: ["test_entities"] },
      },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.capabilities?.cache?.keyPrefix).toBe("test:");
      expect(result.data.capabilities?.["data-access"]?.tables).toEqual(["test_entities"]);
    }
  });

  it("rejects capability config violating its pinned schema, naming the field", () => {
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: { cache: { backend: "memory", defaultTtlSeconds: -5 } },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "capabilities.cache.defaultTtlSeconds")).toBe(
        true,
      );
    }
  });

  it("rejects config on a presence-only capability — presence is the whole claim", () => {
    // Pre-backlog-4 this failed as an unknown capability key; now identity is
    // declarable (presence-only), and smuggled config fails on the empty
    // strict object instead. Same outcome, more precise error.
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: { identity: { issuer: "https://idp.example" } },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.startsWith("capabilities.identity"))).toBe(true);
    }
  });

  it("accepts presence-only entries for the non-config capabilities", () => {
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: {
        identity: {},
        config: {},
        observability: {},
        resilience: {},
        lifecycle: {},
      },
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.capabilities?.identity).toEqual({});
  });

  it("rejects a capability outside the pinned key set", () => {
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: { "secret-rotation": {} },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a connection secret smuggled into capability config", () => {
    const result = validateAppMetadata({
      ...validConfig,
      capabilities: {
        cache: { backend: "redis", url: "redis://user:secret@prod:6379" },
      },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("url"))).toBe(true);
    }
  });
});

describe("charter integrations block (declared external systems)", () => {
  const liveEntry = {
    name: "stats-api",
    hosts: ["stats.example.org"],
    credentials: ["stats-api-key"],
    cadence: "scheduled",
    schedule: "0 6 * * 1",
    note: "weekly; env override MIRROR_SCHEDULE_CRON",
    mode: "live",
  };
  const stubbedEntry = {
    name: "core-ledger",
    hosts: ["core-ledger-stub"],
    credentials: [],
    cadence: "on-demand",
    mode: "stubbed",
  };

  it("accepts a charter with no integrations block — absence is never a schema error", () => {
    const result = validateAppMetadata(validConfig);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.integrations).toBeUndefined();
  });

  it("accepts live and stubbed entries and carries them through as data", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [liveEntry, stubbedEntry],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.integrations).toHaveLength(2);
      expect(result.data.integrations?.[0].hosts).toEqual(["stats.example.org"]);
      expect(result.data.integrations?.[1].mode).toBe("stubbed");
      expect(result.data.integrations?.[1].credentials).toEqual([]);
    }
  });

  it("rejects an empty integrations block as dead config", () => {
    const result = validateAppMetadata({ ...validConfig, integrations: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("dead config"))).toBe(true);
    }
  });

  it("rejects a credential VALUE where a reference name belongs", () => {
    for (const value of [
      "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
      "https://user:secret@api.example.com",
      "AKIA0000000000EXAMPLE",
      "key=abc123",
    ]) {
      const result = validateAppMetadata({
        ...validConfig,
        integrations: [{ ...liveEntry, credentials: [value] }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.message.includes("never a credential value")),
        ).toBe(true);
      }
    }
  });

  it("rejects a host carrying scheme, port, or path — hosts are bare hostnames", () => {
    for (const host of [
      "https://stats.example.org",
      "stats.example.org:443",
      "stats.example.org/data",
    ]) {
      const result = validateAppMetadata({
        ...validConfig,
        integrations: [{ ...liveEntry, hosts: [host] }],
      });
      expect(result.valid).toBe(false);
    }
  });

  it("rejects an entry with no hosts", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...liveEntry, hosts: [] }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a mode outside live|stubbed", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...stubbedEntry, mode: "mocked" }],
    });
    expect(result.valid).toBe(false);
  });

  it("requires schedule when cadence is scheduled, rejects it when on-demand", () => {
    const { schedule: _dropped, ...scheduledWithoutSchedule } = liveEntry;
    expect(
      validateAppMetadata({
        ...validConfig,
        integrations: [scheduledWithoutSchedule],
      }).valid,
    ).toBe(false);
    expect(
      validateAppMetadata({
        ...validConfig,
        integrations: [{ ...stubbedEntry, schedule: "0 6 * * 1" }],
      }).valid,
    ).toBe(false);
  });

  it("rejects prose in schedule — the field is a bare cron expression, prose goes in note", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [
        { ...liveEntry, schedule: "weekly (cron 0 6 * * 1, env MIRROR_SCHEDULE_CRON)" },
      ],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("bare cron expression"))).toBe(true);
    }
  });

  it("rejects duplicate integration names", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [liveEntry, { ...liveEntry, hosts: ["other.example.org"] }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("unique"))).toBe(true);
    }
  });

  it("rejects unknown fields — the contract is strict", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...liveEntry, url: "https://stats.example.org" }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts hostsFrom — the deploy-resolved env-reference form", () => {
    const { hosts: _dropped, ...rest } = stubbedEntry;
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...rest, hostsFrom: "DMS_API_URL", mode: "live" }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.integrations?.[0].hostsFrom).toBe("DMS_API_URL");
  });

  it("rejects an entry declaring BOTH hosts and hostsFrom — one source of truth per surface", () => {
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...stubbedEntry, hostsFrom: "CORE_SYSTEM_URL" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("never both"))).toBe(true);
    }
  });

  it("rejects an entry declaring NEITHER hosts nor hostsFrom", () => {
    const { hosts: _dropped, ...rest } = stubbedEntry;
    const result = validateAppMetadata({ ...validConfig, integrations: [rest] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("declare the outbound surface"))).toBe(
        true,
      );
    }
  });

  it("rejects a hostsFrom that is not an env-var name", () => {
    const { hosts: _dropped, ...rest } = stubbedEntry;
    const result = validateAppMetadata({
      ...validConfig,
      integrations: [{ ...rest, hostsFrom: "https://real.example.org" }],
    });
    expect(result.valid).toBe(false);
  });
});
