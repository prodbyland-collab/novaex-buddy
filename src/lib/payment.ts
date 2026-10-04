import { z } from "zod";

export const paymentSchema = z.object({
  payment_id: z.union([z.string().min(1), z.number().finite()]).transform(String),
  payment_status: z.enum([
    "waiting",
    "confirming",
    "confirmed",
    "sending",
    "partially_paid",
    "finished",
    "failed",
    "expired",
    "refunded",
  ]),
  actually_paid: z.coerce.number().finite().nonnegative().default(0),
});
export const paymentAddressSchema = paymentSchema.extend({
  pay_address: z.string().min(1),
  pay_amount: z.coerce.number().finite().positive(),
});

export function getCallbackUrl(configured: string | undefined, requestUrl: string) {
  const base = new URL(configured || requestUrl);
  if (
    base.protocol !== "https:" &&
    !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))
  ) {
    throw new Error("Configure PUBLIC_SITE_URL with the HTTPS address of this deployment");
  }
  return new URL("/api/public/nowpayments-webhook", base.origin).href;
}
