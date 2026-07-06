import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminPage } from "./admin.index";

// Leads lives on its own /admin/leads URL but renders the exact same themed
// dashboard chrome + leads section it always had — moving it to a dedicated
// page must not change how anything looks.
export const Route = createFileRoute("/admin/leads")({
  head: () => ({ meta: [{ title: "Leads" }] }),
  beforeLoad: requireAdmin,
  component: () => <AdminPage initialSection="leads" />,
});
