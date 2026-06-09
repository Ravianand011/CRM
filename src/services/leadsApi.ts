import type { CallNote, Lead, LeadSource, LeadStatus } from '../types/Lead';
import type { ParsedLeadRow } from '../utils/excelMapper';
import { leadsApi, type ApiLead } from '../api/leadsApi';
import {
  downloadBackup,
  getDataMode,
  readLeads,
  writeLeads,
} from '../utils/storage';

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
  comment?: string;
  source?: LeadSource;
  createdAt?: string;
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

export function normalizeApiLead(doc: ApiLead): Lead {
  return {
    id: doc.id || doc._id,
    fbLeadId: doc.fbLeadId,
    name: doc.name || '',
    phone: doc.phone || '',
    email: doc.email,
    qualification: doc.qualification || '',
    city: doc.city || '',
    whenPlanningToJoin: doc.whenPlanningToJoin,
    source: (doc.source as LeadSource) || 'manual',
    status: doc.status as LeadStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    nextFollowUp: doc.nextFollowUp,
    demoScheduledAt: doc.demoScheduledAt,
    hiddenUntil: doc.hiddenUntil,
    lastShownAt: doc.lastShownAt,
    missedCallCount: doc.missedCallCount ?? 0,
    permanentlyHidden: doc.permanentlyHidden ?? false,
    callHistory: (doc.callHistory || []).map((n, i) => ({
      id: n.id || `note_${i}`,
      note: n.note || '',
      statusAtTime: n.statusAtTime as LeadStatus,
      timestamp: n.timestamp,
    })),
  };
}

function leadToApiPayload(lead: Lead): Partial<ApiLead> {
  return {
    fbLeadId: lead.fbLeadId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    qualification: lead.qualification,
    whenPlanningToJoin: lead.whenPlanningToJoin,
    source: lead.source,
    status: lead.status,
    missedCallCount: lead.missedCallCount,
    permanentlyHidden: lead.permanentlyHidden,
    nextFollowUp: lead.nextFollowUp,
    demoScheduledAt: lead.demoScheduledAt,
    hiddenUntil: lead.hiddenUntil,
    lastShownAt: lead.lastShownAt,
    callHistory: lead.callHistory.map(({ note, statusAtTime, timestamp }) => ({
      note,
      statusAtTime,
      timestamp,
    })),
  };
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

  if (MISSED_STATUSES.includes(newStatus)) {
    const wasMissed = prevStatus
      ? MISSED_STATUSES.includes(prevStatus)
      : false;
    if (wasMissed) base.missedCallCount = (prev?.missedCallCount ?? 0) + 1;
    base.lastShownAt = nowIso;
    base.hiddenUntil = base.nextFollowUp
      ? undefined
      : new Date(now.getTime() + hiddenWindowMs(base.missedCallCount)).toISOString();
  } else {
    base.hiddenUntil = undefined;
  }

  if (newStatus === 'not_interested') {
    base.permanentlyHidden = true;
    base.hiddenUntil = undefined;
    base.nextFollowUp = undefined;
  }

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

export async function getLeads(): Promise<Lead[]> {
  if (getDataMode() === 'demo') {
    return readLeads();
  }
  const docs = await leadsApi.getAll();
  return docs.map(normalizeApiLead);
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const leads = await getLeads();
  return leads.find((l) => l.id === id);
}

export async function saveLead(
  form: LeadFormData,
  existingId?: string,
): Promise<Lead> {
  if (getDataMode() === 'demo') {
    const leads = readLeads();
    const prev = existingId
      ? leads.find((l) => l.id === existingId) ?? null
      : null;
    const saved = computeSavedLead(prev, form);
    const next = prev
      ? leads.map((l) => (l.id === saved.id ? saved : l))
      : [saved, ...leads];
    writeLeads(next);
    return saved;
  }

  const all = await getLeads();
  const prev = existingId
    ? all.find((l) => l.id === existingId) ?? null
    : null;
  const saved = computeSavedLead(prev, form);
  const payload = leadToApiPayload(saved);

  if (prev) {
    const updated = await leadsApi.update(saved.id, payload);
    return normalizeApiLead(updated);
  }

  const created = await leadsApi.create(payload);
  return normalizeApiLead(created);
}

export async function updateLead(
  id: string,
  patch: Partial<Lead>,
): Promise<Lead | undefined> {
  if (getDataMode() === 'demo') {
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

  const updated = await leadsApi.update(id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  return normalizeApiLead(updated);
}

export async function deleteLead(id: string): Promise<void> {
  if (getDataMode() === 'demo') {
    writeLeads(readLeads().filter((l) => l.id !== id));
    return;
  }
  await leadsApi.delete(id);
}

export async function bulkImport(
  rows: ParsedLeadRow[],
  meta?: Pick<ImportResult, 'matchedColumns' | 'ignoredColumns'>,
): Promise<ImportResult> {
  const leads = await getLeads();
  const existingPhones = new Set(leads.map((l) => l.phone).filter(Boolean));

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

    if (getDataMode() === 'real') {
      try {
        const created = await leadsApi.create(leadToApiPayload(lead));
        additions.push(normalizeApiLead(created));
      } catch {
        duplicates += 1;
        continue;
      }
    } else {
      additions.push(lead);
    }

    if (row.phone) existingPhones.add(row.phone);
    imported += 1;
  }

  if (getDataMode() === 'demo') {
    writeLeads([...additions, ...leads]);
  }

  const next = getDataMode() === 'demo' ? [...additions, ...leads] : await getLeads();
  return {
    imported,
    duplicates,
    leads: next,
    matchedColumns: meta?.matchedColumns,
    ignoredColumns: meta?.ignoredColumns,
  };
}

export async function searchLeads(
  query: string,
  filters: SearchFilters = {},
  sort: SortKey = 'createdAt',
): Promise<Lead[]> {
  const q = query.trim().toLowerCase();
  let result = await getLeads();

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

export async function exportBackup(): Promise<void> {
  downloadBackup(await getLeads());
}

export async function migrateFromLocalStorage(): Promise<{
  inserted: number;
  skipped: number;
  total: number;
}> {
  const raw = localStorage.getItem('crm_leads');
  const leads = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error('No leads found in localStorage');
  }
  const result = await leadsApi.migrate(leads);
  localStorage.removeItem('crm_leads');
  return result;
}
