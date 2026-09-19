/**
 * Data-access capability — declared-config contract.
 *
 * Pinned from the real option surface of `createRepository()` /
 * `createIdempotencyStore()` (factory.ts): this is what an app's charter.yaml
 * `capabilities.data-access` block may declare — one `tables` entry per
 * repository the app creates. Strict: unknown fields are rejected.
 *
 * The connection string is deliberately NOT declarable. It comes from
 * DATABASE_URL at runtime — a committed charter must never carry a connection
 * secret, so `connectionString` fails validation as an unknown field.
 */
import { z } from "zod";

/** Same pattern PostgresRepository enforces at runtime — it interpolates the name into SQL. */
const tableNameSchema = z
  .string()
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "must be a SQL identifier (letters, digits, underscore; not starting with a digit)",
  );

export const dataAccessConfigSchema = z.strictObject({
  /** Which backend the app wires — the load-bearing choice, so required. */
  backend: z.enum(["memory", "postgres"] as const),
  /** Owned tables, one per repository the app creates. */
  tables: z
    .array(tableNameSchema)
    .min(1, "declare at least one owned table")
    .refine((ts) => new Set(ts).size === ts.length, {
      message: "table names must be unique",
    }),
  /** Present when the app uses an idempotency store. */
  idempotency: z.strictObject({ table: tableNameSchema }).optional(),
});

export type DataAccessConfig = z.infer<typeof dataAccessConfigSchema>;
