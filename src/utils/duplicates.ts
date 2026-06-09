import type { Lead } from '../types/Lead';
import { normalizePhone } from './phone';

/** Phones that appear on 2+ leads in the dataset. */
export function getDuplicatePhoneKeys(leads: Lead[]): Set<string> {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = normalizePhone(lead.phone);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [phone, count] of counts) {
    if (count >= 2) dupes.add(phone);
  }
  return dupes;
}

/** All leads whose phone exists 2+ times in the dataset. */
export function getDuplicateLeads(leads: Lead[]): Lead[] {
  const dupPhones = getDuplicatePhoneKeys(leads);
  return leads.filter((l) => {
    const key = normalizePhone(l.phone);
    return key && dupPhones.has(key);
  });
}

/** True when this lead shares a phone with at least one other lead. */
export function isPhoneDuplicated(lead: Lead, allLeads: Lead[]): boolean {
  const key = normalizePhone(lead.phone);
  if (!key) return false;
  return getDuplicatePhoneKeys(allLeads).has(key);
}
