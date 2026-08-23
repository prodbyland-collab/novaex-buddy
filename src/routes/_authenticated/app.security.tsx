import { createFileRoute } from "@tanstack/react-router";
import Security from "@/components/pages/Security";

export const Route = createFileRoute("/_authenticated/app/security")({
  component: Security,
});
