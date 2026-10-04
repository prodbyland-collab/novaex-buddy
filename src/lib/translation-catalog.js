import { translations } from "./translations.js";
import { nestedTranslations } from "./language-dict.js";
import { uiTranslations } from "./ui-translations.js";
function flatten(obj, prefix = "") {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === "object"
        ? Object.entries(flatten(value, prefix + key + "."))
        : [[prefix + key, value]],
    ),
  );
}
const supplementalTranslations = {
  en: {
    "dashboard.aiAction": "Manage your bot",
    "dashboard.planAction": "Compare bot tiers",
    "dashboard.referralAction": "Invite members",
    "common.skipContent": "Skip to content",
    "dashboard.title": "Portfolio",
    "dashboard.subtitle": "Your balances and market value, updating live.",
    "dashboard.totalValue": "Total portfolio value",
    "dashboard.sinceStart": "since you started",
    "dashboard.cash": "cash",
    "dashboard.inCrypto": "in crypto",
    "dashboard.holdings": "Your holdings",
    "dashboard.trade": "Trade →",
    "dashboard.loading": "Loading...",
    "dashboard.noHoldings": "No holdings yet. Start trading to build your portfolio.",
    "dashboard.goMarkets": "Go to Markets",
    "dashboard.availableCash": "Available cash",
    "dashboard.tradeNow": "Trade now",
    "dashboard.quickActions": "Quick actions",
    "dashboard.spotTrade": "Spot trade",
    "dashboard.spotDesc": "Buy or sell instantly",
    "dashboard.limitOrder": "Limit order",
    "dashboard.limitDesc": "Set your price",
    "dashboard.recurring": "Recurring",
    "dashboard.recurringDesc": "Automate buys",
    "dashboard.security": "Security",
    "dashboard.securityDesc": "Review settings",
    "dashboard.watchlist": "Watchlist",
    "dashboard.usDollar": "US Dollar",
  },
  ka: {
    "dashboard.aiAction": "მართე შენი ბოტი",
    "dashboard.planAction": "შეადარე გეგმები",
    "dashboard.referralAction": "მოიწვიე წევრები",
    "common.skipContent": "შინაარსზე გადასვლა",
    "dashboard.title": "პორტფელი",
    "dashboard.subtitle": "შენი ბალანსები და საბაზრო ღირებულება, რომელიც ცოცხლად განახლდება.",
    "dashboard.totalValue": "პორტფელის სრული ღირებულება",
    "dashboard.sinceStart": "დაწყებიდან",
    "dashboard.cash": "ნაღდი თანხა",
    "dashboard.inCrypto": "კრიპტოში",
    "dashboard.holdings": "შენი აქტივები",
    "dashboard.trade": "ვაჭრობა →",
    "dashboard.loading": "იტვირთება...",
    "dashboard.noHoldings": "აქტივები ჯერ არ გაქვს. დაიწყე ვაჭრობა პორტფელის შესაქმნელად.",
    "dashboard.goMarkets": "ბაზრებზე გადასვლა",
    "dashboard.availableCash": "ხელმისაწვდომი თანხა",
    "dashboard.tradeNow": "ივაჭრე ახლა",
    "dashboard.quickActions": "სწრაფი მოქმედებები",
    "dashboard.spotTrade": "სპოტ ვაჭრობა",
    "dashboard.spotDesc": "იყიდე ან გაყიდე მყისიერად",
    "dashboard.limitOrder": "ლიმიტ ორდერი",
    "dashboard.limitDesc": "დააყენე შენი ფასი",
    "dashboard.recurring": "რეგულარული",
    "dashboard.recurringDesc": "შესყიდვების ავტომატიზაცია",
    "dashboard.security": "უსაფრთხოება",
    "dashboard.securityDesc": "პარამეტრების ნახვა",
    "dashboard.watchlist": "სადარაჯო სია",
    "dashboard.usDollar": "აშშ დოლარი",
  },
};
export const translationCatalog = Object.fromEntries(
  ["en", "ka"].map((lang) => [
    lang,
    {
      ...uiTranslations[lang],
      ...translations[lang],
      ...supplementalTranslations[lang],
      ...flatten(nestedTranslations[lang]),
    },
  ]),
);
