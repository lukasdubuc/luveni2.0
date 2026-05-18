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

      // Direct client check - no server functions to break the build
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setStatus(roleData ? "ok" : "forbidden");
    };
    verifyAccess();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-[10px] font-black uppercase tracking-[0.6em] animate-pulse">
          INITIALIZING_SECURE_ACCESS...
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic underline decoration-4">ACCESS_DENIED</h1>
          <Link to="/" className="mt-6 inline-block text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
            [ Return_to_Site ]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
