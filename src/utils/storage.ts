import type { Lead } from '../types/Lead';

const REAL_KEY = 'crm_leads';
const DEMO_KEY = 'crm_leads_demo';
const MODE_KEY = 'crm_data_mode';

export type DataMode = 'real' | 'demo';

let activeKey = REAL_KEY;

/** Point all reads/writes at the real or demo dataset. */
export function setDataMode(mode: DataMode): void {
  activeKey = mode === 'demo' ? DEMO_KEY : REAL_KEY;
}

export function getDataMode(): DataMode {
  return activeKey === DEMO_KEY ? 'demo' : 'real';
}

/** Persist the chosen mode so it survives reloads. */
export function readStoredMode(): DataMode {
  return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real';
}

export function writeStoredMode(mode: DataMode): void {
  localStorage.setItem(MODE_KEY, mode);
}

/** Read all leads from the active dataset. */
export function readLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(activeKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Lead[];
  } catch {
    return [];
  }
}

/** Persist the full leads array to the active dataset. */
export function writeLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(activeKey, JSON.stringify(leads));
  } catch (err) {
    console.error('Failed to save leads to localStorage', err);
  }
}

/** Trigger a download of all leads as a JSON backup file. */
export function downloadBackup(leads: Lead[]): void {
  const blob = new Blob([JSON.stringify(leads, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `crm-leads-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
