"use client";

import { useEffect, useState } from "react";

/** mm:ss until `to`, ticking every second. Calls onDone once when it reaches zero. */
export function Countdown({ to, onDone }: { to: string; onDone?: () => void }) {
  const end = new Date(to).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        onDone?.();
      }
    };
    const id = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [end, onDone]);

  if (left == null) return <span>--:--</span>;
  const s = Math.ceil(left / 1000);
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left
    </span>
  );
}
