import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { qualityQuery } from "@/lib/api/queries";
import { DATA_AS_OF } from "@/lib/mock/data";
import { Card, Meter, PageHeader, ScorePill, StatCard, SyntheticBanner } from "@/components/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/data-quality")({
  head: () => ({
    meta: [
      { title: "Data Quality — ClearCost Boston" },
      { name: "description", content: "Completeness, missing prices, outliers, freshness and comparability of hospital pricing files." },
      { property: "og:title", content: "Data Quality — ClearCost Boston" },
      { property: "og:description", content: "How complete, fresh and comparable each hospital's pricing data is." },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(qualityQuery()),
  component: QualityPage,
});

function QualityPage() {
  const { data } = useSuspenseQuery(qualityQuery());
  const rows = [...data].sort((a, b) => b.comparability - a.comparability);
  const avg = (f: (x: (typeof data)[number]) => number) => Math.round(data.reduce((a, x) => a + f(x), 0) / data.length);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Data Quality" title="Data quality dashboard" description={`How complete, fresh and comparable each hospital's published pricing file is. Reference date ${DATA_AS_OF}.`} />
      <SyntheticBanner />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="primary" label="Avg. comparability" value={`${avg((x) => x.comparability)}/100`} />
        <StatCard label="Avg. completeness" value={`${avg((x) => x.completeness)}%`} />
        <StatCard label="Missing records" value={data.reduce((a, x) => a + x.missingCount, 0)} hint="Across all hospitals" />
        <StatCard label="Outliers flagged" value={data.reduce((a, x) => a + x.outlierCount, 0)} hint="Cash prices, default setting" />
      </div>
      <Card title="Hospital data quality" subtitle="Sorted by comparability score">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Hospital</th>
                <th className="px-3 py-2.5 font-medium">Completeness</th>
                <th className="px-3 py-2.5 text-right font-medium">Missing</th>
                <th className="px-3 py-2.5 text-right font-medium">Outliers</th>
                <th className="px-3 py-2.5 font-medium">Freshness</th>
                <th className="px-3 py-2.5 font-medium">Comparability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hospital.id} className="border-b last:border-0 hover:bg-muted/60">
                  <td className="px-3 py-2.5">
                    <Link to="/hospitals/$hospitalId" params={{ hospitalId: r.hospital.id }} className="font-medium hover:text-primary">{r.hospital.name}</Link>
                    <div className="text-xs text-muted-foreground">{r.hospital.sourceFormat} · published {r.hospital.lastPublished}</div>
                  </td>
                  <td className="px-3 py-2.5"><Meter value={r.completeness} /></td>
                  <td className="num px-3 py-2.5 text-right">{r.missingCount}</td>
                  <td className={cn("num px-3 py-2.5 text-right", r.outlierCount > 0 && "font-semibold text-destructive")}>{r.outlierCount}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={cn("inline-flex items-center gap-1.5", r.daysSinceRetrieved > 30 ? "text-warning-foreground" : "text-foreground")}>
                      <span className={cn("h-2 w-2 rounded-full", r.daysSinceRetrieved > 30 ? "bg-warning" : "bg-success")} />
                      Retrieved {r.hospital.lastRetrieved} · {r.daysSinceRetrieved}d
                    </span>
                  </td>
                  <td className="px-3 py-2.5"><ScorePill score={r.comparability} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">Scores are preliminary. See the <Link to="/methodology" className="text-primary hover:underline">methodology</Link> for how they will be calculated.</p>
    </div>
  );
}
