import { useCallback, useEffect, useState } from 'react';
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
import {
  bulkImport,
  deleteLead,
  exportBackup,
  getLeads,
  saveLead,
  updateLead,
  type ImportResult,
  type LeadFormData,
} from '../services/leadsApi';

/**
 * Central React layer over the leads API. Holds the full leads list in state
 * and re-syncs from storage after every mutation so all views stay in sync.
 * Supports switching between the real dataset and a generated demo dataset.
 */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mode, setModeState] = useState<DataMode>('real');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getLeads();
    setLeads(data);
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = readStoredMode();
      setDataMode(stored);
      // Always (re)seed demo data so its timestamps stay current.
      if (stored === 'demo') writeLeads(buildDemoLeads());
      setModeState(stored);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const switchMode = useCallback(
    async (next: DataMode) => {
      if (next === getDataMode()) return;
      setDataMode(next);
      if (next === 'demo') writeLeads(buildDemoLeads());
      writeStoredMode(next);
      setModeState(next);
      await refresh();
    },
    [refresh],
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
    async (rows: ParsedLeadRow[]): Promise<ImportResult> => {
      const result = await bulkImport(rows);
      await refresh();
      return result;
    },
    [refresh],
  );

  const backup = useCallback(async () => {
    await exportBackup();
  }, []);

  return {
    leads,
    loading,
    mode,
    switchMode,
    refresh,
    save,
    patch,
    remove,
    importRows,
    backup,
  };
}
