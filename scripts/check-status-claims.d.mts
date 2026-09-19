export interface StatusClaimEntry {
  claim: string;
  status: "shipped" | "in-progress";
  verify: { paths?: string[]; command?: string };
  why?: string;
  note?: string;
}
export function pageClaims(html: string, htmlPath?: string): { shipped: string[]; "in-progress": string[] };
export function verdict(entry: StatusClaimEntry, cwd?: string): { ok: boolean; detail?: string };
export function checkStatusClaims(opts?: { htmlPath?: string; mapPath?: string; cwd?: string }): {
  failures: string[];
  lines: string[];
  total: number;
};
