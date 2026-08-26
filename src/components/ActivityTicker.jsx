import { useEffect, useMemo, useRef, useState } from 'react';
import { MARKETS, formatUsd } from '@/lib/markets';

const FIRST = ['alex', 'maya', 'liam', 'noah', 'zara', 'kenji', 'sofia', 'dante', 'ravi', 'elena', 'jonas', 'mira', 'tobi', 'nadia', 'omar', 'lucas', 'ivy', 'kai', 'sasha', 'tariq', 'lena', 'diego', 'yuki', 'freya'];
const LAST = ['fx', 'trades', 'hodl', 'x', '_btc', 'capital', '99', 'moon', '_eth', 'invests', '_pro', '21', 'crypto', 'stack', '_7', 'wave'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeUser() {
  const name = `${pick(FIRST)}${Math.random() < 0.6 ? pick(LAST) : ''}`;
  const mask = name.length > 4 ? name.slice(0, name.length - 2) + '**' : name + '**';
  return mask;
}

function makeEvent(id) {
  const kind = Math.random() < 0.55 ? 'deposit' : 'withdraw';
  const symbol = pick(MARKETS).symbol;
  const amount = Math.round((Math.random() ** 2.2) * 48000 + 120);
  return { id, kind, symbol, amount, user: makeUser() };
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
