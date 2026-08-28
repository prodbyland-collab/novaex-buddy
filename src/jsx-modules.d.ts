/* Ambient types for the ported JavaScript modules (pages, contexts, helpers). */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "@/components/pages/*" {
  const Component: any;
  export default Component;
}

declare module "@/components/AppLayout" {
  const Component: any;
  export default Component;
}

declare module "@/components/Sparkline" {
  const Component: any;
  export default Component;
}

declare module "@/lib/auth" {
  export const AuthProvider: any;
  export const useAuth: any;
}

declare module "@/lib/portfolio" {
  export const PortfolioProvider: any;
  export const usePortfolio: any;
}

declare module "@/lib/markets" {
  export const MARKETS: any;
  export const MARKET_MAP: any;
  export const formatUsd: any;
  export const formatNum: any;
}

declare module "@/lib/useLivePrices" {
  export const useLivePrices: any;
}

declare module "@/lib/language" {
  export const LanguageProvider: any;
  export const useLanguage: any;
}

declare module "@/lib/i18n" {
  export const LanguageProvider: any;
  export const useI18n: any;
  export const LanguageSwitch: any;
  export const LANGUAGES: any;
}
