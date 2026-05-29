import type { CallNote, Lead, LeadStatus } from '../types/Lead';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface DemoSpec {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  qualification: string;
  whenPlanningToJoin?: string;
  source: Lead['source'];
  status: LeadStatus;
  missedCallCount?: number;
  permanentlyHidden?: boolean;
  createdAgo: number; // ms before now
  nextFollowUp?: number; // ms offset from now (negative = overdue)
  demoScheduledAt?: number; // ms offset from now
  lastShownAgo?: number; // ms before now
  notes?: { text: string; agoMs: number; status: LeadStatus }[];
}

const SPECS: DemoSpec[] = [
  {
    id: 'demo-1',
    name: 'Rahul Kumar',
    phone: '9988776655',
    city: 'Noida',
    qualification: 'B.Tech',
    source: 'excel_import',
    status: 'not_picked',
    missedCallCount: 1,
    createdAgo: 3 * DAY,
    nextFollowUp: -2 * HOUR,
    notes: [
      {
        text: 'Phone ringing nahi tha, shaam ko try karna',
        agoMs: 1 * DAY,
        status: 'not_picked',
      },
    ],
  },
  {
    id: 'demo-2',
    name: 'Meena Sharma',
    phone: '8877665544',
    email: 'meena@example.com',
    city: 'Jaipur',
    qualification: 'BCA',
    source: 'manual',
    status: 'demo_scheduled',
    createdAgo: 4 * DAY,
    nextFollowUp: -20 * MIN,
    demoScheduledAt: 25 * MIN,
    notes: [
      {
        text: 'Interested in full stack course, budget discuss karni h',
        agoMs: 2 * DAY,
        status: 'picked',
      },
    ],
  },
  {
    id: 'demo-3',
    name: 'Amit Patel',
    phone: '7766554433',
    email: 'amit@example.com',
    city: 'Ahmedabad',
    qualification: '12th pass',
    source: 'excel_import',
    status: 'picked',
    createdAgo: 1 * DAY,
    nextFollowUp: -1 * HOUR,
    notes: [
      { text: 'Picked up, asked to call back today', agoMs: 5 * HOUR, status: 'picked' },
    ],
  },
  {
    id: 'demo-4',
    name: 'Pooja Verma',
    phone: '9090901234',
    city: 'Lucknow',
    qualification: 'B.Sc',
    source: 'excel_import',
    status: 'not_picked',
    missedCallCount: 0,
    createdAgo: 2 * DAY,
    lastShownAgo: 26 * HOUR,
  },
  {
    id: 'demo-5',
    name: 'Sandeep Singh',
    phone: '9811122233',
    city: 'Chandigarh',
    qualification: 'Diploma',
    source: 'manual',
    status: 'switch_off',
    missedCallCount: 2,
    createdAgo: 6 * DAY,
    lastShownAgo: 80 * HOUR,
    notes: [
      { text: 'Number switched off, 3rd time', agoMs: 3 * DAY, status: 'switch_off' },
    ],
  },
  {
    id: 'demo-6',
    name: 'Neha Gupta',
    phone: '9123456780',
    email: 'neha@example.com',
    city: 'Delhi',
    qualification: 'MBA',
    whenPlanningToJoin: 'Next month',
    source: 'manual',
    status: 'demo_scheduled',
    createdAgo: 2 * DAY,
    nextFollowUp: -10 * MIN,
    demoScheduledAt: 5 * HOUR,
    notes: [
      { text: 'Very keen, demo fixed for evening', agoMs: 6 * HOUR, status: 'picked' },
    ],
  },
  {
    id: 'demo-7',
    name: 'Karan Mehta',
    phone: '9988012345',
    city: 'Mumbai',
    qualification: 'BBA',
    source: 'excel_import',
    status: 'picked',
    createdAgo: 1 * DAY,
    nextFollowUp: 3 * HOUR,
  },
  {
    id: 'demo-8',
    name: 'Anjali Rao',
    phone: '9000011122',
    email: 'anjali@example.com',
    city: 'Hyderabad',
    qualification: 'B.Tech',
    source: 'manual',
    status: 'converted',
    createdAgo: 5 * DAY,
    notes: [
      { text: 'Enrolled in full stack batch', agoMs: 1 * DAY, status: 'converted' },
    ],
  },
  {
    id: 'demo-9',
    name: 'Vikram Nair',
    phone: '9700088123',
    city: 'Kochi',
    qualification: 'MCA',
    source: 'excel_import',
    status: 'converted',
    createdAgo: 6 * DAY,
  },
  {
    id: 'demo-10',
    name: 'Riya Shah',
    phone: '9650077001',
    email: 'riya@example.com',
    city: 'Surat',
    qualification: 'B.Com',
    source: 'manual',
    status: 'converted',
    createdAgo: 4 * DAY,
  },
  {
    id: 'demo-11',
    name: 'Deepak Yadav',
    phone: '9555066120',
    city: 'Kanpur',
    qualification: 'B.A',
    source: 'excel_import',
    status: 'demo_done',
    createdAgo: 7 * DAY,
    nextFollowUp: -40 * MIN,
    notes: [
      { text: 'Demo done, deciding on payment plan', agoMs: 1 * DAY, status: 'demo_done' },
    ],
  },
  {
    id: 'demo-12',
    name: 'Farah Khan',
    phone: '9333044501',
    city: 'Bhopal',
    qualification: 'MBA',
    source: 'manual',
    status: 'not_interested',
    permanentlyHidden: true,
    createdAgo: 8 * DAY,
    notes: [
      { text: 'After demo, chose another institute', agoMs: 2 * DAY, status: 'not_interested' },
    ],
  },
];

/** Build a fresh set of demo leads with timestamps relative to the current time. */
export function buildDemoLeads(now: number = Date.now()): Lead[] {
  const iso = (ms: number) => new Date(ms).toISOString();

  return SPECS.map((s) => {
    const createdAt = iso(now - s.createdAgo);
    const callHistory: CallNote[] = (s.notes ?? []).map((n, i) => ({
      id: `${s.id}-note-${i}`,
      timestamp: iso(now - n.agoMs),
      note: n.text,
      statusAtTime: n.status,
    }));

    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      qualification: s.qualification,
      city: s.city,
      whenPlanningToJoin: s.whenPlanningToJoin,
      source: s.source,
      status: s.status,
      createdAt,
      updatedAt: iso(now - Math.min(s.createdAgo, 6 * HOUR)),
      nextFollowUp:
        s.nextFollowUp !== undefined ? iso(now + s.nextFollowUp) : undefined,
      demoScheduledAt:
        s.demoScheduledAt !== undefined
          ? iso(now + s.demoScheduledAt)
          : undefined,
      callHistory,
      missedCallCount: s.missedCallCount ?? 0,
      lastShownAt:
        s.lastShownAgo !== undefined ? iso(now - s.lastShownAgo) : undefined,
      permanentlyHidden: s.permanentlyHidden ?? false,
    } satisfies Lead;
  });
}
