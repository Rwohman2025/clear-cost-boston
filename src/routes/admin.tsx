import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, ErrorState, PageHeader } from "@/components/common";
import { API_URL } from "@/lib/api/queries";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const template = `code,description,payer,plan,setting,gross,cash,negotiated\n45385,Colonoscopy,Blue Cross Blue Shield,PPO,outpatient,2500,900,1120\n`;

function AdminPage() {
  const [username, setUsername] = useState("Admin");
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCode, setHospitalCode] = useState("");
  const [system, setSystem] = useState("");
  const [neighborhood, setNeighborhood] = useState("Greater Boston");
  const [published, setPublished] = useState(new Date().toISOString().slice(0, 10));
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a CSV file first.");
    setError(null); setStatus("Uploading and validating…");
    const body = new FormData();
    body.append("file", file); body.append("hospital_name", hospitalName); body.append("hospital_code", hospitalCode);
    body.append("system", system); body.append("neighborhood", neighborhood); body.append("published", published); body.append("replace", String(replace));
    try {
      const response = await fetch(`${API_URL}/api/admin/uploads`, { method: "POST", headers: { "X-Admin-Username": username, "X-Admin-Key": key }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed.");
      setStatus(`${result.rowsImported} rows saved for ${hospitalName}. Refresh any open data pages to see it.`);
    } catch (reason) { setStatus(null); setError(reason instanceof Error ? reason.message : "Upload failed."); }
  }

  return <div className="space-y-6"><PageHeader eyebrow="Admin" title="Import hospital pricing" description="Upload a cleaned CSV to add one hospital’s published prices. Your key is sent only to the API for this request." />
    <Card title="CSV format" subtitle="Required: code and setting, plus one or more price columns."><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{template}</pre><p className="mt-3 text-xs text-muted-foreground">Use <strong>gross</strong>, <strong>cash</strong>, and/or <strong>negotiated</strong> for prices. Payer and plan are used for negotiated rates. Re-uploading the same hospital requires selecting “Replace existing upload.”</p></Card>
    <Card title="Upload a hospital CSV"><form className="space-y-4" onSubmit={upload}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Username"><input required value={username} onChange={e => setUsername(e.target.value)} className="input" /></Field><Field label="Password"><input required type="password" value={key} onChange={e => setKey(e.target.value)} className="input" /></Field><Field label="CSV file"><input required type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></Field><Field label="Hospital name"><input required value={hospitalName} onChange={e => setHospitalName(e.target.value)} className="input" placeholder="Boston Medical Center" /></Field><Field label="Hospital code"><input required value={hospitalCode} onChange={e => setHospitalCode(e.target.value)} className="input" placeholder="BMC" /></Field><Field label="Health system"><input value={system} onChange={e => setSystem(e.target.value)} className="input" placeholder="Optional" /></Field><Field label="Neighborhood"><input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="input" /></Field><Field label="Published date"><input required type="date" value={published} onChange={e => setPublished(e.target.value)} className="input" /></Field></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Replace an existing upload with this hospital code</label>
      <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!status && !file ? false : false}>{status === "Uploading and validating…" ? "Uploading…" : "Upload CSV"}</button>
      {status && <p className="text-sm text-success">{status}</p>}{error && <ErrorState message={error} />}
    </form></Card></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
