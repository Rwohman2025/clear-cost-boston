import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HospitalPriceRow, PriceStats } from "@/lib/models/types";
import { formatUSD } from "@/lib/stats";

export function PriceComparisonChart({ rows, stats }: { rows: HospitalPriceRow[]; stats: PriceStats }) {
  const data = [...rows].sort((a, b) => a.amount - b.amount).map((r) => ({ name: r.hospital.shortName, amount: r.amount, outlier: r.isOutlier }));
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={(v) => formatUSD(v)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
            formatter={(v: number) => [formatUSD(v), "Synthetic price"]}
          />
          <ReferenceLine x={stats.median} stroke="var(--chart-2)" strokeDasharray="4 4" label={{ value: `Median ${formatUSD(stats.median)}`, position: "top", fontSize: 11, fill: "var(--chart-2)" }} />
          <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((d) => <Cell key={d.name} fill={d.outlier ? "var(--chart-4)" : "var(--chart-1)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
