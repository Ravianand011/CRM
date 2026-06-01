require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const leadsStore = [];

const FIELD_MAP = {
  full_name: 'name',
  name: 'name',
  phone_number: 'phone',
  phone: 'phone',
  email: 'email',
  city: 'city',
  what_is_your_qualification: 'qualification',
  when_are_you_planning_to_join: 'whenPlanningToJoin',
};

app.use(cors({ origin: '*' }));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

function verifySignature(req) {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature || !process.env.FB_APP_SECRET) return false;

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.FB_APP_SECRET)
      .update(req.rawBody)
      .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

function flattenFieldData(fieldData) {
  const result = {};
  if (!Array.isArray(fieldData)) return result;

  for (const field of fieldData) {
    const key = FIELD_MAP[field.name];
    if (key && field.values && field.values[0]) {
      result[key] = field.values[0];
    }
  }
  return result;
}

function saveLead(lead) {
  if (leadsStore.some((l) => l.phone === lead.phone)) {
    console.log(`Duplicate lead skipped: ${lead.phone}`);
    return false;
  }
  leadsStore.push(lead);
  console.log(`Lead saved: ${lead.name} - ${lead.phone}`);
  return true;
}

async function fetchLeadFromFacebook(leadgenId) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.error('FB_PAGE_ACCESS_TOKEN not set');
    return;
  }

  const url =
    `https://graph.facebook.com/v19.0/${leadgenId}` +
    `?fields=id,created_time,field_data,ad_name,campaign_name` +
    `&access_token=${token}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error('Graph API error:', data);
      return;
    }

    const fields = flattenFieldData(data.field_data);

    const lead = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fields.name || '',
      phone: fields.phone || '',
      email: fields.email || '',
      city: fields.city || '',
      qualification: fields.qualification || '',
      whenPlanningToJoin: fields.whenPlanningToJoin || '',
      source: 'facebook',
      status: 'not_picked',
      missedCallCount: 0,
      permanentlyHidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      callHistory: [],
      fbLeadId: leadgenId,
    };

    saveLead(lead);
  } catch (err) {
    console.error('fetchLeadFromFacebook error:', err.message);
  }
}

// Facebook webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified!');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// Receive Facebook lead events
app.post('/webhook', (req, res) => {
  res.sendStatus(200);

  if (!verifySignature(req)) {
    console.error('Invalid X-Hub-Signature-256');
    return;
  }

  const body = req.body;
  if (!body.entry) return;

  for (const entry of body.entry) {
    if (!entry.changes) continue;
    for (const change of entry.changes) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) {
        void fetchLeadFromFacebook(change.value.leadgen_id);
      }
    }
  }
});

// CRM polls this endpoint
app.get('/leads', (_req, res) => {
  res.json(leadsStore);
});

// Add a test lead without Facebook
app.post('/test-lead', (_req, res) => {
  const now = new Date().toISOString();
  const testLead = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test User',
    phone: '9999999999',
    email: 'test@test.com',
    city: 'Delhi',
    qualification: 'B.Tech',
    whenPlanningToJoin: 'Within 1 month',
    source: 'facebook',
    status: 'not_picked',
    missedCallCount: 0,
    permanentlyHidden: false,
    createdAt: now,
    updatedAt: now,
    callHistory: [],
  };

  saveLead(testLead);
  res.json({ success: true, message: 'Test lead added' });
});

// Health check for Railway
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalLeads: leadsStore.length,
    uptime: process.uptime(),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
});
