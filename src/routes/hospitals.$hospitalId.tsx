import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { hospitalPricesQuery, hospitalQuery, qualityQuery } from "@/lib/api/queries";
import { formatUSD } from "@/lib/stats";
import { Card, Meter, PageHeader, StatCard, SyntheticBanner } from "@/components/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hospitals/$hospitalId")({
  loader: async ({ context: { queryClient }, params }) => {
    const hospital = await queryClient.ensureQueryData(hospitalQuery(params.hospitalId));
    if (!hospital) throw notFound();
    await Promise.all([queryClient.ensureQueryData(hospitalPricesQuery(params.hospitalId)), queryClient.ensureQueryData(qualityQuery())]);
    return { name: hospital.name };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — ClearCost Boston` },
          { name: "description", content: `Pricing coverage, data sources and price comparisons for ${loaderData.name} (published hospital prices).` },
          { property: "og:title", content: `${loaderData.name} — ClearCost Boston` },
          { property: "og:description", content: `Hospital profile for ${loaderData.name}.` },
        ]
      : [{ title: "Hospital unavailable — ClearCost Boston" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Hospital not found</h1>
      <Link to="/hospitals" className="mt-3 inline-block text-sm text-primary hover:underline">Back to directory</Link>
    </div>
  ),
  component: HospitalPage,
});

function HospitalPage() {
  const { hospitalId } = Route.useParams();
  const { data: hospital } = useSuspenseQuery(hospitalQuery(hospitalId));
  const { data: prices } = useSuspenseQuery(hospitalPricesQuery(hospitalId));
  const { data: quality } = useSuspenseQuery(qualityQuery());
  const q = quality.find((x) => x.hospital.id === hospitalId)!;
  if (!hospital) return null;
  const chart = prices
    .filter((p) => p.cash != null && p.marketCashMedian && p.procedure.category === "Imaging")
    .map((p) => ({ name: p.procedure.code, hospital: p.cash, market: Math.round(p.marketCashMedian!) }));
  const published = prices.filter((p) => p.cash != null || p.gross != null).length;

  return (
    <div className="space-y-5">
      <Link to="/hospitals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />All hospitals</Link>
      <PageHeader eyebrow={hospital.type} title={hospital.name} description={`${hospital.neighborhood}, ${hospital.city}${hospital.beds != null ? ` · ${hospital.beds} beds` : ""}`} />
      <SyntheticBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="primary" label="Procedures with prices" value={`${published}/${prices.length}`} hint="Procedures tracked for this hospital" />
        <StatCard label="Price-file completeness" value={`${q.completeness}%`} hint="How much of the tracked price data is available" />
        <StatCard label="Missing price entries" value={q.missingCount} hint="Entries not listed in the file" />
        <StatCard label="Prices far from others" value={q.outlierCount} hint="Listed prices that stand apart" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Imaging cash prices compared with other hospitals" subtitle="This hospital (blue) beside the typical listed price at other hospitals (navy)">
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatUSD(v)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: number) => formatUSD(v)} />
                <Bar dataKey="hospital" name="This hospital" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="market" name="Typical at other hospitals" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Data source">
          <dl className="space-y-3 text-xs">
            <Row k="File format" v={hospital.sourceFormat} />
            <Row k="Hospital last published" v={hospital.lastPublished} />
            <Row k="Last retrieved" v={`${hospital.lastRetrieved} (${q.daysSinceRetrieved}d ago)`} />
            <div><dt className="text-muted-foreground">Completeness</dt><dd className="mt-1"><Meter value={q.completeness} /></dd></div>
            <div>
              <dt className="text-muted-foreground">Price file source</dt>
              <dd className="mt-1 break-all">{/^https?:\/\//.test(hospital.sourceUrl)
                ? <a href={hospital.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{hospital.sourceUrl}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                : <span>{hospital.sourceUrl}</span>}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Available pricing" subtitle="Prices listed by this hospital. Negotiated price is the middle rate across insurers.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Procedure</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross charge</th>
                <th className="px-3 py-2.5 text-right font-medium">Cash price</th>
                <th className="px-3 py-2.5 text-right font-medium">Typical negotiated price</th>
                <th className="px-3 py-2.5 text-right font-medium">Cash compared with others</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => {
                const diff = p.cash != null && p.marketCashMedian ? ((p.cash - p.marketCashMedian) / p.marketCashMedian) * 100 : null;
                return (
                  <tr key={p.procedure.code} className="border-b last:border-0 hover:bg-muted/60">
                    <td className="px-3 py-2.5"><span className="num mr-2 text-xs text-muted-foreground">{p.procedure.code}</span>{p.procedure.name}</td>
                    <td className="num px-3 py-2.5 text-right">{formatUSD(p.gross)}</td>
                    <td className="num px-3 py-2.5 text-right font-medium">{formatUSD(p.cash)}</td>
                    <td className="num px-3 py-2.5 text-right">{formatUSD(p.negotiatedMedian)}</td>
                    <td className={cn("num px-3 py-2.5 text-right text-xs", diff == null ? "text-muted-foreground" : diff > 0 ? "text-destructive" : "text-success")}>
                      {diff == null ? "Not published" : `${Math.abs(Math.round(diff))}% ${diff > 0 ? "higher" : diff < 0 ? "lower" : "the same"}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Prices come from the hospital’s published machine-readable price file.</p>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="num text-right font-medium">{v}</dd></div>;
}
