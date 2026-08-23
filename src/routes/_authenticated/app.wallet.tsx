import { createFileRoute } from "@tanstack/react-router";
import Wallet from "@/components/pages/Wallet";

export const Route = createFileRoute("/_authenticated/app/wallet/")({
  component: Wallet,
});
