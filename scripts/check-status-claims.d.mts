export type StatusClaimRepo = "spec" | "platform";
export interface StatusClaimEntry {
  claim: string;
  repo: StatusClaimRepo;
  status: "shipped" | "in-progress";
  verify: { paths?: string[]; command?: string };
  why?: string;
  note?: string;
}
export function pageClaims(html: string, htmlPath?: string): { shipped: string[]; "in-progress": string[] };
export const REPOS: readonly StatusClaimRepo[];
export function verdict(entry: StatusClaimEntry, cwd?: string, specRoot?: string): { ok: boolean; detail?: string };
export function checkStatusClaims(opts?: { htmlPath?: string; mapPath?: string; cwd?: string; specRoot?: string }): {
  failures: string[];
  lines: string[];
  total: number;
};
