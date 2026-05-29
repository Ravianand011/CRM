import { useEffect, useMemo, useState } from 'react';
import type { Lead } from '../types/Lead';

const THIRTY_MIN_MS = 30 * 60 * 1000;

export interface DemoReminder {
  leadId: string;
  name: string;
  scheduledAt: string; // ISO
}

/**
 * Watches for demos scheduled within the next 30 minutes. Re-evaluates every
 * 60 seconds and exposes the reminder list plus a count for the navbar bell.
 */
export function useNotifications(leads: Lead[]) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const reminders = useMemo<DemoReminder[]>(() => {
    const current = now.getTime();
    return leads
      .filter(
        (l) => l.status === 'demo_scheduled' && !!l.demoScheduledAt,
      )
      .map((l) => ({
        leadId: l.id,
        name: l.name,
        scheduledAt: l.demoScheduledAt as string,
      }))
      .filter((r) => {
        const t = new Date(r.scheduledAt).getTime();
        return t > current && t - current <= THIRTY_MIN_MS;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime(),
      );
  }, [leads, now]);

  return { reminders, count: reminders.length };
}
