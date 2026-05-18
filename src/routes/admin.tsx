import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";

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
          <h1 className="text-xl font-semibold uppercase tracking-tighter">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground uppercase tracking-widest text-[10px]">
            Admin credentials required for Tulsa Hub Ops.
          </p>
          <Link to="/" className="mt-4 inline-block text-xs underline uppercase tracking-widest">
            Return to site
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