import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/components/pages/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GNG — Calm crypto trading & portfolio" },
      {
        name: "description",
        content:
          "GNG is a focused crypto exchange experience: live markets, spot and limit orders, crypto deposits and a clear portfolio view.",
      },
      { property: "og:title", content: "GNG — Calm crypto trading & portfolio" },
      {
        property: "og:description",
        content: "Live markets, spot and limit orders, crypto deposits and a clear portfolio view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});
