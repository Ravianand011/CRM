import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lead } from '../types/Lead';
import type { ParsedLeadRow } from '../utils/excelMapper';
import {
  getDataMode,
  readStoredMode,
  setDataMode,
  writeLeads,
  writeStoredMode,
  type DataMode,
} from '../utils/storage';
import { buildDemoLeads } from '../utils/demoData';
import { leadsApi } from '../api/leadsApi';
import {
  bulkImport,
  deleteLead,
  exportBackup,
  getLeads,
  migrateFromLocalStorage,
  saveLead,
  updateLead,
  type ImportResult,
  type LeadFormData,
} from '../services/leadsApi';

const REFRESH_MS = 60_000;
const RETRY_MS = 5_000;

/**
 * Central React layer over the leads API. Real mode loads from MongoDB via
 * Railway; demo mode uses in-memory sample data in localStorage.
 */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mode, setModeState] = useState<DataMode>('real');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingFacebook, setSyncingFacebook] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const facebookSyncStarted = useRef(false);

  const fetchLeads = useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = opts?.initial ?? false;
    if (!isInitial) setRefreshing(true);

    try {
      setDataMode(getDataMode());
      const data = await getLeads();
      setLeads(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch leads', err);
      if (getDataMode() === 'real') {
        setError('Connection error - retrying...');
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          void fetchLeads();
        }, RETRY_MS);
      }
    } finally {
      if (!isInitial) setRefreshing(false);
      if (isInitial) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    void (async () => {
      const stored = readStoredMode();
      setDataMode(stored);
      if (stored === 'demo') writeLeads(buildDemoLeads());
      setModeState(stored);
      await fetchLeads({ initial: true });
    })();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [fetchLeads]);

  useEffect(() => {
    if (mode !== 'real') return;
    const interval = setInterval(() => {
      void fetchLeads();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [mode, fetchLeads]);

  const syncFacebook = useCallback(async () => {
    if (getDataMode() !== 'real') return null;
    setSyncingFacebook(true);
    try {
      const result = await leadsApi.syncFacebook();
      await refresh();
      setError(null);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Facebook sync failed';
      setError(message);
      throw err;
    } finally {
      setSyncingFacebook(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (mode !== 'real' || loading || facebookSyncStarted.current) return;
    facebookSyncStarted.current = true;
    void syncFacebook().catch(() => {
      // Error surfaced via `error` state; user can retry with the button.
    });
  }, [mode, loading, syncFacebook]);

  const switchMode = useCallback(
    async (next: DataMode) => {
      if (next === getDataMode()) return;
      setDataMode(next);
      if (next === 'demo') writeLeads(buildDemoLeads());
      writeStoredMode(next);
      setModeState(next);
      setLoading(true);
      await fetchLeads({ initial: true });
    },
    [fetchLeads],
  );

  const save = useCallback(
    async (form: LeadFormData, existingId?: string): Promise<Lead> => {
      const saved = await saveLead(form, existingId);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const patch = useCallback(
    async (id: string, fields: Partial<Lead>) => {
      const updated = await updateLead(id, fields);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteLead(id);
      await refresh();
    },
    [refresh],
  );

  const importRows = useCallback(
    async (
      rows: ParsedLeadRow[],
      meta?: Pick<ImportResult, 'matchedColumns' | 'ignoredColumns'>,
    ): Promise<ImportResult> => {
      const result = await bulkImport(rows, meta);
      await refresh();
      return result;
    },
    [refresh],
  );

  const backup = useCallback(async () => {
    await exportBackup();
  }, []);

  const migrate = useCallback(async () => {
    const result = await migrateFromLocalStorage();
    await refresh();
    return result;
  }, [refresh]);

  return {
    leads,
    loading,
    refreshing,
    syncingFacebook,
    error,
    mode,
    switchMode,
    refresh,
    syncFacebook,
    save,
    patch,
    remove,
    importRows,
    backup,
    migrate,
  };
}
