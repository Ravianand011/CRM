import { useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '../types/Lead';
import { LEAD_STATUSES, STATUS_LABELS } from '../types/Lead';
import { sortLeads, type SortKey } from '../services/leadsApi';
import { FollowUpQueue } from '../components/FollowUpQueue';

interface AllLeadsProps {
  leads: Lead[];
  search: string;
  onEdit: (lead: Lead) => void;
}

const selectClass =
  'rounded-md border border-line-2 bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand-border';

export function AllLeads({ leads, search, onEdit }: AllLeadsProps) {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('createdAt');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = leads;

    if (q) {
      result = result.filter((l) =>
        [l.name, l.phone, l.city, l.status, l.email ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }
    return sortLeads(result, sort);
  }, [leads, search, statusFilter, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">
          All Leads
          <span className="ml-2 text-[12px] font-normal text-ink-3">
            ({filtered.length})
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as LeadStatus | 'all')
            }
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="createdAt">Sort: Date added</option>
            <option value="nextFollowUp">Sort: Next follow-up</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
      </div>

      <FollowUpQueue
        leads={filtered}
        onEdit={onEdit}
        emptyMessage="No leads match your search/filter."
      />
    </div>
  );
}
