import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";
import { ACCOUNTING_MIGRATION, assertVerifiedSession } from "./session-verification";

export const requireVerifiedAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc("session_is_verified");
    if (error) {
      console.error(
        `[Supabase] Session verification failed (${error.code}): ${error.message}. Verify that ${ACCOUNTING_MIGRATION} has been applied to this deployment's database.`,
      );
    }
    assertVerifiedSession({ data, error });
    return next();
  });
