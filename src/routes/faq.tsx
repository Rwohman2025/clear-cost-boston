import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, PageHeader } from "@/components/common";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — ClearCost Boston" },
      { name: "description", content: "How to search procedures, why hospital prices differ, and what the pricing data includes." },
      { property: "og:title", content: "FAQ — ClearCost Boston" },
      { property: "og:description", content: "Answers about searching and interpreting hospital prices." },
    ],
  }),
  component: Faq,
});

const FAQS = [
  ["How do I search for a procedure?", "On the Procedure Explorer, type a procedure name (e.g. \"MRI\") or a CPT/HCPCS code (e.g. 72148) in the search bar and pick a result. Then use the filters to choose a hospital, price type, insurance provider and inpatient/outpatient setting."],
  ["Why do prices differ so much between hospitals?", "Hospitals set their own list prices and negotiate separately with each insurer. Differences in costs, teaching status, market power, what services are bundled into a price, and how files are formatted all contribute to variation."],
  ["What does the pricing data include?", "Hospital-published standard charges: gross charges, discounted cash prices and payer-negotiated rates, with procedure codes, setting, source file URL and retrieval date."],
  ["What does it exclude?", "Separately billed physician or anesthesia fees, your deductible and coinsurance, facility fees not listed, complications, and any services beyond the listed code."],
  ["Is this what I will pay?", "No. Results are informational only and are not guaranteed billing estimates. Contact the hospital and your insurer for a personalized estimate before receiving care."],
  ["Where does the data come from?", "Prices come from the published standard-charges files uploaded for participating hospitals. Each hospital listing shows its source file and publication date."],
];

function Faq() {
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Frequently asked questions" />
      <Card className="max-w-3xl">
        <Accordion type="single" collapsible defaultValue="0">
          {FAQS.map(([q, a], i) => (
            <AccordionItem key={q} value={String(i)}>
              <AccordionTrigger className="text-sm">{q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
