import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/pages/Dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});
