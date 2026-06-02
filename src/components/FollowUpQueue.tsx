import { Inbox } from 'lucide-react';
import type { Lead } from '../types/Lead';
import { LeadCard } from './LeadCard';

interface FollowUpQueueProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onNotInterested?: (lead: Lead) => void;
  emptyMessage?: string;
}

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  // Treat +91XXXXXXXXXX / 91XXXXXXXXXX as same as XXXXXXXXXX
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function FollowUpQueue({
  leads,
  onEdit,
  onDelete,
  onNotInterested,
  emptyMessage = 'Nothing here right now.',
}: FollowUpQueueProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-2 bg-surface py-14 text-ink-3">
        <Inbox size={32} />
        <p className="mt-3 text-[13px]">{emptyMessage}</p>
      </div>
    );
  }

  // Mark only repeated occurrences as duplicate:
  // first lead for a phone = normal, subsequent leads = duplicate.
  const seenPhones = new Set<string>();
  const duplicateLeadIds = new Set<string>();
  for (const lead of leads) {
    const key = normalizePhone(lead.phone);
    if (!key) continue;
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
          onNotInterested={onNotInterested}
          isDuplicate={duplicateLeadIds.has(lead.id)}
        />
      ))}
    </div>
  );
}
