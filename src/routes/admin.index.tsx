import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  beforeLoad: () => {
    // Redirects anyone trying to hit /admin/orders to your main dashboard
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});
