import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Card, ErrorState, PageHeader } from "@/components/common";
import { API_URL } from "@/lib/api/queries";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const template = `billing_code,billing_code_description,payer_name,plan_name,setting,standard_charge_gross,standard_charge_discounted_cash,standard_charge_negotiated_dollar\n45385,Colonoscopy,Blue Cross Blue Shield,PPO,outpatient,2500,900,1120\n`;

function AdminPage() {
  const [username, setUsername] = useState("Admin");
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCode, setHospitalCode] = useState("");
  const [system, setSystem] = useState("");
  const [neighborhood, setNeighborhood] = useState("Greater Boston");
  const [city, setCity] = useState("Boston");
  const [address, setAddress] = useState("");
  const [published, setPublished] = useState(new Date().toISOString().slice(0, 10));
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = status === "Uploading and validating…";

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a hospital price CSV or ZIP first.");
    setError(null);
    setStatus("Uploading and validating…");
    const body = new FormData();
    body.append("file", file);
    body.append("hospital_name", hospitalName);
    body.append("hospital_code", hospitalCode);
    body.append("system", system);
    body.append("neighborhood", neighborhood);
    body.append("city", city);
    body.append("address", address);
    body.append("published", published);
    body.append("replace", String(replace));
    try {
      const response = await fetch(`${API_URL}/api/admin/uploads`, {
        method: "POST",
        headers: { "X-Admin-Username": username, "X-Admin-Key": key },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed.");
      setStatus(`${result.rowsImported} price rows and ${result.proceduresAdded} procedures saved for ${hospitalName}.${result.duplicatesIgnored ? ` ${result.duplicatesIgnored} repeated row${result.duplicatesIgnored === 1 ? "" : "s"} consolidated.` : ""}${result.invalidValuesIgnored ? ` ${result.invalidValuesIgnored} invalid price value${result.invalidValuesIgnored === 1 ? "" : "s"} ignored.` : ""}${result.outlierValuesIgnored ? ` ${result.outlierValuesIgnored} outlier value${result.outlierValuesIgnored === 1 ? "" : "s"} excluded.` : ""}${result.proceduresIgnored ? ` ${result.proceduresIgnored} less-common operation${result.proceduresIgnored === 1 ? "" : "s"} skipped.` : ""} Refresh open data pages to see the new hospital.`);
    } catch (reason) {
      setStatus(null);
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Import hospital pricing" description="Add a CSV or ZIP from a hospital’s published pricing file. The importer cleans invalid values, merges repeats, and keeps the 30 most common operations." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title="Upload a hospital price file" subtitle="Fields marked by the browser as required are needed to create a complete hospital listing.">
          <form className="space-y-6" onSubmit={upload}>
            <section>
              <h3 className="text-sm font-semibold">Sign in</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Username"><input required value={username} onChange={(event) => setUsername(event.target.value)} className="input" /></Field>
                <Field label="Password"><input required type="password" value={key} onChange={(event) => setKey(event.target.value)} className="input" /></Field>
              </div>
            </section>
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold">Hospital details</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Hospital name"><input required value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} className="input" placeholder="Boston Medical Center" /></Field>
                <Field label="Hospital code"><input required value={hospitalCode} onChange={(event) => setHospitalCode(event.target.value)} className="input" placeholder="BMC" /></Field>
                <Field label="Health system"><input value={system} onChange={(event) => setSystem(event.target.value)} className="input" placeholder="Optional" /></Field>
                <Field label="Published date"><input required type="date" value={published} onChange={(event) => setPublished(event.target.value)} className="input" /></Field>
                <Field label="Neighborhood"><input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="input" /></Field>
                <Field label="City"><input required value={city} onChange={(event) => setCity(event.target.value)} className="input" placeholder="Boston" /></Field>
                <div className="sm:col-span-2"><Field label="Street address"><input required value={address} onChange={(event) => setAddress(event.target.value)} className="input" placeholder="330 Brookline Ave, Boston, MA 02215" /></Field></div>
              </div>
            </section>
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold">Price file</h3>
              <div className="mt-3 rounded-lg border border-dashed bg-muted/40 p-4">
                <Field label="CSV or ZIP file"><input required type="file" accept=".csv,.zip,text/csv,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" /></Field>
                {file && <p className="mt-2 text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{file.name}</span></p>}
              </div>
              <label className="mt-4 flex items-start gap-2.5 text-sm"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} className="mt-1" /><span><span className="font-medium">Replace an existing upload</span><br /><span className="text-xs text-muted-foreground">Use this only when updating the same hospital code.</span></span></label>
            </section>
            <div className="flex flex-wrap items-center gap-3 border-t pt-5">
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={uploading || !file}>
                <Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Upload pricing file"}
              </button>
              {status && <p className="max-w-xl text-sm leading-relaxed text-success">{status}</p>}
            </div>
            {error && <ErrorState message={error} />}
          </form>
        </Card>
        <div className="space-y-5">
          <Card title="What the importer does">
            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground"><li>Accepts a CSV or a ZIP containing one CSV.</li><li>Removes zero, placeholder, and extreme outlier prices.</li><li>Combines repeated prices and limits each upload to 30 operations.</li><li>Uses the street address to place the hospital on the map.</li></ul>
          </Card>
          <Card title="CSV columns" subtitle="CMS-standard headers are recognized automatically."><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{template}</pre></Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>;
}
