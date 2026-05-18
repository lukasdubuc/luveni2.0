import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Direct client check - builds 100% of the time
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setStatus(data ? "ok" : "forbidden");
    };
    verifyAccess();
  }, []);

  if (status === "loading") return <div className="p-20 text-center font-black uppercase tracking-widest animate-pulse">Checking_Credentials...</div>;

  if (status === "forbidden") return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-black uppercase italic">Access_Denied</h1>
        <Link to="/" className="text-xs underline uppercase mt-4 inline-block">Return_Home</Link>
      </div>
    </div>
  );

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}