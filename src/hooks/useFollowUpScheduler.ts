import { useEffect, useState } from 'react';

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Returns a `tick` value that changes every 5 minutes, plus the current time.
 * Views depend on `tick` to re-evaluate which leads belong in the queue as
 * scheduled follow-up / re-show times elapse.
 */
export function useFollowUpScheduler() {
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setNow(new Date());
    }, FIVE_MIN_MS);
    return () => clearInterval(interval);
  }, []);

  return { tick, now };
}
