import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { proceduresQuery } from "@/lib/api/queries";
import type { Procedure } from "@/lib/models/types";
import { Input } from "@/components/ui/input";

export function ProcedureSearch({ selected, onSelect, hospitalId }: { selected: Procedure | undefined; onSelect: (p: Procedure) => void; hospitalId?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [], isFetching } = useQuery({ ...proceduresQuery(q, hospitalId), enabled: open });

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={open ? q : selected ? `${selected.code} — ${selected.name}` : q}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search procedures by name or CPT/HCPCS code (e.g. 45385, colonoscopy)"
        className="h-11 bg-card pl-9 text-sm"
        aria-label="Search procedures"
      />
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-80 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-elevated animate-rise">
          {isFetching && data.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
          {!isFetching && data.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No procedures match "{q}".</div>}
          {data.map((p) => (
            <button key={p.code} onMouseDown={(e) => e.preventDefault()} onClick={() => { onSelect(p); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent">
              <span className="num w-14 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-center text-xs">{p.code}</span>
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
