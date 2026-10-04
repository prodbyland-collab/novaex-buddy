import { createFileRoute } from "@tanstack/react-router";
import Wallet from "@/components/pages/Wallet";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & Transactions — GNG" },
      {
        name: "description",
        content: "Manage GNG crypto deposits and view your transaction history.",
      },
      { property: "og:title", content: "Wallet & Transactions — GNG" },
      {
        property: "og:description",
        content: "Manage GNG crypto deposits and view your transaction history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Wallet,
});
