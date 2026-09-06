import { createFileRoute } from "@tanstack/react-router";
import AuthPage from "@/components/pages/Auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your GNG account" },
      { name: "description", content: "Log in to GNG or open a new account to start trading crypto." },
      { property: "og:title", content: "Sign in or create your GNG account" },
      { property: "og:description", content: "Log in to GNG or open a new account to start trading crypto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});
