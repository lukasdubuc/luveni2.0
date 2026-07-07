import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminPage } from "./admin.index";

// Orders lives on its own /admin/orders URL but renders the exact same themed
// dashboard chrome + orders section (incl. the order-detail modal) it always
// had — moving it to a dedicated page must not change how anything looks.
export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders" }] }),
  beforeLoad: requireAdmin,
  component: () => <AdminPage initialSection="orders" />,
});
