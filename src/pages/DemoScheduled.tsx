import { useMemo } from 'react';
import type { Lead } from '../types/Lead';
import { FollowUpQueue } from '../components/FollowUpQueue';

interface DemoScheduledProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onNotInterested: (lead: Lead) => void;
}

export function DemoScheduled({
  leads,
  onEdit,
  onDelete,
  onNotInterested,
}: DemoScheduledProps) {
  const demos = useMemo(
    () =>
      leads
        .filter((l) => l.status === 'demo_scheduled' && !!l.demoScheduledAt)
        .sort(
          (a, b) =>
            new Date(a.demoScheduledAt as string).getTime() -
            new Date(b.demoScheduledAt as string).getTime(),
        ),
    [leads],
  );

  return (
    <div>
      <h2 className="mb-3 text-[14px] font-medium text-ink">
        Demo Scheduled
        <span className="ml-2 text-[12px] font-normal text-ink-3">
          ({demos.length})
        </span>
      </h2>
      <FollowUpQueue
        leads={demos}
        onEdit={onEdit}
        onDelete={onDelete}
        onNotInterested={onNotInterested}
        emptyMessage="No demos scheduled yet."
      />
    </div>
  );
}
