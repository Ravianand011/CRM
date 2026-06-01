export type LeadStatus =
  | 'not_picked'
  | 'picked'
  | 'demo_scheduled'
  | 'demo_done'
  | 'converted'
  | 'not_interested'
  | 'switch_off';

export type LeadSource = 'facebook' | 'excel_import' | 'manual';

export interface CallNote {
  id: string;
  timestamp: string; // ISO date
  note: string;
  statusAtTime: LeadStatus;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  qualification: string;
  city: string;
  whenPlanningToJoin?: string;
  source: LeadSource;

  status: LeadStatus;
  createdAt: string;
  updatedAt: string;

  nextFollowUp?: string; // ISO datetime
  demoScheduledAt?: string; // ISO datetime for demo

  callHistory: CallNote[];
  currentComment?: string;

  // Smart re-show tracking
  lastShownAt?: string;
  missedCallCount: number; // increments when not_picked/switch_off repeats
  hiddenUntil?: string; // ISO datetime - don't show before this
  permanentlyHidden: boolean; // true if not_interested after demo_scheduled

  fbLeadId?: string; // Facebook leadgen id when synced from webhook
}

export const LEAD_STATUSES: LeadStatus[] = [
  'not_picked',
  'picked',
  'demo_scheduled',
  'demo_done',
  'converted',
  'not_interested',
  'switch_off',
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  not_picked: 'Not Picked',
  picked: 'Picked',
  demo_scheduled: 'Demo Scheduled',
  demo_done: 'Demo Done',
  converted: 'Converted',
  not_interested: 'Not Interested',
  switch_off: 'Switch Off',
};
