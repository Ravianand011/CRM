# Lead CRM

A browser-only CRM dashboard for managing sales leads. Built with React + TypeScript + Vite + Tailwind CSS. All data is stored in the browser's `localStorage` — there is **no backend, database, or server** required.

## Features

- Lead form with full contact details, status, follow-up and demo scheduling
- Smart re-show scheduler (24h / 48h / 72h cadence for missed calls)
- Permanent hide rule for leads lost after a demo
- Call history timeline + per-interaction notes
- Demo reminders (notifies for demos within the next 30 minutes)
- Today's follow-up queue with overdue / due-today highlighting
- Excel import for Facebook Lead Ads exports (column auto-mapping + de-dupe)
- WhatsApp and Email quick actions on every lead
- Search, filter, and sort across all leads
- JSON backup export
- Mobile responsive

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## How data is stored

Everything lives under the `crm_leads` key in `localStorage`. Use the
**Export Backup** button in the sidebar to download a JSON copy of all leads.

## Importing Facebook leads

1. Facebook Ads Manager → Leads Center → download the Excel export.
2. In the app, open **Import Leads** and upload the `.xlsx` / `.xls` file.
3. Columns such as "Full Name", "Phone Number", "Email", "City",
   "What is your qualification?" and "When are you planning to join?" are
   mapped automatically (with fuzzy matching for variants).

## Project structure

```
src/
  components/   UI building blocks (LeadCard, LeadForm, Sidebar, ...)
  pages/        Top-level views (Dashboard, AllLeads, DemoScheduled, ...)
  hooks/        useLeads, useNotifications, useFollowUpScheduler
  services/     leadsApi — the internal data-access "API" over localStorage
  utils/        storage, scheduler, excelMapper, datetime
  types/        Lead and navigation types
  App.tsx       State-based view switching + layout
```

The UI and hooks only talk to `services/leadsApi.ts`. Its functions are
async-style, so the storage layer can later be swapped for a real backend
without touching the components.
