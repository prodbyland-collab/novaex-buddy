import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

export const requireVerifiedAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc("session_is_verified");
    if (error || data !== true)
      throw new Error("Complete authentication verification before continuing.");
    return next();
  });
