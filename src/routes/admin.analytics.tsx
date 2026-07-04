import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminPage } from "./admin.index";

// Analytics lives on its own /admin/analytics URL but renders the exact same
// themed dashboard chrome + telemetry section it always had — moving it to a
// dedicated page must not change how anything looks.
export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics" }] }),
  beforeLoad: requireAdmin,
  component: () => <AdminPage initialSection="analytics" />,
});
