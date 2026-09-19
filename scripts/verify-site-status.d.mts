import type { StatusClaimEntry } from "./check-status-claims.mjs";

export interface StatusMap {
  claims: StatusClaimEntry[];
}
export interface AttestedClaim {
  claim: string;
  status: "shipped" | "in-progress";
  pass: boolean;
  detail?: string;
}
export interface StatusAttestation {
  schema: number;
  platformCommit: string;
  generatedAt: string;
  allPassed: boolean;
  total: number;
  claims: AttestedClaim[];
  pageMapFailures: string[];
}
export const MAX_ATTESTATION_AGE_DAYS: number;
export function pageMapProblems(
  page: { shipped: string[]; "in-progress": string[] },
  map: StatusMap,
  mapPath?: string,
): string[];
export function localClaimResults(map: StatusMap, cwd?: string): { verified: string[]; problems: string[] };
export function attestationProblems(attestation: unknown, map: StatusMap, now?: Date): string[];
export function verifySiteStatus(opts?: {
  htmlPath?: string;
  mapPath?: string;
  attestationPath?: string;
  cwd?: string;
  now?: Date;
}): { problems: string[]; verifiedLocally: string[]; total: number; attestation: StatusAttestation | null };
