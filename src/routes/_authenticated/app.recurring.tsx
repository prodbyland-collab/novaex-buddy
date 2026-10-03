import { createFileRoute } from "@tanstack/react-router";
import Recurring from "@/components/pages/Recurring";

export const Route = createFileRoute("/_authenticated/app/recurring")({
  head: () => ({
    meta: [
      { title: "Referrals — GNG" },
      { name: "description", content: "Track your GNG invitations and eligible referral bonuses." },
      { property: "og:title", content: "Referrals — GNG" },
      { property: "og:description", content: "Track your GNG invitations and eligible referral bonuses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recurring,
});
