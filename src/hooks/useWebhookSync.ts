import { useEffect, useCallback } from 'react';
import type { Lead } from '../types/Lead';
import {
  getDataMode,
  readLeads,
  setDataMode,
  writeLeads,
} from '../utils/storage';

const WEBHOOK_SERVER =
  import.meta.env.VITE_WEBHOOK_URL || 'http://localhost:3000';

export function useWebhookSync(onSynced?: () => void) {
  const syncLeads = useCallback(async () => {
    try {
      const res = await fetch(`${WEBHOOK_SERVER}/leads`);
      if (!res.ok) return;
      const newLeads: Lead[] = await res.json();
      if (!newLeads.length) return;

      const prevMode = getDataMode();
      setDataMode('real');
      const existing = readLeads();

      const existingPhones = new Set(existing.map((l) => l.phone));
      const brandNew = newLeads.filter((l) => !existingPhones.has(l.phone));

      if (brandNew.length > 0) {
        writeLeads([...brandNew, ...existing]);
        console.log(`${brandNew.length} new Facebook leads synced!`);

        window.dispatchEvent(
          new CustomEvent('newLeadsReceived', {
            detail: { count: brandNew.length, leads: brandNew },
          }),
        );

        onSynced?.();
      }

      setDataMode(prevMode);
    } catch (err) {
      console.log('Webhook server not reachable:', err);
    }
  }, [onSynced]);

  useEffect(() => {
    void syncLeads();
    const interval = setInterval(() => void syncLeads(), 30000);
    return () => clearInterval(interval);
  }, [syncLeads]);

  return { syncLeads };
}
