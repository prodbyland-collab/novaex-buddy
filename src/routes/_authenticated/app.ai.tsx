import { createFileRoute } from "@tanstack/react-router";
import AiTrading from "@/components/pages/AiTrading";

export const Route = createFileRoute("/_authenticated/app/ai")({
  head: () => ({
    meta: [
      { title: "AI Trading — GNG" },
      {
        name: "description",
        content: "View your GNG AI bot, daily rate, boost code and referral bonus.",
      },
      { property: "og:title", content: "AI Trading — GNG" },
      {
        property: "og:description",
        content: "View your GNG AI bot, daily rate, boost code and referral bonus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiTrading,
});
