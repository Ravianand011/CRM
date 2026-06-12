import {
  Calendar,
  CalendarCheck2,
  Clock,
  Trash2,
  Import,
  GraduationCap,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Save,
} from 'lucide-react';
import {
  differenceInHours,
  differenceInMinutes,
  formatDistanceToNow,
} from 'date-fns';
import type { Lead } from '../types/Lead';
import { StatusBadge } from './StatusBadge';
import { formatDateIST, formatIST } from '../utils/datetime';
import { isDueToday, isOverdue } from '../utils/scheduler';

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete?: (lead: Lead) => Promise<void> | void;
  isDuplicate?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: () => void;
}

const WHATSAPP_TEMPLATE = (name: string) =>
  `Hello ${name || 'there'}, this is regarding your inquiry. Please let us know a convenient time to connect.`;

const AVATAR_TONES = [
  'bg-av-blue-bg text-av-blue-tx',
  'bg-av-teal-bg text-av-teal-tx',
  'bg-av-purple-bg text-av-purple-tx',
];

function digitsOnly(phone: string): string {
  const d = phone.replace(/[^\d]/g, '');
  return d.length === 10 ? `91${d}` : d;
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

function toneFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % 3;
  return AVATAR_TONES[hash];
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const lbtn =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium';

export function LeadCard({
  lead,
  onEdit,
  onDelete,
  isDuplicate,
  selectable = false,
  selected = false,
  onSelectChange,
}: LeadCardProps) {
  const overdue = isOverdue(lead);
  const dueToday = !overdue && isDueToday(lead);

  const accent = overdue
    ? 'border-l-[3px] border-l-alert-border'
    : dueToday
      ? 'border-l-[3px] border-l-av-teal-tx'
      : '';

  const waUrl = `https://wa.me/${digitsOnly(lead.phone)}?text=${encodeURIComponent(
    WHATSAPP_TEMPLATE(lead.name),
  )}`;
  const mailUrl = lead.email
    ? `mailto:${lead.email}?subject=${encodeURIComponent(
        'Regarding your inquiry',
      )}&body=${encodeURIComponent(WHATSAPP_TEMPLATE(lead.name))}`
    : '';

  const lastNote = lead.callHistory[lead.callHistory.length - 1];
  const isFb = lead.source === 'excel_import' || lead.source === 'facebook';
  const isWebsite = lead.source === 'website';
  const attempt = lead.missedCallCount + 1;

  const overdueLabel = (() => {
    if (!lead.nextFollowUp) return '';
    const due = new Date(lead.nextFollowUp);
    const h = differenceInHours(new Date(), due);
    if (h >= 1) return `Overdue ${h}h`;
    const m = Math.max(differenceInMinutes(new Date(), due), 1);
    return `Overdue ${m}m`;
  })();

  return (
    <div
      className={`rounded-lg border border-line bg-surface p-3.5 ${accent}`}
    >
      <div className="flex items-start gap-2.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelectChange?.()}
            className="mt-2.5 h-4 w-4 shrink-0 rounded border-line-2 accent-brand"
            aria-label={`Select ${lead.name}`}
          />
        )}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${toneFor(
            lead.id,
          )}`}
        >
          {initials(lead.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-ink">
              {lead.name}
            </span>
            <StatusBadge lead={lead} />
            {lead.missedCallCount > 0 && (
              <span className="rounded-[10px] bg-tone-amber-bg px-2 py-0.5 text-[10px] font-medium text-tone-amber-tx">
                {ordinal(attempt)} attempt
              </span>
            )}
            {isFb && (
              <span className="inline-flex items-center gap-1 rounded-[10px] bg-tone-gray-bg px-2 py-0.5 text-[10px] font-medium text-tone-gray-tx">
                <Import size={10} /> FB import
              </span>
            )}
            {isWebsite && (
              <span className="inline-flex items-center gap-1 rounded-[10px] bg-tone-blue-bg px-2 py-0.5 text-[10px] font-medium text-tone-blue-tx">
                <Import size={10} /> Website
              </span>
            )}
            {isDuplicate && (
              <span className="rounded-[10px] bg-tone-red-bg px-2 py-0.5 text-[10px] font-medium text-tone-red-tx">
                Duplicate
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
            <span className="flex items-center gap-1">
              <Phone size={12} />
              {lead.phone || '-'}
            </span>
            {lead.city && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {lead.city}
              </span>
            )}
            {lead.qualification && (
              <span className="flex items-center gap-1">
                <GraduationCap size={12} />
                {lead.qualification}
              </span>
            )}
            {lead.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Added {formatDateIST(lead.createdAt)}
              </span>
            )}
            {lead.status === 'demo_scheduled' && lead.demoScheduledAt && (
              <span className="flex items-center gap-1 font-semibold text-tone-amber-tx">
                <CalendarCheck2 size={12} />
                Demo: {formatIST(lead.demoScheduledAt)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-[11px]">
          {overdue ? (
            <span className="flex items-center gap-1 text-tone-amber-tx">
              <Clock size={12} />
              {overdueLabel}
            </span>
          ) : dueToday ? (
            <span className="flex items-center gap-1 text-av-teal-tx">
              <CalendarCheck2 size={12} />
              Scheduled today
            </span>
          ) : lead.nextFollowUp ? (
            <span className="flex items-center gap-1 text-ink-2">
              <Clock size={12} />
              {formatIST(lead.nextFollowUp)}
            </span>
          ) : null}
        </div>
      </div>

      {lastNote && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-[12px] text-ink-2">
          <History size={14} className="shrink-0 text-ink-3" />
          <span className="truncate">
            Last call: "{lastNote.note}" ·{' '}
            {formatDistanceToNow(new Date(lastNote.timestamp), {
              addSuffix: true,
            })}
          </span>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className={`${lbtn} border-[#97c459] bg-tone-green-bg text-tone-green-tx`}
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
        {mailUrl ? (
          <a
            href={mailUrl}
            className={`${lbtn} border-brand-border bg-tone-blue-bg text-tone-blue-tx`}
          >
            <Mail size={13} /> Email
          </a>
        ) : (
          <span className={`${lbtn} border-line bg-surface-2 text-ink-3`}>
            <Mail size={13} /> No email
          </span>
        )}
        <button
          type="button"
          onClick={() => onEdit(lead)}
          className={`${lbtn} border-line-2 bg-surface text-ink-2 hover:bg-surface-2`}
        >
          <Pencil size={13} /> Update
        </button>
        <button
          type="button"
          onClick={() => onEdit(lead)}
          className={`${lbtn} border-av-teal-tx/30 bg-av-teal-bg text-av-teal-tx`}
        >
          <Save size={13} /> Save + schedule
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(`Delete lead: ${lead.name}?`);
              if (!ok) return;
              void onDelete(lead);
            }}
            className={`${lbtn} border-tone-red-tx/30 bg-tone-red-bg text-tone-red-tx`}
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
