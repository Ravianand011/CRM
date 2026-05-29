import { BellRing } from 'lucide-react';
import type { DemoReminder } from '../hooks/useNotifications';
import { formatIST } from '../utils/datetime';

interface DemoNotificationProps {
  reminders: DemoReminder[];
  onSelect: (leadId: string) => void;
}

export function DemoNotification({
  reminders,
  onSelect,
}: DemoNotificationProps) {
  if (reminders.length === 0) return null;

  const first = reminders[0];
  const extra = reminders.length - 1;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-alert-border bg-alert-bg px-3.5 py-2.5">
      <BellRing size={18} className="shrink-0 text-alert-tx" />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-alert-tx">
          Demo reminder - {first.name}
          {extra > 0 && ` (+${extra} more)`}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-alert-sub">
          Scheduled at {formatIST(first.scheduledAt)}
        </div>
      </div>
      <button
        onClick={() => onSelect(first.leadId)}
        className="ml-auto shrink-0 rounded-md bg-alert-sub px-3 py-1.5 text-[12px] font-medium text-alert-bg hover:opacity-95"
      >
        View lead
      </button>
    </div>
  );
}
