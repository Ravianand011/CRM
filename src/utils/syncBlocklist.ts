import type { Lead } from '../types/Lead';
import { normalizePhone } from './phone';

const PHONES_KEY = 'crm_sync_blocked_phones';
const FB_IDS_KEY = 'crm_sync_blocked_fb_ids';
const IDS_KEY = 'crm_sync_blocked_ids';

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter(Boolean)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (err) {
    console.error('Failed to save sync blocklist', err);
  }
}

/** Remember a locally deleted lead so webhook sync does not re-import it. */
export function markLeadDeleted(lead: Lead): void {
  const phones = readSet(PHONES_KEY);
  const fbIds = readSet(FB_IDS_KEY);
  const ids = readSet(IDS_KEY);

  const phone = normalizePhone(lead.phone);
  if (phone) phones.add(phone);
  if (lead.fbLeadId) fbIds.add(lead.fbLeadId);
  if (lead.id) ids.add(lead.id);

  writeSet(PHONES_KEY, phones);
  writeSet(FB_IDS_KEY, fbIds);
  writeSet(IDS_KEY, ids);
}

export function isLeadBlocked(
  lead: Pick<Lead, 'id' | 'phone' | 'fbLeadId'>,
): boolean {
  const phones = readSet(PHONES_KEY);
  const fbIds = readSet(FB_IDS_KEY);
  const ids = readSet(IDS_KEY);

  if (lead.fbLeadId && fbIds.has(lead.fbLeadId)) return true;
  if (lead.id && ids.has(lead.id)) return true;
  const phone = normalizePhone(lead.phone);
  return phone ? phones.has(phone) : false;
}
