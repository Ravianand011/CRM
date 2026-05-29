import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  subIcon?: LucideIcon;
  subText?: string;
  subColor?: string;
}

export function StatCard({
  label,
  value,
  subIcon: SubIcon,
  subText,
  subColor = 'text-ink-2',
}: StatCardProps) {
  return (
    <div className="rounded-md bg-surface-2 px-3.5 py-3">
      <div className="text-[11px] text-ink-2">{label}</div>
      <div className="mt-1.5 text-[22px] font-medium leading-none text-ink">
        {value}
      </div>
      {subText && (
        <div className={`mt-1.5 flex items-center gap-1 text-[11px] ${subColor}`}>
          {SubIcon && <SubIcon size={11} />}
          {subText}
        </div>
      )}
    </div>
  );
}
