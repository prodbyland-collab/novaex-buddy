import { paymentAddressSchema, paymentSchema } from "@/lib/payment";
import { createFileRoute } from "@tanstack/react-router";

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

async function signatureMatches(payload: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], (value) => parseInt(value, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/nowpayments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env["NOWPAYMENTS_IPN_SECRET"];
          const signature = request.headers.get("x-nowpayments-sig");
          if (!secret || !signature) return json({ error: "Invalid webhook" }, 401);

          const rawBody = await request.text();
          const body = JSON.parse(rawBody) as Record<string, unknown>;
          const canonical = JSON.stringify(sortObject(body));
          if (!(await signatureMatches(canonical, signature, secret))) {
            return json({ error: "Invalid webhook" }, 401);
          }

          const parsed = paymentSchema.safeParse(body);
          if (!parsed.success) return json({ error: "Invalid webhook" }, 400);
          const payment = parsed.data;
          const paymentId = payment.payment_id;
          const status =
            payment.payment_status === "sending" ? "confirming" : payment.payment_status;
          const actuallyPaid = payment.actually_paid;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // A callback may arrive before the create-payment response is saved.
          // Recover by its signed provider order_id and verify the quoted identity.
          const orderId = typeof body["order_id"] === "string" ? body["order_id"] : "";
          if (orderId) {
            const details = paymentAddressSchema.safeParse(body);
            const { data: draft, error: lookupError } = await supabaseAdmin
              .from("crypto_deposits")
              .select("id, pay_currency, price_amount, payment_id")
              .eq("id", orderId)
              .maybeSingle();
            if (lookupError) return json({ error: "Could not look up payment" }, 500);
            if (draft && !draft.payment_id) {
              if (
                !details.success ||
                body["pay_currency"] !== draft.pay_currency ||
                body["price_currency"] !== "usd" ||
                Number(body["price_amount"]) !== Number(draft.price_amount)
              )
                return json({ error: "Payment identity mismatch" }, 400);
              const { error: saveError } = await supabaseAdmin
                .from("crypto_deposits")
                .update({
                  payment_id: paymentId,
                  pay_address: details.data.pay_address,
                  pay_amount: details.data.pay_amount,
                })
                .eq("id", draft.id)
                .is("payment_id", null);
              if (saveError) return json({ error: "Could not recover payment" }, 500);
            }
          }
          const { error } = await supabaseAdmin.rpc("credit_crypto_deposit", {
            p_payment_id: paymentId,
            p_status: status,
            p_actually_paid: actuallyPaid,
          });
          if (error) return json({ error: "Could not process webhook" }, 500);

          return json({ received: true });
        } catch {
          return json({ error: "Could not process webhook" }, 500);
        }
      },
    },
  },
});
