import type { CallNote } from '../types/Lead';
import { STATUS_LABELS } from '../types/Lead';
import { formatIST } from '../utils/datetime';

export function CallHistory({ history }: { history: CallNote[] }) {
  if (history.length === 0) {
    return (
      <p className="text-[12px] italic text-ink-3">No previous call notes.</p>
    );
  }

  const ordered = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <ol className="space-y-3">
      {ordered.map((note) => (
        <li key={note.id} className="relative border-l-2 border-line pl-4">
          <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-ink-3" />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
            <span>{formatIST(note.timestamp)}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-ink-2">
              {STATUS_LABELS[note.statusAtTime]}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">
            {note.note}
          </p>
        </li>
      ))}
    </ol>
  );
}
