import { Inbox } from 'lucide-react';
import type { Lead } from '../types/Lead';
import { getDuplicatePhoneKeys } from '../utils/duplicates';
import { normalizePhone } from '../utils/phone';
import { LeadCard } from './LeadCard';

interface FollowUpQueueProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  emptyMessage?: string;
  /** Full dataset for duplicate badge detection (defaults to `leads`). */
  allLeads?: Lead[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (leadId: string) => void;
}

export function FollowUpQueue({
  leads,
  onEdit,
  onDelete,
  emptyMessage = 'Nothing here right now.',
  allLeads,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: FollowUpQueueProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-2 bg-surface py-14 text-ink-3">
        <Inbox size={32} />
        <p className="mt-3 text-[13px]">{emptyMessage}</p>
      </div>
    );
  }

  const source = allLeads ?? leads;
  const dupPhones = getDuplicatePhoneKeys(source);
  const seenPhones = new Set<string>();
  const duplicateLeadIds = new Set<string>();
  for (const lead of leads) {
    const key = normalizePhone(lead.phone);
    if (!key || !dupPhones.has(key)) continue;
    if (seenPhones.has(key)) {
      duplicateLeadIds.add(lead.id);
    } else {
      seenPhones.add(key);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onEdit={onEdit}
          onDelete={onDelete}
          isDuplicate={duplicateLeadIds.has(lead.id)}
          selectable={selectable}
          selected={selectedIds?.has(lead.id)}
          onSelectChange={
            onToggleSelect ? () => onToggleSelect(lead.id) : undefined
          }
        />
      ))}
    </div>
  );
}
