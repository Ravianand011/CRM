import { isSameDay } from 'date-fns';
import type { Lead } from '../types/Lead';

const HOUR_MS = 60 * 60 * 1000;
const MISSED_STATUSES = ['not_picked', 'switch_off'] as const;

/**
 * Decide whether a lead should appear in the active follow-up queue.
 * Rules (in priority order):
 *  1. Not interested / permanently hidden never show.
 *  2. If a follow-up is scheduled, show only once that time has arrived.
 *  3. Leads acted on (lastShownAt) without a follow-up stay hidden unless
 *     they are not_picked / switch_off and their hide window has passed.
 *  4. hiddenUntil blocks the lead until that time.
 *  5. New not_picked / switch_off leads (no lastShownAt) show immediately.
 */
export function shouldShowLead(lead: Lead, now: Date = new Date()): boolean {
  if (lead.status === 'not_interested') return false;
  if (lead.permanentlyHidden) return false;

  if (lead.nextFollowUp) {
    return now >= new Date(lead.nextFollowUp);
  }

  if (
    lead.lastShownAt &&
    !MISSED_STATUSES.includes(lead.status as (typeof MISSED_STATUSES)[number])
  ) {
    return false;
  }

  if (lead.hiddenUntil && now < new Date(lead.hiddenUntil)) return false;

  if (lead.status === 'not_picked' || lead.status === 'switch_off') {
    if (!lead.lastShownAt) return true;

    const elapsed = now.getTime() - new Date(lead.lastShownAt).getTime();

    if (lead.status === 'not_picked') {
      return elapsed >= 24 * HOUR_MS;
    }

    if (lead.missedCallCount === 0) return elapsed >= 24 * HOUR_MS;
    if (lead.missedCallCount === 1) return elapsed >= 48 * HOUR_MS;
    return elapsed >= 72 * HOUR_MS;
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
