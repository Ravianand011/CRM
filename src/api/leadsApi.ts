const BASE_URL =
  import.meta.env.VITE_WEBHOOK_URL ||
  'https://crm-production-be3b.up.railway.app';

export interface ApiLead {
  _id: string;
  id?: string;
  fbLeadId?: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  qualification?: string;
  whenPlanningToJoin?: string;
  source: string;
  status: string;
  missedCallCount: number;
  permanentlyHidden: boolean;
  nextFollowUp?: string;
  demoScheduledAt?: string;
  hiddenUntil?: string;
  lastShownAt?: string;
  callHistory: Array<{
    id?: string;
    note: string;
    statusAtTime: string;
    timestamp: string;
  }>;
  fbAdName?: string;
  fbCampaignName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MigrateResult {
  success: boolean;
  inserted: number;
  skipped: number;
  total: number;
}

export interface SyncFacebookResult {
  success: boolean;
  added: number;
  skipped: number;
  filtered: number;
  forms: number;
  total: number;
  pageId?: string;
  syncFrom: string;
  error?: string;
}

export interface SyncFacebookProgress {
  active: boolean;
  percent: number;
  message: string;
  added: number;
  skipped: number;
  filtered: number;
  processedForms: number;
  totalForms: number;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export const leadsApi = {
  getAll: async (): Promise<ApiLead[]> => {
    const res = await fetch(`${BASE_URL}/leads`);
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  create: async (lead: Partial<ApiLead>): Promise<ApiLead> => {
    const res = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  update: async (id: string, data: Partial<ApiLead>): Promise<ApiLead> => {
    const res = await fetch(`${BASE_URL}/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/leads/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await parseError(res));
  },

  migrate: async (leads: unknown[]): Promise<MigrateResult> => {
    const res = await fetch(`${BASE_URL}/migrate-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  syncFacebook: async (): Promise<SyncFacebookResult> => {
    const res = await fetch(`${BASE_URL}/sync-facebook`, {
      method: 'POST',
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Facebook sync failed');
    }
    return body;
  },

  syncFacebookStatus: async (): Promise<SyncFacebookProgress> => {
    const res = await fetch(`${BASE_URL}/sync-facebook/status`);
    if (!res.ok) throw new Error('Failed to fetch sync status');
    return res.json();
  },
};
