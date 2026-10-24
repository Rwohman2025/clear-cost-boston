import type { Hospital } from "@/lib/models/types";

const familiarNames: Record<string, string> = {
  bidmc: "Beth Israel Deaconess",
  mgh: "Mass General",
  bwh: "Brigham and Women’s",
};

/** A readable chart label while preserving full legal names in directories and records. */
export function hospitalChartName(hospital: Pick<Hospital, "id" | "name">) {
  return familiarNames[hospital.id] ?? hospital.name
    .replace(/\s+(Medical Center|Hospital)$/i, "")
    .replace(/\s+Health Center$/i, "");
}
