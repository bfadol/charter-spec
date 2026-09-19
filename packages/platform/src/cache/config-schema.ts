/**
 * Cache capability — declared-config contract.
 *
 * Pinned from the real option surface of `createCache()` (factory.ts /
 * types.ts): this is what an app's charter.yaml `capabilities.cache` block
 * may declare. Strict: unknown fields are rejected.
 *
 * The Redis connection URL is deliberately NOT declarable. It comes from
 * REDIS_URL at runtime — a committed charter must never carry a connection
 * secret, so `url` fails validation as an unknown field.
 */
import { z } from "zod";

export const cacheConfigSchema = z.strictObject({
  /** Which backend the app wires — the load-bearing choice, so required. */
  backend: z.enum(["redis", "memory", "none"] as const),
  /** Key prefix to namespace entries, e.g. "doc-status:". */
  keyPrefix: z.string().trim().min(1).optional(),
  /** Default TTL in seconds when set() omits one. 0 = no expiry. */
  defaultTtlSeconds: z.number().int().min(0).optional(),
});

export type CacheConfig = z.infer<typeof cacheConfigSchema>;
