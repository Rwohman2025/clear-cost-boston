import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Prose } from "@/components/common";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the Data — ClearCost Boston" },
      { name: "description", content: "What hospital price transparency is, what CPT/HCPCS codes mean, and how published prices differ from bills." },
      { property: "og:title", content: "About the Data — ClearCost Boston" },
      { property: "og:description", content: "Gross charges, discounted cash prices and negotiated rates, explained." },
    ],
  }),
  component: About,
});

const TYPES = [
  { t: "Gross charge", d: "The hospital's list price (chargemaster) before any discount. Few patients actually pay it." },
  { t: "Discounted cash price", d: "The price a hospital offers to patients paying directly without insurance." },
  { t: "Negotiated rate", d: "The rate a specific insurance plan has agreed to pay the hospital for a service." },
];

function About() {
  return (
    <div>
      <PageHeader eyebrow="Learn" title="About the data" description="The basics of hospital price transparency and how to read the numbers on this site." />
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {TYPES.map((x) => <Card key={x.t} className="card-hover"><div className="text-sm font-semibold text-primary">{x.t}</div><p className="mt-1.5 text-sm text-muted-foreground">{x.d}</p></Card>)}
      </div>
      <Prose>
        <h2>Hospital price transparency</h2>
        <p>Since January 2021, U.S. federal rules require hospitals to publish a machine-readable file listing their standard charges for items and services, plus a consumer-friendly list of shoppable services. These files are usually large CSV or JSON documents with thousands of rows.</p>
        <h2>CPT and HCPCS codes</h2>
        <p><strong>CPT</strong> (Current Procedural Terminology) codes are five-digit codes maintained by the American Medical Association that describe medical procedures, such as <strong>72148</strong> for an MRI of the lumbar spine without contrast. <strong>HCPCS</strong> Level II codes (e.g. <strong>G0121</strong>) cover services, supplies and items not in CPT, often used by Medicare.</p>
        <h2>Published prices are not your bill</h2>
        <p>A published price is what a hospital says it charges or has agreed to accept for a defined service. Your actual bill may differ because of physician fees billed separately, anesthesia, facility fees, additional imaging or tests, complications, your deductible, coinsurance and plan rules.</p>
        <p><strong>Always confirm costs with the hospital and your insurer before receiving care.</strong> ClearCost Boston is informational and does not provide billing estimates, medical advice or financial guarantees.</p>
        <h2>About ClearCost Boston</h2>
        <p>ClearCost Boston shows the published pricing files uploaded for participating hospitals. Each hospital’s directory page identifies its source file, published date, and the date ClearCost retrieved it.</p>
      </Prose>
    </div>
  );
}
