export type BotPlan = {
  id: "free" | "pro" | "elite";
  rate: number;
  price: number;
};

export const BOT_PLANS: BotPlan[] = [
  { id: "free", rate: 0.01, price: 0 },
  { id: "pro", rate: 0.03, price: 250 },
  { id: "elite", rate: 0.05, price: 400 },
];

export function getBotPlan(id: string): BotPlan | undefined {
  return BOT_PLANS.find((plan) => plan.id === id);
}
