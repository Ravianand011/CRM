require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const leadsStore = [];

const FIELD_MAP = {
  full_name: 'name',
  name: 'name',
  first_name: 'firstName',
  last_name: 'lastName',
  phone_number: 'phone',
  phone: 'phone',
  mobile: 'phone',
  contact_number: 'phone',
  email: 'email',
  city: 'city',
  what_is_your_qualification: 'qualification',
  qualification: 'qualification',
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

  if (!result.name && (result.firstName || result.lastName)) {
    result.name = [result.firstName, result.lastName].filter(Boolean).join(' ');
  }

  return result;
}

function buildLeadFromGraphRow(data) {
  const leadgenId = String(data.id);
  const fields = flattenFieldData(data.field_data);
  const createdAt = data.created_time || new Date().toISOString();

  return {
    id: `fb_${leadgenId}`,
    name: fields.name || 'Facebook Lead',
    phone: fields.phone || `fb-${leadgenId}`,
    email: fields.email || '',
    city: fields.city || '',
    qualification: fields.qualification || '',
    whenPlanningToJoin: fields.whenPlanningToJoin || '',
    source: 'facebook',
    status: 'not_picked',
    missedCallCount: 0,
    permanentlyHidden: false,
    createdAt,
    updatedAt: createdAt,
    callHistory: [],
    fbLeadId: leadgenId,
  };
}

function leadExists(lead) {
  return leadsStore.some(
    (l) =>
      (lead.fbLeadId && l.fbLeadId === lead.fbLeadId) ||
      (lead.phone && l.phone && l.phone === lead.phone),
  );
}

function saveLead(lead) {
  if (leadExists(lead)) {
    console.log(`Duplicate lead skipped: ${lead.name} - ${lead.phone}`);
    return false;
  }
  leadsStore.push(lead);
  console.log(`Lead saved: ${lead.name} - ${lead.phone}`);
  return true;
}

async function graphGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

async function fetchAllPages(firstUrl) {
  const items = [];
  let url = firstUrl;
  while (url) {
    const data = await graphGet(url);
    if (Array.isArray(data.data)) items.push(...data.data);
    url = data.paging?.next || null;
  }
  return items;
}

async function syncAllLeadsFromFacebook() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not set in Railway variables');
  }

  let pageId = process.env.FB_PAGE_ID;
  if (!pageId) {
    const me = await graphGet(
      `https://graph.facebook.com/v19.0/me?fields=id&access_token=${token}`,
    );
    pageId = me.id;
  }

  const forms = await fetchAllPages(
    `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&limit=100&access_token=${token}`,
  );

  let added = 0;
  let skipped = 0;

  for (const form of forms) {
    const rows = await fetchAllPages(
      `https://graph.facebook.com/v19.0/${form.id}/leads?fields=id,created_time,field_data&limit=100&access_token=${token}`,
    );
    for (const row of rows) {
      const lead = buildLeadFromGraphRow(row);
      if (saveLead(lead)) added += 1;
      else skipped += 1;
    }
  }

  console.log(
    `Facebook sync: ${added} added, ${skipped} skipped, ${forms.length} form(s), ${leadsStore.length} total`,
  );

  return {
    added,
    skipped,
    forms: forms.length,
    total: leadsStore.length,
    pageId,
  };
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
    const data = await graphGet(url);
    saveLead(buildLeadFromGraphRow(data));
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

// Pull all historical leads from Facebook Lead Ads forms
app.post('/sync-facebook', async (_req, res) => {
  try {
    const result = await syncAllLeadsFromFacebook();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('sync-facebook error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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

// CRM dashboard (Vite build in /dist) — same origin as /leads API
const distPath = path.join(__dirname, 'dist');
const indexHtml = path.join(distPath, 'index.html');
const hasDashboard = fs.existsSync(indexHtml);

if (hasDashboard) {
  app.use(express.static(distPath, { index: 'index.html' }));
  app.get('/', (_req, res) => {
    res.sendFile(indexHtml);
  });
  app.get(/^\/(?!webhook|health|leads|test-lead|sync-facebook).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.status(503).json({
      error: 'CRM dashboard not built',
      hint: 'Deploy from repo root with root Dockerfile (Root Directory must be /, not webhook-server)',
      api: { health: '/health', leads: '/leads', webhook: '/webhook' },
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
  if (hasDashboard) {
    console.log('CRM dashboard served from /dist');
  } else {
    console.warn('WARNING: /dist/index.html missing — API only, no dashboard');
  }
});
