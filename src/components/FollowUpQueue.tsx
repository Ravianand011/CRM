import { Inbox } from 'lucide-react';
import type { Lead } from '../types/Lead';
import { LeadCard } from './LeadCard';

interface FollowUpQueueProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  emptyMessage?: string;
}

export function FollowUpQueue({
  leads,
  onEdit,
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

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onEdit={onEdit} />
      ))}
    </div>
  );
}
