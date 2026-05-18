import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin, purgeOrders } from "@/lib/admin.functions"; // Added purgeOrders
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Owner portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const runPurge = useServerFn(purgeOrders);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  // Logic to clear out those $49 test attempts
  const handlePurge = async () => {
    const confirmed = window.confirm("Clear all unpaid test orders from history?");
    if (!confirmed) return;

    try {
      const res = await runPurge();
      if (res?.ok) {
        toast.success("Test history purged");
        window.location.reload(); 
      } else {
        toast.error("Failed to clear history");
      }
    } catch (error) {
      console.error("Purge error:", error);
      toast.error("Something went wrong");
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      try {
        const r = await check();
        setStatus(r.isAdmin ? "ok" : "forbidden");
      } catch (error) {
        console.error("Admin check failed:", error);
        setStatus("forbidden");
      }
    };

    verifyAccess();
  }, [check]);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Checking access…
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have admin access to the owner portal.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm underline">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between border-b px-6 py-2 bg-muted/10">
        <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          Ops Dashboard
        </span>
        <button 
          onClick={handlePurge}
          className="text-[10px] font-bold tracking-tighter text-muted-foreground hover:text-red-500 transition-colors uppercase border border-dashed border-muted-foreground/30 px-2 py-1 rounded"
        >
          Purge Test Data
        </button>
      </div>
      <Outlet />
    </AdminShell>
  );
}