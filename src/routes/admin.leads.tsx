import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, Download } from "lucide-react";

export const Route = createFileRoute("/admin/leads")({
  component: LeadsPage,
});

type Lead = {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  metadata?: any;
};

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return leads;
    const q = query.toLowerCase();
    return leads.filter(
      (l) => l.email?.toLowerCase().includes(q) || l.source?.toLowerCase().includes(q),
    );
  }, [leads, query]);

  const exportCsv = () => {
    const header = ["email", "source", "created_at"];
    const rows = filtered.map((l) => [l.email, l.source ?? "", l.created_at].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leads</h1>
            <p className="mt-1 text-sm text-slate-500">Email signups captured across the site.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total leads" value={leads.length.toString()} />
          <StatCard label="This week" value={leads.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 86400000).length.toString()} />
          <StatCard label="Today" value={leads.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length.toString()} />
        </div>

        {/* Toolbar */}
        <div className="mt-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or source…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No leads captured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{l.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/20">
                          {l.source || "direct"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-medium text-slate-900">{new Date(l.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
