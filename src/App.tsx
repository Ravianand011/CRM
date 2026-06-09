import { useMemo, useState } from 'react';
import type { Lead } from './types/Lead';
import type { View } from './types/navigation';
import { useLeads } from './hooks/useLeads';
import { useNotifications } from './hooks/useNotifications';
import { useFollowUpScheduler } from './hooks/useFollowUpScheduler';
import { useTheme } from './hooks/useTheme';
import { buildQueue } from './utils/scheduler';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LeadForm } from './components/LeadForm';
import { Dashboard } from './pages/Dashboard';
import { AllLeads } from './pages/AllLeads';
import { DemoScheduled } from './pages/DemoScheduled';
import { Converted } from './pages/Converted';
import { ImportLeads } from './pages/ImportLeads';

const TITLES: Record<View, string> = {
  dashboard: "Today's follow-up queue",
  all: 'All Leads',
  demo: 'Demo Scheduled',
  converted: 'Converted',
  import: 'Import Excel',
};

function App() {
  const {
    leads,
    loading,
    refreshing,
    error,
    mode,
    switchMode,
    save,
    importRows,
    backup,
    refresh,
    remove,
    migrate,
  } = useLeads();
  const { reminders, count } = useNotifications(leads);
  const { now } = useFollowUpScheduler();
  const { theme, toggleTheme } = useTheme();

  const [view, setView] = useState<View>('dashboard');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [migrating, setMigrating] = useState(false);

  const navCounts = useMemo(
    () => ({
      dashboard: buildQueue(leads, now).length,
      demo: leads.filter((l) => l.status === 'demo_scheduled').length,
      converted: leads.filter((l) => l.status === 'converted').length,
    }),
    [leads, now],
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setFormOpen(true);
  };

  const deleteLead = async (lead: Lead) => {
    await remove(lead.id);
  };

  const bulkDeleteLeads = async (toDelete: Lead[]) => {
    for (const lead of toDelete) {
      await deleteLead(lead);
    }
  };

  const navigate = (v: View) => {
    setView(v);
    setSidebarOpen(false);
  };

  const openReminderLead = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) openEdit(lead);
  };

  const handleMigrate = async () => {
    const stored = localStorage.getItem('crm_leads');
    const count = stored ? JSON.parse(stored).length : 0;
    if (count === 0) {
      alert('No leads found in localStorage');
      return;
    }
    if (
      !confirm(
        `Migrate ${count} leads from localStorage to MongoDB? This cannot be undone.`,
      )
    ) {
      return;
    }
    setMigrating(true);
    try {
      const result = await migrate();
      alert(
        `Migration complete!\nInserted: ${result.inserted}\nSkipped: ${result.skipped}\nTotal: ${result.total}`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const storedLeadCount = (() => {
    try {
      const raw = localStorage.getItem('crm_leads');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          active={view}
          counts={navCounts}
          onNavigate={navigate}
          onNewLead={() => {
            setSidebarOpen(false);
            openNew();
          }}
          onExport={() => void backup()}
          onRefreshLeads={() => void refresh()}
          refreshingLeads={refreshing}
          onMigrate={mode === 'real' && storedLeadCount > 0 ? handleMigrate : undefined}
          migrating={migrating}
          migrateLabel={
            storedLeadCount > 0
              ? `Migrate ${storedLeadCount} leads to MongoDB`
              : undefined
          }
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          title={TITLES[view]}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            if (v) setView('all');
          }}
          notificationCount={count}
          mode={mode}
          onModeChange={(m) => void switchMode(m)}
          theme={theme}
          onThemeToggle={toggleTheme}
          onBellClick={() => navigate('demo')}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        {error && (
          <div className="border-b border-alert-border bg-alert-bg px-5 py-1.5 text-center text-[12px] font-medium text-alert-tx">
            {error}
          </div>
        )}

        {mode === 'demo' && (
          <div className="border-b border-alert-border bg-alert-bg px-5 py-1.5 text-center text-[12px] font-medium text-alert-tx">
            Demo mode - showing sample data. Switch to "Real" in the top bar for
            your own leads.
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-ink-3">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              Loading leads...
            </div>
          ) : (
            <>
              {view === 'dashboard' && (
                <Dashboard
                  leads={leads}
                  now={now}
                  reminders={reminders}
                  onEdit={openEdit}
                  onDelete={deleteLead}
                  onBulkDelete={bulkDeleteLeads}
                  onSelectReminder={openReminderLead}
                />
              )}
              {view === 'all' && (
                <AllLeads
                  leads={leads}
                  search={search}
                  onEdit={openEdit}
                  onDelete={deleteLead}
                />
              )}
              {view === 'demo' && (
                <DemoScheduled
                  leads={leads}
                  onEdit={openEdit}
                  onDelete={deleteLead}
                />
              )}
              {view === 'converted' && (
                <Converted
                  leads={leads}
                  onEdit={openEdit}
                  onDelete={deleteLead}
                />
              )}
              {view === 'import' && <ImportLeads onImport={importRows} />}
            </>
          )}
        </main>
      </div>

      {formOpen && (
        <LeadForm
          lead={editing}
          onSave={save}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
