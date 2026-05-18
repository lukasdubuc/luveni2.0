"use client"; // Force client-side boundaries

import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/start/client";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    // This part runs on the server/auth gate
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

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
        setStatus("forbidden");
      }
    };
    verifyAccess();
  }, [check]);

  if (status === "loading") {
    return <div className="p-20 text-center animate-pulse text-[10px] uppercase tracking-[0.5em]">Authenticating...</div>;
  }

  if (status === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-tighter">Access Denied</h1>
        <Link to="/" className="mt-4 text-xs underline uppercase tracking-widest">Exit Portal</Link>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
