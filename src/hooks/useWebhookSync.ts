import { useEffect, useCallback, useRef } from 'react';
import type { Lead } from '../types/Lead';
import {
  getDataMode,
  readLeads,
  setDataMode,
  writeLeads,
} from '../utils/storage';

/** Empty = same host (Railway combined deploy). Set VITE_WEBHOOK_URL for local dev. */
const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_URL ?? '').replace(/\/$/, '');

function mergeServerLeads(serverLeads: Lead[], existing: Lead[]) {
  const existingPhones = new Set(
    existing.map((l) => l.phone).filter(Boolean),
  );
  const existingFbIds = new Set(
    existing.map((l) => l.fbLeadId).filter(Boolean),
  );

  return serverLeads.filter((l) => {
    if (l.fbLeadId && existingFbIds.has(l.fbLeadId)) return false;
    if (l.phone && existingPhones.has(l.phone)) return false;
    return true;
  });
}

export function useWebhookSync(onSynced?: () => void) {
  const facebookPulled = useRef(false);

  const pullLeads = useCallback(async () => {
    try {
      const res = await fetch(`${WEBHOOK_BASE}/leads`);
      if (!res.ok) return;
      const serverLeads: Lead[] = await res.json();

      const prevMode = getDataMode();
      setDataMode('real');
      const existing = readLeads();
      const brandNew = mergeServerLeads(serverLeads, existing);

      if (brandNew.length > 0) {
        writeLeads([...brandNew, ...existing]);
        console.log(`${brandNew.length} Facebook lead(s) added to dashboard`);

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

  const syncFacebook = useCallback(async () => {
    try {
      const res = await fetch(`${WEBHOOK_BASE}/sync-facebook`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Facebook sync failed:', data.error || res.status);
        return data;
      }
      console.log('Facebook sync:', data);
      await pullLeads();
      return data;
    } catch (err) {
      console.log('Facebook sync error:', err);
      return null;
    }
  }, [pullLeads]);

  useEffect(() => {
    void (async () => {
      if (!facebookPulled.current) {
        facebookPulled.current = true;
        await syncFacebook();
      } else {
        await pullLeads();
      }
    })();

    const interval = setInterval(() => void pullLeads(), 30000);
    return () => clearInterval(interval);
  }, [pullLeads, syncFacebook]);

  return { syncLeads: pullLeads, syncFacebook };
}
