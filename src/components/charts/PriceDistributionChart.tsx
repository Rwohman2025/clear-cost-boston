import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PriceStats } from "@/lib/models/types";
import { formatUSD } from "@/lib/stats";

/** Histogram + box summary of the price distribution. */
export function PriceDistributionChart({ values, stats, bins = 6 }: { values: number[]; stats: PriceStats; bins?: number }) {
  const width = (stats.max - stats.min) / bins || 1;
  const data = Array.from({ length: bins }, (_, i) => {
    const lo = stats.min + i * width;
    const hi = lo + width;
    return { label: formatUSD(lo), range: `${formatUSD(lo)} – ${formatUSD(hi)}`, count: values.filter((v) => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length };
  });
  const pos = (v: number) => `${((v - stats.min) / (stats.max - stats.min || 1)) * 100}%`;
  return (
    <div>
      <div className="h-[180px]">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              labelFormatter={(_, p) => p?.[0]?.payload?.range} formatter={(v: number) => [v, "Hospitals"]} />
            <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4">
        <div className="relative h-6">
          <div className="absolute top-1/2 h-px w-full bg-border" />
          <div className="absolute top-1 h-4 rounded bg-primary/20 ring-1 ring-primary/40" style={{ left: pos(stats.p25), width: `calc(${pos(stats.p75)} - ${pos(stats.p25)})` }} />
          <div className="absolute top-0 h-6 w-0.5 bg-navy" style={{ left: pos(stats.median) }} />
        </div>
        <div className="num mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatUSD(stats.min)}</span><span>Middle half: {formatUSD(stats.p25)}–{formatUSD(stats.p75)}</span><span>{formatUSD(stats.max)}</span>
        </div>
      </div>
    </div>
  );
}
