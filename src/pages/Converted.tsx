import { useMemo } from 'react';
import type { Lead } from '../types/Lead';
import { FollowUpQueue } from '../components/FollowUpQueue';

interface ConvertedProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
}

export function Converted({ leads, onEdit }: ConvertedProps) {
  const won = useMemo(
    () =>
      leads
        .filter((l) => l.status === 'converted')
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [leads],
  );

  return (
    <div>
      <h2 className="mb-3 text-[14px] font-medium text-ink">
        Converted
        <span className="ml-2 text-[12px] font-normal text-ink-3">
          ({won.length})
        </span>
      </h2>
      <FollowUpQueue
        leads={won}
        onEdit={onEdit}
        emptyMessage="No converted leads yet."
      />
    </div>
  );
}
