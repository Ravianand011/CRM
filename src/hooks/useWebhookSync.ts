import { useEffect, useCallback, useState } from 'react';
import type { Lead } from '../types/Lead';
import { normalizePhone } from '../utils/phone';
import { isLeadBlocked } from '../utils/syncBlocklist';
import { readRealLeads, readStoredMode, writeRealLeads } from '../utils/storage';

const WEBHOOK_SERVER =
  import.meta.env.VITE_WEBHOOK_URL ||
  'https://crm-production-be3b.up.railway.app';

export function useWebhookSync(onSynced?: () => void) {
  const [syncing, setSyncing] = useState(false);

  const pullLeads = useCallback(async (options?: { refreshUi?: boolean }) => {
    const manual = options?.refreshUi === true;
    if (manual) setSyncing(true);
    try {
      const base = WEBHOOK_SERVER.replace(/\/$/, '');
      const res = await fetch(`${base}/leads`);
      if (!res.ok) return;

      const serverLeads: Lead[] = await res.json();
      const existing = readRealLeads();

      const existingPhones = new Set(
        existing.map((l) => normalizePhone(l.phone)).filter(Boolean),
      );
      const existingIds = new Set(existing.map((l) => l.id).filter(Boolean));
      const existingFbIds = new Set(
        existing.map((l) => l.fbLeadId).filter(Boolean),
      );

      const brandNew = serverLeads.filter((l) => {
        if (l.id && existingIds.has(l.id)) return false;
        if (isLeadBlocked(l)) return false;
        if (l.fbLeadId && existingFbIds.has(l.fbLeadId)) return false;
        const phoneKey = normalizePhone(l.phone);
        if (phoneKey && existingPhones.has(phoneKey)) return false;
        return true;
      });

      const toAdd = brandNew.filter((l) => !isLeadBlocked(l));
      if (toAdd.length > 0) {
        writeRealLeads([...toAdd, ...existing]);
        console.log(`${toAdd.length} new lead(s) synced from server`);

        window.dispatchEvent(
          new CustomEvent('newLeadsReceived', {
            detail: { count: toAdd.length, leads: toAdd },
          }),
        );
      }

      const shouldRefreshUi =
        readStoredMode() === 'real' &&
        (toAdd.length > 0 || options?.refreshUi === true);
      if (shouldRefreshUi) {
        await onSynced?.();
      }
    } catch (err) {
      console.log('Webhook server not reachable:', err);
    } finally {
      if (manual) setSyncing(false);
    }
  }, [onSynced]);

  useEffect(() => {
    void pullLeads();
    const interval = setInterval(() => void pullLeads(), 30000);
    return () => clearInterval(interval);
  }, [pullLeads]);

  return { pullLeads, syncing };
}
