import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    async function verify() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setStatus(data ? "ok" : "forbidden");
    }
    verify();
  }, []);

  if (status === "loading") return <div className="p-20 text-center font-black uppercase tracking-[0.5em] animate-pulse">Checking_Access...</div>;
  if (status === "forbidden") return <div className="p-20 text-center"><h1 className="text-2xl font-black uppercase">Denied</h1><Link to="/" className="underline text-xs">Exit</Link></div>;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
