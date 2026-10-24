import type { ReactNode } from "react";
import { AlertTriangle, FlaskConical, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLiveData } from "@/lib/api/queries";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-rise">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ className, children, title, subtitle, action }: { className?: string; children: ReactNode; title?: string; subtitle?: string; action?: ReactNode }) {
  return (
    <section className={cn("card-surface p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "primary" }) {
  return (
    <div className={cn("card-surface card-hover p-4", tone === "primary" && "bg-hero border-transparent text-navy-foreground")}>
      <div className={cn("text-xs font-medium", tone === "primary" ? "text-navy-foreground/70" : "text-muted-foreground")}>{label}</div>
      <div className="num mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className={cn("mt-1 text-xs", tone === "primary" ? "text-navy-foreground/70" : "text-muted-foreground")}>{hint}</div>}
    </div>
  );
}

/** Data-provenance notice. Shows the synthetic-data warning for the mock API and a "published prices" notice for the real backend. */
export function SyntheticBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-xs text-warning-foreground", className)}>
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {isLiveData ? (
        <p>
          <strong>Published hospital prices, early dataset.</strong> Covers 3 hospitals and 25 procedures taken from their
          machine-readable price files. Coverage is partial and prices are not bills or estimates of what you will pay.
        </p>
      ) : (
        <p>
          <strong>Synthetic demonstration data.</strong> Hospital names are fictional and all prices are generated for
          illustration. They are not real hospital charges, and published prices are not bills or estimates.
        </p>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading data…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{label}</div>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">{title}</div>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <div className="mt-2 text-sm font-medium">Couldn't load this data</div>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-3 text-xs font-medium text-primary hover:underline">Try again</button>}
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-success/15 text-success" : score >= 60 ? "bg-warning/20 text-warning-foreground" : "bg-destructive/10 text-destructive";
  const label = score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
  return <span className={cn("num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>{score} · {label}</span>;
}

export function Meter({ value }: { value: number }) {
  const tone = value >= 85 ? "bg-success" : value >= 70 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="num text-xs">{value}%</span>
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-foreground/85 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_strong]:text-foreground">{children}</div>;
}
