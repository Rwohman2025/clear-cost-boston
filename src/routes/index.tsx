import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Building2, CircleDollarSign, Search } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ClearCost Boston — Hospital price guide" },
    { name: "description", content: "Compare published hospital prices for common procedures across greater Boston." },
  ] }),
  component: HomePage,
});

function HomePage() {
  return <div className="mx-auto max-w-6xl space-y-8 py-2 sm:py-6">
    <section className="relative overflow-hidden rounded-xl bg-hero px-6 py-12 text-primary-foreground shadow-elevated sm:px-10 sm:py-16">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/15" />
      <div className="absolute -bottom-32 right-24 h-64 w-64 rounded-full border border-white/10" />
      <div className="relative max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">ClearCost Boston</p>
        <h1 className="max-w-2xl text-4xl leading-[1.02] sm:text-6xl">Know the listed price before you choose where to get care.</h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">ClearCost helps you compare the prices Boston-area hospitals publish for common procedures. Start with the service you need, then see what each hospital lists.</p>
        <Link to="/explorer" className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5">Compare hospital prices <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      <Step icon={<Search className="h-5 w-5" />} number="01" title="Find a procedure" text="Search by a familiar procedure name or CPT code." />
      <Step icon={<CircleDollarSign className="h-5 w-5" />} number="02" title="Compare listed prices" text="See cash prices, gross charges, or insurer-negotiated rates side by side." />
      <Step icon={<Building2 className="h-5 w-5" />} number="03" title="Ask better questions" text="Bring the comparison to your provider or insurer before scheduling care." />
    </section>
    <section className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-[1.2fr_0.8fr] sm:p-8">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Published hospital data</p><h2 className="mt-3 text-3xl">A clearer starting point for healthcare prices.</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">The figures come from the hospitals’ public machine-readable price files. They are useful for comparison, but your final bill can vary with your treatment and insurance coverage.</p></div>
      <div className="flex items-center sm:justify-end"><Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Learn about the data <ArrowRight className="h-4 w-4" /></Link></div>
    </section>
  </div>;
}
function Step({ icon, number, title, text }: { icon: ReactNode; number: string; title: string; text: string }) {
  return <article className="card-surface card-hover p-5"><div className="flex items-center justify-between text-primary"><span>{icon}</span><span className="text-xs font-bold tracking-wider">{number}</span></div><h2 className="mt-5 text-2xl">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>;
}
