import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/components/pages/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOVAX — Calm crypto trading & portfolio" },
      {
        name: "description",
        content:
          "NOVAX is a focused crypto exchange experience: live markets, spot and limit orders, crypto deposits and a clear portfolio view.",
      },
      { property: "og:title", content: "NOVAX — Calm crypto trading & portfolio" },
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
