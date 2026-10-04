import { createFileRoute } from "@tanstack/react-router";
import Group from "@/components/pages/Group";

export const Route = createFileRoute("/_authenticated/app/group")({
  head: () => ({ meta: [{ title: "Chat Group | GNG" }] }),
  component: Group,
});
