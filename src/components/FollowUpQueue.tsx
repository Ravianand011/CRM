import { Inbox } from 'lucide-react';
import type { Lead } from '../types/Lead';
import { LeadCard } from './LeadCard';

interface FollowUpQueueProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
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

  const phoneCounts = leads.reduce<Record<string, number>>((acc, lead) => {
    const key = normalizePhone(lead.phone);
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onEdit={onEdit}
          onDelete={onDelete}
          isDuplicate={
            !!normalizePhone(lead.phone) &&
            (phoneCounts[normalizePhone(lead.phone)] ?? 0) > 1
          }
        />
      ))}
    </div>
  );
}
