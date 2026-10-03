import { createFileRoute } from "@tanstack/react-router";
import Orders from "@/components/pages/Orders";

export const Route = createFileRoute("/_authenticated/app/orders")({
  head: () => ({
    meta: [
      { title: "Bot Plans — GNG" },
      { name: "description", content: "View GNG bot tiers and manage your bot plan." },
      { property: "og:title", content: "Bot Plans — GNG" },
      { property: "og:description", content: "View GNG bot tiers and manage your bot plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Orders,
});
