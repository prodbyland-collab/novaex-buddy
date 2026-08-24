import { createFileRoute } from "@tanstack/react-router";
import AiTrading from "@/components/pages/AiTrading";

export const Route = createFileRoute("/_authenticated/app/ai")({
  component: AiTrading,
});
