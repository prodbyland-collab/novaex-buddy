import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/daily-ai-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anonKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const provided = request.headers.get("apikey");
        if (!anonKey || !provided || provided !== anonKey) {
          return json({ error: "Unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supabase = supabaseAdmin;

        const { data: code, error } = await supabase.rpc("ensure_daily_ai_code");

        if (error || !code) {
          console.error("ensure_daily_ai_code failed", error);
          return json({ error: error?.message ?? "No code" }, 500);
        }

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const telegramKey = process.env["TELEGRAM_API_KEY"];
        const chatId = process.env["TELEGRAM_CHAT_ID"] ?? "8907018783";
        if (!lovableKey || !telegramKey) {
          return json({ error: "Telegram is not configured" }, 500);
        }

        const today = new Date().toISOString().slice(0, 10);
        const text =
          `<b>NovaEx daily AI boost code</b>\n` +
          `Date: ${today} (UTC)\n` +
          `Code: <code>${String(code)}</code>\n\n` +
          `Enter it on the Trading mode page to lift today's AI profit from 1% to 5%.`;

        const response = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": telegramKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });

        const body = await response.text();
        if (!response.ok) {
          console.error(`Telegram sendMessage failed [${response.status}]: ${body}`);
          return json({ error: `Telegram failed [${response.status}]: ${body}` }, 502);
        }

        let ok = true;
        try {
          ok = (JSON.parse(body) as { ok?: boolean }).ok !== false;
        } catch {
          ok = true;
        }
        if (!ok) {
          console.error(`Telegram rejected the message: ${body}`);
          return json({ error: `Telegram rejected the message: ${body}` }, 502);
        }

        await supabase.rpc("mark_daily_ai_code_sent");
        return json({ ok: true, date: today });
      },
    },
  },
});
