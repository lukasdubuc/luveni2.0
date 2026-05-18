import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
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
  const [sessionStatus, setSessionStatus] = useState<
    "loading" | "signed-out" | "signed-in"
  >("loading");
  const [adminStatus, setAdminStatus] = useState<
    "loading" | "ok" | "forbidden"
  >("loading");

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSessionStatus(data.session ? "signed-in" : "signed-out");
    });

    const {
       { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSessionStatus(session ? "signed-in" : "signed-out");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionStatus !== "signed-in") return;

    let cancelled = false;
    setAdminStatus("loading");

    check()
      .then((r) => {
        if (!cancelled) setAdminStatus(r.isAdmin ? "ok" : "forbidden");
      })
      .catch(() => {
        if (!cancelled) setAdminStatus("forbidden");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, check]);

  if (sessionStatus === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (sessionStatus === "signed-out") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40 p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in — Owner portal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner portal access.
          </p>

          <div className="mt-6">
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  if (adminStatus === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (adminStatus === "forbidden") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't an admin yet. The first owner needs to be promoted
            once via the Lovable Cloud backend with this SQL:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com';`}
          </pre>
          <Link to="/" className="mt-4 inline-block text-sm underline">
            Back to site
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
