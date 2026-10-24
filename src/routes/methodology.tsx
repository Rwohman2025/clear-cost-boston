import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Prose } from "@/components/common";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — ClearCost Boston" },
      { name: "description", content: "How ClearCost cleans, compares, and explains hospital pricing data." },
      { property: "og:title", content: "Methodology — ClearCost Boston" },
      { property: "og:description", content: "How ClearCost Boston will normalize and compare hospital price data." },
    ],
  }),
  component: Methodology,
});

const STEPS = [
  ["Ingest", "Download each hospital's machine-readable CSV/JSON file; store the source URL and retrieval timestamp."],
  ["Normalize", "Map codes to CPT/HCPCS, standardize descriptions, hospital identities, settings, price types and payer/plan names."],
  ["Validate", "Detect missing amounts, malformed rows, duplicate entries and implausible values."],
  ["Analyze", "Compute min, max, median, IQR, spread and coefficient of variation; flag outliers."],
  ["Publish", "Serve comparable procedure-level prices through versioned API endpoints."],
];

function Methodology() {
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Methodology" description="How ClearCost standardizes hospital pricing files for fairer comparisons." />
      <div className="mb-8 grid gap-3 md:grid-cols-5">
        {STEPS.map(([t, d], i) => (
          <Card key={t} className="card-hover">
            <div className="num text-xs text-primary">0{i + 1}</div>
            <div className="mt-1 text-sm font-semibold">{t}</div>
            <p className="mt-1 text-xs text-muted-foreground">{d}</p>
          </Card>
        ))}
      </div>
      <Prose>
        <h2>Statistics</h2>
        <p>For each procedure, price type, setting and (where relevant) payer, we compute the <strong>minimum, maximum, median</strong>, interquartile range, <strong>spread ratio</strong> (max ÷ min) and <strong>coefficient of variation</strong> (standard deviation ÷ mean). Outliers are values more than 1.5× the IQR beyond the first or third quartile (Tukey fences).</p>
        <h2>Data quality and comparability scores</h2>
        <p><strong>Completeness</strong> is the share of expected records (procedure × price type × payer) that contain a usable amount. <strong>Freshness</strong> reflects the age of the hospital's published file. The preliminary <strong>comparability score</strong> (0–100) weights completeness 60%, freshness 30% and file format/structure 10%. Weights will be revised once real files are analyzed.</p>
        <h2>Comparison limitations</h2>
        <p>Hospitals bundle services differently: one MRI price may include the radiologist's reading, another may not. Inpatient prices may be per-case or per-diem. Payer names and plan tiers are inconsistent across files. Until normalization accounts for these differences, comparisons should be treated as directional, not exact.</p>
        <p>Published prices are not patient bills, and nothing on this site is a guarantee of cost.</p>
      </Prose>
    </div>
  );
}
