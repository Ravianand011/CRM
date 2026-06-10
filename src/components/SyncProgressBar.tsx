import type { SyncFacebookProgress } from '../api/leadsApi';

interface SyncProgressBarProps {
  progress: SyncFacebookProgress;
}

export function SyncProgressBar({ progress }: SyncProgressBarProps) {
  const percent = Math.min(100, Math.max(0, progress.percent));

  return (
    <div className="border-b border-brand-border bg-brand-soft/40 px-5 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className="truncate font-medium text-brand-dark">
          {progress.message || 'Syncing Facebook leads...'}
        </span>
        <span className="shrink-0 font-medium tabular-nums text-brand-dark">
          {percent}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Facebook sync progress"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {(progress.added > 0 || progress.skipped > 0 || progress.filtered > 0) && (
        <p className="mt-1.5 text-[11px] text-ink-3">
          Added {progress.added} · Skipped {progress.skipped} · Filtered{' '}
          {progress.filtered}
        </p>
      )}
    </div>
  );
}
