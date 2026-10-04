import { createFileRoute } from "@tanstack/react-router";
import Admin from "@/components/pages/Admin";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — GNG" },
      { name: "description", content: "Manage users, balances, bot plans, deposits and payouts." },
      { property: "og:title", content: "Admin Console — GNG" },
      {
        property: "og:description",
        content: "Manage users, balances, bot plans, deposits and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});
