import { useEffect, useCallback } from 'react';
import type { Lead } from '../types/Lead';
import { normalizePhone } from '../utils/phone';
import { isLeadBlocked } from '../utils/syncBlocklist';
import {
  getDataMode,
  readLeads,
  setDataMode,
  writeLeads,
} from '../utils/storage';

const WEBHOOK_SERVER =
  import.meta.env.VITE_WEBHOOK_URL ||
  'https://crm-production-be3b.up.railway.app';

export function useWebhookSync(onSynced?: () => void) {
  const pullLeads = useCallback(async () => {
    const prevMode = getDataMode();
    try {
      const base = WEBHOOK_SERVER.replace(/\/$/, '');
      const res = await fetch(`${base}/leads`);
      if (!res.ok) return;

      const serverLeads: Lead[] = await res.json();

      setDataMode('real');
      const existing = readLeads();

      const existingPhones = new Set(
        existing.map((l) => normalizePhone(l.phone)).filter(Boolean),
      );
      const existingFbIds = new Set(
        existing.map((l) => l.fbLeadId).filter(Boolean),
      );

      const brandNew = serverLeads.filter((l) => {
        if (isLeadBlocked(l)) return false;
        if (l.fbLeadId && existingFbIds.has(l.fbLeadId)) return false;
        const phoneKey = normalizePhone(l.phone);
        if (phoneKey && existingPhones.has(phoneKey)) return false;
        return true;
      });

      if (brandNew.length > 0) {
        writeLeads([...brandNew, ...existing]);
        console.log(`${brandNew.length} new lead(s) synced from server`);

        window.dispatchEvent(
          new CustomEvent('newLeadsReceived', {
            detail: { count: brandNew.length, leads: brandNew },
          }),
        );

        onSynced?.();
      }

    } catch (err) {
      console.log('Webhook server not reachable:', err);
    } finally {
      setDataMode(prevMode);
    }
  }, [onSynced]);

  useEffect(() => {
    void pullLeads();
    const interval = setInterval(() => void pullLeads(), 30000);
    return () => clearInterval(interval);
  }, [pullLeads]);

  return { pullLeads };
}
