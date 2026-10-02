export type StatusClaimRepo = "spec" | "platform" | "record";
export interface StatusClaimPart {
  repo: StatusClaimRepo;
  paths?: string[];
  command?: string;
}
export interface StatusClaimEntry {
  claim: string;
  repo: StatusClaimRepo;
  status: "shipped" | "in-progress";
  verify: { paths?: string[]; command?: string };
  /** Further evidence parts in other repositories; every part must hold. */
  also?: StatusClaimPart[];
  why?: string;
  note?: string;
}
export function pageClaims(html: string, htmlPath?: string): { shipped: string[]; "in-progress": string[] };
export const REPOS: readonly StatusClaimRepo[];
export const REPO_NAMES: string;
export function entryParts(entry: StatusClaimEntry): StatusClaimPart[] | null;
export function partVerdict(part: StatusClaimPart, status: StatusClaimEntry["status"], root: string): { ok: boolean; detail?: string };
export function verdict(entry: StatusClaimEntry, cwd?: string, specRoot?: string, recordRoot?: string): { ok: boolean; detail?: string };
export function checkStatusClaims(opts?: { htmlPath?: string; mapPath?: string; cwd?: string; specRoot?: string; recordRoot?: string }): {
  failures: string[];
  lines: string[];
  total: number;
};
