import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { hospitalsQuery, qualityQuery } from "@/lib/api/queries";
import { EmptyState, ErrorState, LoadingState, PageHeader, ScorePill, SyntheticBanner } from "@/components/common";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/hospitals/")({
  head: () => ({
    meta: [
      { title: "Hospital Directory — ClearCost Boston" },
      { name: "description", content: "Browse greater Boston hospitals, their pricing file coverage and data quality (synthetic demo data)." },
      { property: "og:title", content: "Hospital Directory — ClearCost Boston" },
      { property: "og:description", content: "Searchable directory of Boston-area hospitals and their price transparency files." },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(hospitalsQuery()), queryClient.ensureQueryData(qualityQuery())]),
  component: Directory,
});

function Directory() {
  const [q, setQ] = useState("");
  const list = useQuery({ ...hospitalsQuery(q), placeholderData: keepPreviousData });
  const { data: quality } = useSuspenseQuery(qualityQuery());
  const score = (id: string) => quality.find((x) => x.hospital.id === id);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Hospitals" title="Hospital directory" description="Pricing file coverage and source details for each hospital in the demo dataset." />
      <SyntheticBanner />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city or neighborhood" className="h-10 bg-card pl-9" />
      </div>
      {list.isError ? <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
        : !list.data ? <LoadingState />
        : list.data.length === 0 ? <EmptyState title="No hospitals found" description={`Nothing matches "${q}".`} />
        : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map((h) => {
              const s = score(h.id);
              return (
                <Link key={h.id} to="/hospitals/$hospitalId" params={{ hospitalId: h.id }} className="card-surface card-hover group block p-5 animate-rise">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug group-hover:text-primary">{h.name}</div>
                      <div className="text-xs text-muted-foreground">{h.neighborhood}, {h.city}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Type</div><div className="mt-0.5 font-medium">{h.type.replace(" hospital", "").replace(" medical center", "")}</div></div>
                    <div><div className="text-muted-foreground">Beds</div><div className="num mt-0.5 font-medium">{h.beds}</div></div>
                    <div><div className="text-muted-foreground">Coverage</div><div className="num mt-0.5 font-medium">{s?.completeness ?? "—"}%</div></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>{h.sourceFormat} file · retrieved {h.lastRetrieved}</span>
                    {s && <ScorePill score={s.comparability} />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
