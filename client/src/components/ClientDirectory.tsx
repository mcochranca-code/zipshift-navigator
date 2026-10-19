import { useEffect, useMemo, useState } from "react";

interface DirectoryRecord {
  id: string;
  source: "navigator" | "attached-directory";
  name: string;
  programName: string | null;
  category: string;
  city: string;
  address: string;
  phone: string;
  hours: string | null;
  verified: boolean;
  hsaiScore: number | null;
  directoryReferences: string[];
  operatingSchedule?: string | null;
  scheduleSource?: string | null;
}

interface ClientDirectoryProps {
  onBack: () => void;
}

const ZIPSHIFT_LOGO = "/manus-storage/zipshift_logo_cleaned_354ed835.png";

async function loadDirectory() {
  const response = await fetch("/api/resources/canonical", { credentials: "include" });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || "Unable to load the service directory.");
  return data.resources as DirectoryRecord[];
}

export default function ClientDirectory({ onBack }: ClientDirectoryProps) {
  const [resources, setResources] = useState<DirectoryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      setResources(await loadDirectory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchDirectory(); }, []);

  const cities = useMemo(() => ["All", ...Array.from(new Set(resources.map((resource) => resource.city))).sort()], [resources]);
  const displayed = resources.filter((resource) => {
    const matchesCity = city === "All" || resource.city === city;
    const searchTarget = `${resource.name} ${resource.programName || ""} ${resource.category} ${resource.city} ${resource.address} ${resource.phone}`.toLowerCase();
    return matchesCity && searchTarget.includes(search.trim().toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-[#142846] md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" className="h-8 w-auto" />
            <h1 className="mt-3 text-3xl font-black tracking-tight">Full Service Directory</h1>
            <p className="mt-1 text-sm text-slate-500">A canonical directory combining Navigator providers with attached GreenBook records, without duplicate listings.</p>
          </div>
          <button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Back</button>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#159d92]" placeholder="Search providers, services, addresses, or cities" />
            <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#159d92]">{cities.map((item) => <option key={item}>{item}</option>)}</select>
            <button onClick={() => void fetchDirectory()} className="rounded-lg bg-[#159d92] px-5 py-3 text-sm font-bold text-white hover:bg-[#0d8077]">Refresh</button>
          </div>
        </section>

        {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? <div className="col-span-full rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading the directory…</div> : displayed.map((resource) => (
            <article key={resource.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{resource.category}</p>
                <span className={`rounded px-2 py-1 text-[11px] font-bold ${resource.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{resource.verified ? "Verified" : "Confirm details"}</span>
              </div>
              <h2 className="mt-3 text-lg font-black leading-6">{resource.name}</h2>
              {resource.programName && <p className="mt-1 text-sm text-slate-500">{resource.programName}</p>}
              <p className="mt-2 text-sm text-slate-500">{resource.address}</p>
              <p className="mt-1 text-sm text-slate-500">{resource.city}</p>
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600">{resource.operatingSchedule || resource.hours || "Contact the provider to confirm current intake availability and service hours."}</div>
              {resource.scheduleSource && <p className="mt-2 text-xs font-semibold text-[#148d84]">Operational schedule source: {resource.scheduleSource}</p>}
              {resource.directoryReferences.length > 0 && <p className="mt-2 text-xs font-semibold text-[#148d84]">GreenBook reference: {resource.directoryReferences.join(", ")}</p>}
              <div className="mt-5 flex gap-3">
                <a href={`tel:${(resource.phone || "").replace(/[^0-9+]/g, "")}`} className="flex-1 rounded-lg bg-[#159d92] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#0d8077]">Call provider</a>
                <span className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#148d84]">HSAI {resource.hsaiScore ?? "—"}</span>
              </div>
            </article>
          ))}
          {!loading && !displayed.length && <div className="col-span-full rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No directory records match your filters.</div>}
        </div>
      </div>
    </div>
  );
}
