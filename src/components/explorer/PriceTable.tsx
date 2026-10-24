import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, AlertTriangle } from "lucide-react";
import type { HospitalPriceRow, PriceStats } from "@/lib/models/types";
import { formatUSD } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Key = "hospital" | "amount" | "vsMedian";

export function PriceTable({ rows, stats }: { rows: HospitalPriceRow[]; stats: PriceStats }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "amount", dir: 1 });
  const sorted = useMemo(() => {
    const val = (r: HospitalPriceRow) =>
      sort.key === "hospital" ? r.hospital.name : r.amount;
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  }, [rows, sort]);

  const Th = ({ k, children, right }: { k: Key; children: string; right?: boolean }) => {
    const Icon = sort.key !== k ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={cn("px-3 py-2.5 font-medium", right && "text-right")}>
        <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>
          {children}<Icon className="h-3 w-3" />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <Th k="hospital">Hospital</Th>
            <Th k="amount" right>Listed price</Th>
            <Th k="vsMedian" right>Compared with typical</Th>
            <th className="px-3 py-2.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const diff = ((r.amount - stats.median) / stats.median) * 100;
            return (
              <tr key={r.hospital.id} className="border-b last:border-0 transition-colors hover:bg-muted/60">
                <td className="px-3 py-2.5">
                  <Link to="/hospitals/$hospitalId" params={{ hospitalId: r.hospital.id }} className="font-medium hover:text-primary">{r.hospital.name}</Link>
                  <div className="text-xs text-muted-foreground">{r.hospital.city} · {r.hospital.type}</div>
                </td>
                <td className="num px-3 py-2.5 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {r.isOutlier && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Price far from the other listed prices" />}
                    {formatUSD(r.amount)}
                  </span>
                </td>
                <td className={cn("px-3 py-2.5 text-right text-xs", diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : "text-muted-foreground")}>
                  {diff === 0 ? "Same as typical" : `${Math.abs(Math.round(diff))}% ${diff > 0 ? "higher" : "lower"}`}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.hospital.sourceFormat} · {r.record.retrievedAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
