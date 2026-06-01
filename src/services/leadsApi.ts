import type { CallNote, Lead, LeadSource, LeadStatus } from '../types/Lead';
import type { ParsedLeadRow } from '../utils/excelMapper';
import { downloadBackup, readLeads, writeLeads } from '../utils/storage';

const HOUR_MS = 60 * 60 * 1000;
const MISSED_STATUSES: LeadStatus[] = ['not_picked', 'switch_off'];

/** Payload produced by the lead form when creating or editing a lead. */
export interface LeadFormData {
  name: string;
  phone: string;
  email?: string;
  qualification: string;
  city: string;
  whenPlanningToJoin?: string;
  status: LeadStatus;
  nextFollowUp?: string;
  demoScheduledAt?: string;
  comment?: string; // appended to call history on save
  source?: LeadSource;
  createdAt?: string; // ISO — new leads only; edits keep original
}

export interface SearchFilters {
  status?: LeadStatus | 'all';
}

export type SortKey = 'createdAt' | 'nextFollowUp' | 'status';

export interface ImportResult {
  imported: number;
  duplicates: number;
  leads: Lead[];
  matchedColumns?: { field: string; fieldLabel: string; sheetHeader: string }[];
  ignoredColumns?: string[];
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hiddenWindowMs(missedCount: number): number {
  if (missedCount <= 0) return 24 * HOUR_MS;
  if (missedCount === 1) return 48 * HOUR_MS;
  return 72 * HOUR_MS;
}

/**
 * Pure function: given the previous lead state (or null for a new lead) and
 * the submitted form data, compute the next persisted lead applying all
 * business rules (missed-call cadence, permanent hide, call history).
 */
export function computeSavedLead(
  prev: Lead | null,
  form: LeadFormData,
  now: Date = new Date(),
): Lead {
  const nowIso = now.toISOString();
  const prevStatus = prev?.status;
  const newStatus = form.status;

  const base: Lead = prev
    ? { ...prev }
    : {
        id: newId(),
        name: '',
        phone: '',
        qualification: '',
        city: '',
        source: form.source ?? 'manual',
        status: newStatus,
        createdAt: nowIso,
        updatedAt: nowIso,
        callHistory: [],
        missedCallCount: 0,
        permanentlyHidden: false,
      };

  base.name = form.name.trim();
  base.phone = form.phone.trim();
  base.email = form.email?.trim() || undefined;
  base.qualification = form.qualification.trim();
  base.city = form.city.trim();
  base.whenPlanningToJoin = form.whenPlanningToJoin?.trim() || undefined;
  if (!prev && form.createdAt) {
    base.createdAt = form.createdAt;
  }
  base.status = newStatus;
  base.nextFollowUp = form.nextFollowUp || undefined;
  base.demoScheduledAt = form.demoScheduledAt || undefined;
  base.updatedAt = nowIso;
  if (form.source) base.source = form.source;

  // Missed-call re-show cadence.
  if (MISSED_STATUSES.includes(newStatus)) {
    const wasMissed = prevStatus
      ? MISSED_STATUSES.includes(prevStatus)
      : false;
    if (wasMissed) base.missedCallCount = (prev?.missedCallCount ?? 0) + 1;
    base.lastShownAt = nowIso;
    // An explicit follow-up time takes priority over the auto timer.
    base.hiddenUntil = base.nextFollowUp
      ? undefined
      : new Date(now.getTime() + hiddenWindowMs(base.missedCallCount)).toISOString();
  } else {
    base.hiddenUntil = undefined;
  }

  // Permanent hide: lost the lead after a demo was scheduled/done.
  if (
    newStatus === 'not_interested' &&
    (prevStatus === 'demo_scheduled' || prevStatus === 'demo_done')
  ) {
    base.permanentlyHidden = true;
  }

  // Append the current comment to the call history timeline.
  const comment = form.comment?.trim();
  if (comment) {
    const note: CallNote = {
      id: newId(),
      timestamp: nowIso,
      note: comment,
      statusAtTime: newStatus,
    };
    base.callHistory = [...base.callHistory, note];
  }
  base.currentComment = undefined;

  return base;
}

// --- Internal API (localStorage-backed). Async-style so a real backend can
// drop in later without touching callers. ---

export async function getLeads(): Promise<Lead[]> {
  return readLeads();
}

export async function getLead(id: string): Promise<Lead | undefined> {
  return readLeads().find((l) => l.id === id);
}

/** Create or update a lead from form data. Returns the saved lead. */
export async function saveLead(
  form: LeadFormData,
  existingId?: string,
): Promise<Lead> {
  const leads = readLeads();
  const prev = existingId ? leads.find((l) => l.id === existingId) ?? null : null;
  const saved = computeSavedLead(prev, form);

  const next = prev
    ? leads.map((l) => (l.id === saved.id ? saved : l))
    : [saved, ...leads];

  writeLeads(next);
  return saved;
}

/** Patch arbitrary fields on a lead (low-level update). */
export async function updateLead(
  id: string,
  patch: Partial<Lead>,
): Promise<Lead | undefined> {
  const leads = readLeads();
  let updated: Lead | undefined;
  const next = leads.map((l) => {
    if (l.id !== id) return l;
    updated = { ...l, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  writeLeads(next);
  return updated;
}

export async function deleteLead(id: string): Promise<void> {
  writeLeads(readLeads().filter((l) => l.id !== id));
}

/** Import parsed spreadsheet rows, skipping phone-number duplicates. */
export async function bulkImport(
  rows: ParsedLeadRow[],
  meta?: Pick<ImportResult, 'matchedColumns' | 'ignoredColumns'>,
): Promise<ImportResult> {
  const leads = readLeads();
  const existingPhones = new Set(
    leads.map((l) => l.phone).filter(Boolean),
  );

  let imported = 0;
  let duplicates = 0;
  const additions: Lead[] = [];

  for (const row of rows) {
    if (row.phone && existingPhones.has(row.phone)) {
      duplicates += 1;
      continue;
    }
    const nowIso = new Date().toISOString();
    const lead: Lead = {
      id: newId(),
      name: row.name,
      phone: row.phone,
      email: row.email,
      qualification: row.qualification,
      city: row.city,
      whenPlanningToJoin: row.whenPlanningToJoin,
      source: 'excel_import',
      status: 'not_picked',
      createdAt: row.createdAt || nowIso,
      updatedAt: nowIso,
      callHistory: [],
      missedCallCount: 0,
      permanentlyHidden: false,
    };
    additions.push(lead);
    if (row.phone) existingPhones.add(row.phone);
    imported += 1;
  }

  const next = [...additions, ...leads];
  writeLeads(next);
  return {
    imported,
    duplicates,
    leads: next,
    matchedColumns: meta?.matchedColumns,
    ignoredColumns: meta?.ignoredColumns,
  };
}

/** Search + filter + sort leads (used by the All Leads page). */
export async function searchLeads(
  query: string,
  filters: SearchFilters = {},
  sort: SortKey = 'createdAt',
): Promise<Lead[]> {
  const q = query.trim().toLowerCase();
  let result = readLeads();

  if (q) {
    result = result.filter((l) =>
      [l.name, l.phone, l.city, l.status, l.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }

  if (filters.status && filters.status !== 'all') {
    result = result.filter((l) => l.status === filters.status);
  }

  return sortLeads(result, sort);
}

export function sortLeads(leads: Lead[], sort: SortKey): Lead[] {
  const copy = [...leads];
  switch (sort) {
    case 'nextFollowUp':
      return copy.sort((a, b) => {
        if (a.nextFollowUp && b.nextFollowUp) {
          return (
            new Date(a.nextFollowUp).getTime() -
            new Date(b.nextFollowUp).getTime()
          );
        }
        if (a.nextFollowUp) return -1;
        if (b.nextFollowUp) return 1;
        return 0;
      });
    case 'status':
      return copy.sort((a, b) => a.status.localeCompare(b.status));
    case 'createdAt':
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

/** Download all leads as a JSON backup file. */
export async function exportBackup(): Promise<void> {
  downloadBackup(readLeads());
}
