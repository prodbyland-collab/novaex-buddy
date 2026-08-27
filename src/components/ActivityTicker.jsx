import { useEffect, useMemo, useRef, useState } from 'react';
import { MARKETS, formatUsd } from '@/lib/markets';

const FIRST = ['alex', 'maya', 'liam', 'noah', 'zara', 'kenji', 'sofia', 'dante', 'ravi', 'elena', 'jonas', 'mira', 'tobi', 'nadia', 'omar', 'lucas', 'ivy', 'kai', 'sasha', 'tariq', 'lena', 'diego', 'yuki', 'freya'];
const LAST = ['fx', 'trades', 'hodl', 'x', '_btc', 'capital', '99', 'moon', '_eth', 'invests', '_pro', '21', 'crypto', 'stack', '_7', 'wave'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeUser(id) {
  const base = `${pick(FIRST)}${Math.random() < 0.6 ? pick(LAST) : ''}`;
  // The event ID guarantees a fresh, masked handle even when a name is picked twice.
  return `${base.slice(0, Math.min(base.length, 5))}••${id.toString(36)}`;
}

function makeEvent(id) {
  const kind = Math.random() < 0.6 ? 'deposit' : 'withdraw';
  const symbol = pick(MARKETS).symbol;
  // Keep the simulated feed within believable everyday transaction sizes.
  const amount = kind === 'deposit'
    ? Math.round(Math.random() * 850 + 50)
    : Math.round(Math.random() * 420 + 30);
  return { id, kind, symbol, amount, user: makeUser(id) };
}

export default function ActivityTicker() {
  const [events, setEvents] = useState(() => Array.from({ length: 14 }, (_, i) => makeEvent(i)));
  const nextId = useRef(14);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => [makeEvent(nextId.current++), ...prev].slice(0, 18));
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  // Duplicate the list so the marquee loops seamlessly.
  const loop = useMemo(() => [...events, ...events], [events]);

  return (
    <div className="ticker" aria-label="Recent platform activity">
      <div className="ticker-label">
        <span className="ticker-dot" /> LIVE ACTIVITY
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((e, i) => (
            <span className="ticker-item" key={`${e.id}-${i}`}>
              <b className="ticker-user">{e.user}</b>
              <span className={e.kind === 'deposit' ? 'gain' : 'loss'}>
                {e.kind === 'deposit' ? 'deposited' : 'withdrew'} {formatUsd(e.amount)}
              </span>
              <span className="muted-2">in {e.symbol}</span>
              <span className="ticker-sep">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
