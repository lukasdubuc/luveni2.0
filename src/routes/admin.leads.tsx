import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => fetchLeads() });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-6 text-sm text-muted-foreground">No leads captured yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{l.email}</td>
                  <td className="px-4 py-3">{l.source ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {Object.keys(l.metadata ?? {}).length
                      ? JSON.stringify(l.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
