import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/pages/Dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Portfolio — GNG" },
      { name: "description", content: "View your GNG account balance, holdings and portfolio performance." },
      { property: "og:title", content: "Portfolio — GNG" },
      { property: "og:description", content: "View your GNG account balance, holdings and portfolio performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
