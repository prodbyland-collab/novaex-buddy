import { createFileRoute } from "@tanstack/react-router";
import Markets from "@/components/pages/Markets";

export const Route = createFileRoute("/_authenticated/app/markets")({
  component: Markets,
});
