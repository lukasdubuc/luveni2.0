import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

// We remove beforeLoad entirely to stop the compiler from over-analyzing
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    const checkAccess = async () => {
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = "/login";
        return;
      }

      // Direct Role Check
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setStatus(data ? "ok" : "forbidden");
    };

    checkAccess();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
          Establishing_Secure_Link...
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Access_Denied</h1>
          <Link to="/" className="mt-4 inline-block text-[10px] font-bold uppercase tracking-widest underline decoration-2">
            Back_To_Site
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
