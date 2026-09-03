import { createFileRoute } from "@tanstack/react-router";
import Admin from "@/components/pages/Admin";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — GNG" },
      { name: "description", content: "Manage users, balances, bot plans, deposits and payouts." },
      { property: "og:title", content: "Admin Console — GNG" },
      { property: "og:description", content: "Manage users, balances, bot plans, deposits and payouts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});
