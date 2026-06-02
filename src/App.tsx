import { useEffect, useMemo, useState } from 'react';
import type { Lead } from './types/Lead';
import type { View } from './types/navigation';
import { useLeads } from './hooks/useLeads';
import { useWebhookSync } from './hooks/useWebhookSync';
import { useNotifications } from './hooks/useNotifications';
import { useFollowUpScheduler } from './hooks/useFollowUpScheduler';
import { buildQueue } from './utils/scheduler';
import { shouldDeleteTogether } from './services/leadsApi';
import { deleteLeadOnServer } from './services/serverLeads';
import { markLeadDeleted } from './utils/syncBlocklist';
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
    mode,
    switchMode,
    save,
    importRows,
    backup,
    refresh,
    remove,
  } = useLeads();
  const { pullLeads } = useWebhookSync(refresh);
  const { reminders, count } = useNotifications(leads);
  const { now } = useFollowUpScheduler();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count: number }>).detail;
      alert(`${detail.count} new Facebook leads received!`);
    };
    window.addEventListener('newLeadsReceived', handler);
    return () => window.removeEventListener('newLeadsReceived', handler);
  }, []);

  const [view, setView] = useState<View>('dashboard');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

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
    for (const l of leads) {
      if (!shouldDeleteTogether(l, lead)) continue;
      try {
        markLeadDeleted(l);
      } catch (err) {
        console.error('Failed to cache deleted lead in blocklist', err);
      }
    }

    await deleteLeadOnServer(lead);

    const removed = await remove(lead.id);
    if (removed === 0) {
      throw new Error('Lead not found');
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
          onRefreshLeads={() => void pullLeads()}
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
          onBellClick={() => navigate('demo')}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        {mode === 'demo' && (
          <div className="border-b border-alert-border bg-alert-bg px-5 py-1.5 text-center text-[12px] font-medium text-alert-tx">
            Demo mode - showing sample data. Switch to "Real" in the top bar for
            your own leads.
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <p className="text-ink-3">Loading...</p>
          ) : (
            <>
              {view === 'dashboard' && (
                <Dashboard
                  leads={leads}
                  now={now}
                  reminders={reminders}
                  onEdit={openEdit}
                  onDelete={deleteLead}
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
