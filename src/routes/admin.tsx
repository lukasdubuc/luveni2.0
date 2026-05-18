import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin, purgeOrders } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const runPurge = useServerFn(purgeOrders);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  const handlePurge = async () => {
    if (!confirm("Clear all unpaid test history?")) return;
    try {
      const res = await runPurge();
      if (res?.ok) {
        toast.success("System Purged");
        window.location.reload(); 
      }
    } catch (error) {
      toast.error("Error clearing logs");
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      try {
        const r = await check();
        setStatus(r.isAdmin ? "ok" : "forbidden");
      } catch { setStatus("forbidden"); }
    };
    verifyAccess();
  }, [check]);

  if (status === "loading") return <div className="p-20 text-center animate-pulse text-xs tracking-widest uppercase">Initializing Ops...</div>;
  if (status === "forbidden") return <div className="p-20 text-center uppercase tracking-tighter font-bold">Access Denied</div>;

  return (
    <AdminShell>
      {/* Infrastructure Control Bar */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Control Tower</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Tulsa, OK Hub</span>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={handlePurge}
            className="text-[10px] font-bold tracking-tighter text-muted-foreground hover:text-red-500 transition-colors uppercase py-1 px-3 border border-muted-foreground/20 rounded-full"
          >
            Reset Environment
          </button>
        </div>
      </div>

      <div className="p-6">
        <Outlet />
      </div>
    </AdminShell>
  );
}