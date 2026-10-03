import { createFileRoute } from "@tanstack/react-router";
import Security from "@/components/pages/Security";

export const Route = createFileRoute("/_authenticated/app/security")({
  head: () => ({
    meta: [
      { title: "Account Security — GNG" },
      { name: "description", content: "Manage your GNG account security settings." },
      { property: "og:title", content: "Account Security — GNG" },
      { property: "og:description", content: "Manage your GNG account security settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Security,
});
