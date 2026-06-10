import type { Lead, LeadStatus } from '../types/Lead';
import { STATUS_LABELS, isFreshLead } from '../types/Lead';

const STATUS_CLASSES: Record<LeadStatus, string> = {
  not_picked: 'bg-tone-gray-bg text-tone-gray-tx',
  picked: 'bg-tone-blue-bg text-tone-blue-tx',
  demo_scheduled: 'bg-tone-amber-bg text-tone-amber-tx',
  demo_done: 'bg-tone-purple-bg text-tone-purple-tx',
  converted: 'bg-tone-green-bg text-tone-green-tx',
  not_interested: 'bg-tone-red-bg text-tone-red-tx',
  switch_off: 'bg-tone-gray-bg text-tone-gray-tx',
};

export function StatusBadge({ lead }: { lead: Lead }) {
  if (isFreshLead(lead)) return null;

  const { status } = lead;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[10px] px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
