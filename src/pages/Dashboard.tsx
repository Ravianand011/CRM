import { useMemo, useState } from 'react';
import { AlertCircle, Clock, Users, TrendingUp } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { Lead } from '../types/Lead';
import type { DemoReminder } from '../hooks/useNotifications';
import { buildQueue, isOverdue } from '../utils/scheduler';
import { FollowUpQueue } from '../components/FollowUpQueue';
import { DemoNotification } from '../components/DemoNotification';
import { StatCard } from '../components/StatCard';

interface DashboardProps {
  leads: Lead[];
  now: Date;
  reminders: DemoReminder[];
  onEdit: (lead: Lead) => void;
  onSelectReminder: (leadId: string) => void;
}

type QueueFilter = 'all' | 'not_picked' | 'switch_off' | 'scheduled';

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'not_picked', label: 'Not picked' },
  { id: 'switch_off', label: 'Switch off' },
  { id: 'scheduled', label: 'Scheduled' },
];

export function Dashboard({
  leads,
  now,
  reminders,
  onEdit,
  onSelectReminder,
}: DashboardProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');

  const queue = useMemo(() => buildQueue(leads, now), [leads, now]);

  const stats = useMemo(() => {
    const overdue = queue.filter((l) => isOverdue(l, now)).length;
    const thisWeek = leads.filter(
      (l) => differenceInDays(now, new Date(l.createdAt)) < 7,
    ).length;
    const demos = leads.filter((l) => l.status === 'demo_scheduled').length;
    const converted = leads.filter((l) => l.status === 'converted').length;
    const rate = leads.length
      ? ((converted / leads.length) * 100).toFixed(1)
      : '0.0';
    return { overdue, thisWeek, demos, converted, rate };
  }, [leads, queue, now]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'not_picked':
        return queue.filter((l) => l.status === 'not_picked');
      case 'switch_off':
        return queue.filter((l) => l.status === 'switch_off');
      case 'scheduled':
        return queue.filter((l) => !!l.nextFollowUp);
      default:
        return queue;
    }
  }, [queue, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Today's queue"
          value={queue.length}
          subIcon={Clock}
          subText={`${stats.overdue} overdue`}
        />
        <StatCard
          label="Total leads"
          value={leads.length}
          subIcon={Users}
          subText={`${stats.thisWeek} this week`}
        />
        <StatCard
          label="Demos scheduled"
          value={stats.demos}
          subIcon={AlertCircle}
          subText={`${reminders.length} in 30 min`}
          subColor="text-tone-amber-tx"
        />
        <StatCard
          label="Converted"
          value={stats.converted}
          subIcon={TrendingUp}
          subText={`${stats.rate}% rate`}
          subColor="text-tone-green-tx"
        />
      </div>

      <DemoNotification reminders={reminders} onSelect={onSelectReminder} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-medium text-ink">Follow-up queue</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${
                  filter === f.id
                    ? 'border-brand-border bg-brand-soft font-medium text-brand-dark'
                    : 'border-line-2 bg-surface text-ink-2 hover:bg-surface-2'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <FollowUpQueue
          leads={filtered}
          onEdit={onEdit}
          emptyMessage="No leads due right now. Great job staying on top of it!"
        />
      </div>
    </div>
  );
}
