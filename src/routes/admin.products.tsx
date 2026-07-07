import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminPage } from "./admin.index";

// Products lives on its own /admin/products URL but renders the exact same
// themed dashboard chrome + products section it always had (drag ordering,
// bulk actions, product form, CJ transparency sweep, per-photo curator) —
// moving it to a dedicated page must not change how anything looks.
export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products" }] }),
  beforeLoad: requireAdmin,
  component: () => <AdminPage initialSection="products" />,
});
