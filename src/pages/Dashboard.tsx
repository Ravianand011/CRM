import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Trash2, Users, TrendingUp } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { Lead, LeadStatus } from '../types/Lead';
import { LEAD_STATUSES, STATUS_LABELS } from '../types/Lead';
import type { DemoReminder } from '../hooks/useNotifications';
import { getDuplicateLeads } from '../utils/duplicates';
import { buildQueue, isOverdue } from '../utils/scheduler';
import { FollowUpQueue } from '../components/FollowUpQueue';
import { DemoNotification } from '../components/DemoNotification';
import { StatCard } from '../components/StatCard';

interface DashboardProps {
  leads: Lead[];
  now: Date;
  reminders: DemoReminder[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onBulkDelete: (leads: Lead[]) => Promise<void>;
  onSelectReminder: (leadId: string) => void;
}

type QueueFilter = 'all' | 'scheduled' | 'duplicates' | LeadStatus;
type DateSort = 'newest' | 'oldest';

const selectClass =
  'rounded-md border border-line-2 bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand-border';

export function Dashboard({
  leads,
  now,
  reminders,
  onEdit,
  onDelete,
  onBulkDelete,
  onSelectReminder,
}: DashboardProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [dateSort, setDateSort] = useState<DateSort>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const queue = useMemo(() => buildQueue(leads, now), [leads, now]);
  const duplicateLeads = useMemo(() => getDuplicateLeads(leads), [leads]);

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
    let result: Lead[];
    if (filter === 'duplicates') result = duplicateLeads;
    else if (filter === 'all') result = queue;
    else if (filter === 'scheduled') result = queue.filter((l) => !!l.nextFollowUp);
    else result = queue.filter((l) => l.status === filter);

    return [...result].sort((a, b) => {
      const diff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return dateSort === 'newest' ? diff : -diff;
    });
  }, [queue, filter, duplicateLeads, dateSort]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, dateSort]);

  const toggleSelect = (leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const selectedLeads = useMemo(
    () => filtered.filter((l) => selectedIds.has(l.id)),
    [filtered, selectedIds],
  );

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    const ok = window.confirm(
      `Delete ${selectedLeads.length} selected lead(s)? This cannot be undone.`,
    );
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await onBulkDelete(selectedLeads);
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const scrollToQueue = () => {
    document
      .getElementById('follow-up-queue')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Today's queue"
          value={queue.length}
          subIcon={Clock}
          subText={`${stats.overdue} overdue`}
          onClick={scrollToQueue}
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

      <div id="follow-up-queue">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[14px] font-medium text-ink">Follow-up queue</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className={selectClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value as QueueFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled follow-up</option>
              <option value="duplicates">
                Duplicates ({duplicateLeads.length})
              </option>
              {LEAD_STATUSES.filter((s) => s !== 'not_interested').map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={dateSort}
              onChange={(e) => setDateSort(e.target.value as DateSort)}
              aria-label="Sort by date"
            >
              <option value="newest">Date: Newest first</option>
              <option value="oldest">Date: Oldest first</option>
            </select>
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-line-2 accent-brand"
              />
              Select all ({filtered.length})
            </label>
            <button
              type="button"
              disabled={selectedLeads.length === 0 || bulkDeleting}
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center gap-1.5 rounded-md border border-tone-red-tx/30 bg-tone-red-bg px-3 py-1.5 text-[12px] font-medium text-tone-red-tx disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={13} />
              {bulkDeleting
                ? 'Deleting...'
                : `Delete selected (${selectedLeads.length})`}
            </button>
          </div>
        )}

        {filtered.length === 0 && leads.length > 0 && filter === 'all' && (
          <p className="mb-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
            You have {leads.length} lead(s) in the database, but none are due
            in today&apos;s queue (hidden by status, schedule, or follow-up
            timing). Open <strong>All Leads</strong> to see everything.
          </p>
        )}

        <FollowUpQueue
          leads={filtered}
          allLeads={leads}
          onEdit={onEdit}
          onDelete={onDelete}
          selectable
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          emptyMessage={
            filter === 'duplicates'
              ? 'No duplicate leads found.'
              : leads.length === 0
                ? 'No leads yet. Use Sync Facebook in the sidebar or Refresh leads.'
                : 'No leads due right now. Great job staying on top of it!'
          }
        />
      </div>
    </div>
  );
}
