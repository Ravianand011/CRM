import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import type { DataMode } from '../utils/storage';

interface NavbarProps {
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  notificationCount: number;
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  theme: Theme;
  onThemeToggle: () => void;
  onBellClick: () => void;
  onMenuToggle: () => void;
}

const MODES: { id: DataMode; label: string }[] = [
  { id: 'real', label: 'Real' },
  { id: 'demo', label: 'Demo' },
];

export function Navbar({
  title,
  search,
  onSearchChange,
  notificationCount,
  mode,
  onModeChange,
  theme,
  onThemeToggle,
  onBellClick,
  onMenuToggle,
}: NavbarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
      <button
        onClick={onMenuToggle}
        className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 md:hidden"
        aria-label="Toggle menu"
      >
        <Menu size={18} />
      </button>

      <h1 className="flex-1 truncate text-[15px] font-medium text-ink">
        {title}
      </h1>

      <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-ink-2 focus-within:border-brand-border">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search leads..."
          className="w-32 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3 sm:w-44"
        />
      </div>

      <div className="flex items-center rounded-md border border-line bg-surface-2 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition ${
              mode === m.id
                ? 'bg-surface text-brand-dark shadow-sm'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onThemeToggle}
        className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2"
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button
        type="button"
        onClick={onBellClick}
        className="relative rounded-md p-1.5 text-ink-2 hover:bg-surface-2"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {notificationCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-[1.5px] border-surface bg-[#e24b4a]" />
        )}
      </button>

      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-soft text-[12px] font-medium text-brand-dark">
        AK
      </div>
    </header>
  );
}
