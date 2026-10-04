import { createFileRoute } from "@tanstack/react-router";
import Legal from "@/components/pages/Legal";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms and Conditions | GNG" }] }),
  component: () => <Legal document="terms" />,
});
