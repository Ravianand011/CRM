import { isSameDay } from 'date-fns';
import type { Lead } from '../types/Lead';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Decide whether a lead should appear in the active follow-up queue.
 * Rules (in priority order):
 *  1. Permanently hidden leads never show.
 *  2. Leads hidden until a future time stay hidden.
 *  3. If a follow-up is scheduled, show only once that time has arrived.
 *  4. Otherwise, for not_picked / switch_off, re-show on a 24h/48h/72h
 *     cadence based on how many calls have been missed.
 *  5. Everything else shows.
 */
export function shouldShowLead(lead: Lead, now: Date = new Date()): boolean {
  if (lead.permanentlyHidden) return false;

  if (lead.hiddenUntil && now < new Date(lead.hiddenUntil)) return false;

  if (lead.nextFollowUp) {
    return now >= new Date(lead.nextFollowUp);
  }

  if (lead.status === 'not_picked' || lead.status === 'switch_off') {
    const lastShown = lead.lastShownAt
      ? new Date(lead.lastShownAt)
      : new Date(lead.updatedAt);
    const elapsed = now.getTime() - lastShown.getTime();

    if (lead.missedCallCount === 0) return elapsed >= 24 * HOUR_MS;
    if (lead.missedCallCount === 1) return elapsed >= 48 * HOUR_MS;
    return elapsed >= 72 * HOUR_MS; // missedCallCount >= 2
  }

  return true;
}

/** True when the lead has an overdue scheduled follow-up. */
export function isOverdue(lead: Lead, now: Date = new Date()): boolean {
  if (!lead.nextFollowUp) return false;
  return new Date(lead.nextFollowUp) < now;
}

/** True when the lead's follow-up is scheduled for today. */
export function isDueToday(lead: Lead, now: Date = new Date()): boolean {
  if (!lead.nextFollowUp) return false;
  return isSameDay(new Date(lead.nextFollowUp), now);
}

/**
 * Sort comparator for the queue: scheduled follow-ups first (ascending),
 * leads without a follow-up afterwards (ordered by creation time).
 */
export function compareForQueue(a: Lead, b: Lead): number {
  if (a.nextFollowUp && b.nextFollowUp) {
    return (
      new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime()
    );
  }
  if (a.nextFollowUp) return -1;
  if (b.nextFollowUp) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** Compute the visible, sorted follow-up queue from all leads. */
export function buildQueue(leads: Lead[], now: Date = new Date()): Lead[] {
  return leads
    .filter((lead) => shouldShowLead(lead, now))
    .sort(compareForQueue);
}
