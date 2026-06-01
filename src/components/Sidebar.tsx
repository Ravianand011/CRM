import {
  CalendarCheck2,
  CheckCircle2,
  Megaphone,
  LayoutDashboard,
  Plus,
  Upload,
  Users,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { View } from '../types/navigation';

export interface NavCounts {
  dashboard: number;
  demo: number;
  converted: number;
}

interface SidebarProps {
  active: View;
  counts: NavCounts;
  onNavigate: (view: View) => void;
  onNewLead: () => void;
  onExport: () => void;
  onRefreshLeads?: () => void;
}

type BadgeTone = 'red' | 'green';

interface NavEntry {
  id: View;
  label: string;
  icon: typeof Users;
  countKey?: keyof NavCounts;
  tone?: BadgeTone;
}

const MAIN_NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, countKey: 'dashboard', tone: 'red' },
  { id: 'all', label: 'All Leads', icon: Users },
  { id: 'demo', label: 'Demo Scheduled', icon: CalendarCheck2, countKey: 'demo', tone: 'red' },
  { id: 'converted', label: 'Converted', icon: CheckCircle2, countKey: 'converted', tone: 'green' },
];

const TOOLS_NAV: NavEntry[] = [
  { id: 'import', label: 'Import Excel', icon: Upload },
];

function NavButton({
  entry,
  active,
  count,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  count?: number;
  onNavigate: (view: View) => void;
}) {
  const { icon: Icon, tone } = entry;
  return (
    <button
      onClick={() => onNavigate(entry.id)}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition ${
        active
          ? 'border-r-2 border-brand bg-brand-soft font-medium text-brand-dark'
          : 'text-ink-2 hover:bg-surface-2'
      }`}
    >
      <Icon size={16} />
      {entry.label}
      {typeof count === 'number' && count > 0 && (
        <span
          className={`ml-auto rounded-[10px] px-[7px] py-px text-[11px] font-medium ${
            tone === 'green'
              ? 'bg-tone-green-bg text-tone-green-tx'
              : 'bg-tone-red-bg text-tone-red-tx'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  active,
  counts,
  onNavigate,
  onNewLead,
  onExport,
  onRefreshLeads,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[210px] shrink-0 flex-col border-r border-line bg-surface py-4">
      <div className="mb-2 border-b border-line px-4 pb-3.5">
        <div className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          <Megaphone size={15} className="text-brand" />
          Lead CRM
        </div>
        <div className="mt-0.5 text-[11px] text-ink-2">
          Facebook Campaign Manager
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {MAIN_NAV.map((entry) => (
          <NavButton
            key={entry.id}
            entry={entry}
            active={active === entry.id}
            count={entry.countKey ? counts[entry.countKey] : undefined}
            onNavigate={onNavigate}
          />
        ))}

        <div className="px-4 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">
          Tools
        </div>
        {TOOLS_NAV.map((entry) => (
          <NavButton
            key={entry.id}
            entry={entry}
            active={active === entry.id}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-2 px-4 pt-3">
        <button
          onClick={onNewLead}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-brand-soft hover:opacity-95"
        >
          <Plus size={15} /> New Lead
        </button>
        {onRefreshLeads && (
          <button
            type="button"
            onClick={() => void onRefreshLeads()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-line-2 px-3 py-2 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
          >
            <RefreshCw size={14} /> Refresh leads
          </button>
        )}
        <button
          onClick={onExport}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-line-2 px-3 py-2 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
        >
          <Download size={14} /> Export Backup
        </button>
      </div>
    </aside>
  );
}
