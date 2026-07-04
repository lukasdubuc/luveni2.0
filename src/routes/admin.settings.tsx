import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminPage } from "./admin.index";

// Settings lives on its own /admin/settings URL but renders the exact same
// themed dashboard chrome + settings section it always had — moving it to a
// dedicated page must not change how anything looks.
export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  beforeLoad: requireAdmin,
  component: () => <AdminPage initialSection="settings" />,
});
