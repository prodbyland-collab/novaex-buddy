import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { MARKETS, formatUsd } from "@/lib/markets";
import { useLivePrices } from "@/lib/useLivePrices";

const FIRST = [
  "alex",
  "maya",
  "liam",
  "noah",
  "zara",
  "kenji",
  "sofia",
  "dante",
  "ravi",
  "elena",
  "jonas",
  "mira",
  "tobi",
  "nadia",
  "omar",
  "lucas",
  "ivy",
  "kai",
  "sasha",
  "tariq",
  "lena",
  "diego",
  "yuki",
  "freya",
  "giorgi",
  "nino",
  "luka",
  "mariam",
  "davit",
  "ana",
  "saba",
  "tamar",
];
const LAST = [
  "fx",
  "trades",
  "hodl",
  "x",
  "_btc",
  "capital",
  "99",
  "moon",
  "_eth",
  "invests",
  "_pro",
  "21",
  "crypto",
  "stack",
  "_7",
  "wave",
];
const COINS = MARKETS.map((m) => m.symbol).filter((s) => s !== "USD");
// Users deposit stablecoins and BTC/ETH far more often than smaller coins.
const WEIGHTS = { USDT: 5, BTC: 4, ETH: 3, SOL: 2, TRX: 1.5, LTC: 1, XRP: 1.5, BNB: 1, DOGE: 1 };
const MIN_DEPOSIT_USD = 500;
const ROUND_USD = [500, 750, 1000, 1500, 2000, 2500, 5000];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickCoin() {
  const total = COINS.reduce((s, c) => s + (WEIGHTS[c] ?? 1), 0);
  let r = Math.random() * total;
  for (const c of COINS) {
    r -= WEIGHTS[c] ?? 1;
    if (r <= 0) return c;
  }
  return COINS[0];
}

function makeUser() {
  const base = `${pick(FIRST)}${Math.random() < 0.6 ? pick(LAST) : ""}`;
  return `${base.slice(0, 4)}•••${Math.floor(Math.random() * 90 + 10)}`;
}

// Log-normal-ish spread, with deposits starting at $500.
function usdSize(kind) {
  if (kind === "deposit" && Math.random() < 0.45) return pick(ROUND_USD);
  const median = kind === "deposit" ? 1000 : 180;
  const v = Math.exp(
    Math.log(median) + (Math.random() + Math.random() + Math.random() - 1.5) * 1.4,
  );
  return Math.min(Math.max(v, kind === "deposit" ? MIN_DEPOSIT_USD : 25), 12000);
}

function coinDecimals(price) {
  if (price >= 10000) return 5;
  if (price >= 100) return 4;
  if (price >= 1) return 2;
  return 0;
}

function makeEvent(id, prices) {
  const kind = Math.random() < 0.62 ? "deposit" : "withdraw";
  const symbol = pickCoin();
  const price = prices?.[symbol]?.price ?? MARKETS.find((m) => m.symbol === symbol)?.price ?? 1;
  const d = coinDecimals(price);
  let coins = Number((usdSize(kind) / price).toFixed(d));
  // Coin precision can round a $500 deposit below the minimum.
  if (kind === "deposit" && coins * price < MIN_DEPOSIT_USD) {
    const precision = 10 ** d;
    coins = Math.ceil((MIN_DEPOSIT_USD / price) * precision) / precision;
    if (coins * price < MIN_DEPOSIT_USD) coins += 1 / precision;
  }
  const usd = coins * price;
  return {
    id,
    kind,
    symbol,
    coins: coins.toLocaleString("en-US", { maximumFractionDigits: d }),
    usd,
    user: makeUser(),
  };
}

export default function ActivityTicker() {
  const { t } = useI18n();
  const prices = useLivePrices();
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const [events, setEvents] = useState([]);
  const nextId = useRef(0);

  useEffect(() => {
    setEvents(Array.from({ length: 14 }, () => makeEvent(nextId.current++, pricesRef.current)));
    let timer;
    const tick = () => {
      setEvents((prev) => [makeEvent(nextId.current++, pricesRef.current), ...prev].slice(0, 18));
      timer = setTimeout(tick, 2500 + Math.random() * 5000);
    };
    timer = setTimeout(tick, 3000);
    return () => clearTimeout(timer);
  }, []);

  const loop = useMemo(() => [...events, ...events], [events]);

  return (
    <div className="ticker" aria-label={t("Illustrative activity examples")}>
      <div className="ticker-label">
        <span className="ticker-dot" /> {t("LIVE ACTIVITY")}
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((e, i) => (
            <span className="ticker-item" key={`${e.id}-${i}`}>
              <b className="ticker-user">{e.user}</b>
              <span className={e.kind === "deposit" ? "gain" : "loss"}>
                {t(e.kind === "deposit" ? "deposited" : "withdrew")} {e.coins} {e.symbol}
              </span>
              <span className="muted-2">≈ {formatUsd(e.usd)}</span>
              <span className="ticker-sep">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
