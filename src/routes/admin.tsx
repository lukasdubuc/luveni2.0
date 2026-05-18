import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login" });
    }
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
    check()
      .then((r) => setStatus(r.isAdmin ? "ok" : "forbidden"))
      .catch(() => setStatus("forbidden"));
  }, []);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (status === "forbidden") {
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
