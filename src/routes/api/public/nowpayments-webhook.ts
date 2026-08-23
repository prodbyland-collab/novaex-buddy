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

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signatureMatches(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return digest.length === signature.length && digest === signature;
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

          const paymentId = body["payment_id"] === undefined ? "" : String(body["payment_id"]);
          const rawStatus = typeof body["payment_status"] === "string" ? (body["payment_status"] as string) : "";
          const status = rawStatus === "sending" ? "confirming" : rawStatus;
          const actuallyPaid = Number(body["actually_paid"] ?? 0);
          if (!paymentId || !status || !Number.isFinite(actuallyPaid) || actuallyPaid < 0) {
            return json({ error: "Invalid webhook" }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
