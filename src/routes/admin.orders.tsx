import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, updateOrderStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersPage,
});

const statuses = ["pending", "paid", "failed", "fulfilled", "refunded"] as const;

function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders() });

  const mut = useMutation({
    mutationFn: (vars: { id: string; status: any }) =>
      updateStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o: any) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{o.name ?? "—"}</td>
                  <td className="px-4 py-3">{o.email}</td>
                  <td className="px-4 py-3">{o.metadata?.productName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: (o.currency ?? "usd").toUpperCase(),
                    }).format((o.amount_cents ?? 0) / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue={o.status}
                      onChange={(e) =>
                        mut.mutate({ id: o.id, status: e.target.value as any })
                      }
                      className="rounded border border-input bg-background px-2 py-1 text-xs"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
