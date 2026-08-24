REVOKE ALL ON FUNCTION public.accrue_ai_trading_profit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accrue_ai_trading_profit() FROM anon;
GRANT EXECUTE ON FUNCTION public.accrue_ai_trading_profit() TO authenticated;

REVOKE ALL ON FUNCTION public.credit_crypto_deposit(text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_crypto_deposit(text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.credit_crypto_deposit(text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_crypto_deposit(text, text, numeric) TO service_role;