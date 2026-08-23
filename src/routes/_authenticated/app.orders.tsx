import { createFileRoute } from "@tanstack/react-router";
import Orders from "@/components/pages/Orders";

export const Route = createFileRoute("/_authenticated/app/orders")({
  component: Orders,
});
