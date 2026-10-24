import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { DEFAULT_FILTERS as DEFAULT, comparisonQuery, hospitalsQuery, payersQuery, proceduresQuery } from "@/lib/api/queries";
import type { PriceFilters, PriceType, Setting } from "@/lib/models/types";
import { formatUSD } from "@/lib/stats";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, SyntheticBanner } from "@/components/common";
import { ProcedureSearch } from "@/components/explorer/ProcedureSearch";
import { PriceTable } from "@/components/explorer/PriceTable";
import { PriceComparisonChart } from "@/components/charts/PriceComparisonChart";
import { PriceDistributionChart } from "@/components/charts/PriceDistributionChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Procedure Explorer — ClearCost Boston" },
      { name: "description", content: "Search a procedure and compare published hospital prices across greater Boston." },
      { property: "og:title", content: "Procedure Explorer — ClearCost Boston" },
      { property: "og:description", content: "Compare published hospital prices for procedures across greater Boston." },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(proceduresQuery()),
      queryClient.ensureQueryData(hospitalsQuery()),
      queryClient.ensureQueryData(payersQuery()),
      queryClient.ensureQueryData(comparisonQuery(DEFAULT)),
    ]),
  component: Explorer,
});

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "cash", label: "Discounted cash price" },
  { value: "gross", label: "Gross charge" },
  { value: "negotiated", label: "Payer-negotiated rate" },
];

function Explorer() {
  const { data: procedures } = useSuspenseQuery(proceduresQuery());
  const { data: hospitals } = useSuspenseQuery(hospitalsQuery());
  const { data: payers } = useSuspenseQuery(payersQuery());
  const [filters, setFilters] = useState<PriceFilters>(DEFAULT);
  const [hospitalId, setHospitalId] = useState("all");
  const availableHospitalsQuery = useQuery({ ...hospitalsQuery("", filters.code), placeholderData: keepPreviousData });
  const availableHospitals = availableHospitalsQuery.data ?? hospitals;
  const effective: PriceFilters = hospitalId === "all" ? filters : { ...filters, hospitalIds: [hospitalId] };
  const q = useQuery({ ...comparisonQuery(effective), placeholderData: keepPreviousData });
  const procedure = procedures.find((p) => p.code === filters.code);
  const set = (patch: Partial<PriceFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const priceLabel = PRICE_TYPES.find((p) => p.value === filters.priceType)!.label.toLowerCase();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Procedure Explorer"
        title={procedure?.name ?? "Select a procedure"}
        description={procedure ? `${procedure.codeType} ${procedure.code} · ${procedure.category} · Comparing ${priceLabel}s across greater Boston hospitals.` : undefined}
      />
      <SyntheticBanner />

      <Card className="border-primary/20 bg-card p-4 sm:p-5">
        <div className="mb-4 text-sm text-muted-foreground">Choose a procedure and see the prices hospitals report. Start with the service, then narrow the view if you need to.</div>
        <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_minmax(28rem,1.15fr)]">
          <ProcedureSearch selected={procedure} hospitalId={hospitalId === "all" ? undefined : hospitalId} onSelect={(p) => { setHospitalId("all"); set({ code: p.code, setting: p.defaultSetting }); }} />
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect label="Hospital" value={hospitalId} onChange={setHospitalId}
              options={[{ value: "all", label: "All hospitals" }, ...availableHospitals.map((h) => ({ value: h.id, label: h.name }))]} />
            <FilterSelect label="Price type" value={filters.priceType} onChange={(v) => set({ priceType: v as PriceType })} options={PRICE_TYPES} />
            <FilterSelect label="Insurance" value={filters.payerId ?? "all"} disabled={filters.priceType !== "negotiated"}
              onChange={(v) => set({ payerId: v === "all" ? null : v })}
              options={[{ value: "all", label: "All insurers" }, ...payers.map((p) => ({ value: p.id, label: p.name }))]} />
            <FilterSelect label="Where you receive care" value={filters.setting} onChange={(v) => set({ setting: v as Setting })}
              options={[{ value: "outpatient", label: "Outpatient" }, { value: "inpatient", label: "Inpatient" }]} />
          </div>
        </div>
      </Card>

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Card><LoadingState rows={5} /></Card>
      ) : !q.data.stats ? (
        <Card>
          <EmptyState title="No published prices for this combination"
            description="None of the selected hospitals list a usable price for this procedure, price type and setting. Try another setting or price type." />
        </Card>
      ) : (
        <div className={q.isFetching ? "space-y-5 opacity-60 transition-opacity" : "space-y-5 transition-opacity"}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard tone="primary" label="Typical listed price" value={formatUSD(q.data.stats.median)} hint="The middle reported price" />
            <StatCard label="Lowest listed price" value={formatUSD(q.data.stats.min)} hint={q.data.rows.find((r) => r.amount === q.data.stats!.min)?.hospital.shortName} />
            <StatCard label="Highest listed price" value={formatUSD(q.data.stats.max)} hint={q.data.rows.find((r) => r.amount === q.data.stats!.max)?.hospital.shortName} />
            <StatCard label="Difference from low to high" value={formatUSD(q.data.stats.max - q.data.stats.min)} hint={`${q.data.stats.count} hospitals reporting`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2" title="Hospital price comparison" subtitle="Sorted from the lowest to the highest listed price.">
              <PriceComparisonChart rows={q.data.rows} stats={q.data.stats} />
            </Card>
            <div className="space-y-5">
              <Card title="Where prices cluster" subtitle="How many hospitals list prices in each price range.">
                <PriceDistributionChart values={q.data.rows.map((r) => r.amount)} stats={q.data.stats} />
              </Card>
              <Card title="What to know">
                <ul className="space-y-2.5 text-xs">
                  <QualityLine ok={q.data.missingHospitals.length === 0}
                    text={q.data.missingHospitals.length === 0 ? "Every selected hospital lists a price for this service." : `${q.data.missingHospitals.length} hospital${q.data.missingHospitals.length === 1 ? "" : "s"} did not list a usable price: ${q.data.missingHospitals.map((h) => h.shortName).join(", ")}.`} />
                  <QualityLine ok={q.data.rows.filter((r) => r.isOutlier).length === 0}
                    text={q.data.rows.filter((r) => r.isOutlier).length ? "One or more listed prices are much higher or lower than the others." : "No listed price stands far apart from the others."} />
                  <QualityLine ok={false} text="A listed hospital price may not match your final bill. Your care and insurance coverage affect what you pay." />
                </ul>
              </Card>
            </div>
          </div>

          <Card title="Hospital pricing table" subtitle="See each hospital’s listed price and how it compares with the typical listed price.">
            <PriceTable rows={q.data.rows} stats={q.data.stats} />
          </Card>
        </div>
      )}
    </div>
  );
}

function QualityLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={ok ? "mt-1 h-2 w-2 shrink-0 rounded-full bg-success" : "mt-1 h-2 w-2 shrink-0 rounded-full bg-warning"} />
      <span className="text-foreground/80">{text}</span>
    </li>
  );
}

function FilterSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange} disabled={!!disabled}>
        <SelectTrigger className="h-10 w-full bg-card text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
