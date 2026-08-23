import { createFileRoute } from "@tanstack/react-router";
import Recurring from "@/components/pages/Recurring";

export const Route = createFileRoute("/_authenticated/app/recurring")({
  component: Recurring,
});
