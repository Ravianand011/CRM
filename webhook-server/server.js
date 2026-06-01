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
app.use(express.json());

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

function createTestLead() {
  const now = new Date().toISOString();
  return {
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
}

function getAppSecretProof(accessToken) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret || !accessToken) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(accessToken)
    .digest('hex');
}

function graphApiUrl(path, query = {}) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('FB_PAGE_ACCESS_TOKEN not set');
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => params.set(k, String(v)));
  params.set('access_token', token);
  const proof = getAppSecretProof(token);
  if (proof) params.set('appsecret_proof', proof);
  return `https://graph.facebook.com/v19.0/${path}?${params}`;
}

function withAppSecretProof(url) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const proof = getAppSecretProof(token);
  if (!proof) return url;
  const u = new URL(url);
  if (!u.searchParams.has('appsecret_proof')) {
    u.searchParams.set('appsecret_proof', proof);
  }
  return u.toString();
}

async function graphGet(url) {
  const res = await fetch(withAppSecretProof(url));
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

async function fetchAllPages(firstUrl) {
  const items = [];
  let url = withAppSecretProof(firstUrl);
  while (url) {
    const data = await graphGet(url);
    if (Array.isArray(data.data)) items.push(...data.data);
    url = data.paging?.next ? withAppSecretProof(data.paging.next) : null;
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
    const me = await graphGet(graphApiUrl('me', { fields: 'id' }));
    pageId = me.id;
  }

  const forms = await fetchAllPages(
    graphApiUrl(`${pageId}/leadgen_forms`, {
      fields: 'id,name',
      limit: '100',
    }),
  );

  let added = 0;
  let skipped = 0;

  for (const form of forms) {
    const rows = await fetchAllPages(
      graphApiUrl(`${form.id}/leads`, {
        fields: 'id,created_time,field_data',
        limit: '100',
      }),
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
    console.error('fetchLeadFromFacebook: FB_PAGE_ACCESS_TOKEN not set');
    return;
  }

  const url = graphApiUrl(leadgenId, {
    fields: 'id,created_time,field_data,ad_name,campaign_name',
  });

  console.log('fetchLeadFromFacebook URL:', url);

  try {
    const res = await fetch(url);
    const rawText = await res.text();
    console.log('fetchLeadFromFacebook raw response:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('fetchLeadFromFacebook: invalid JSON response', parseErr.message);
      return;
    }

    if (!res.ok || data.error) {
      console.error(
        'fetchLeadFromFacebook API error:',
        data.error?.message || data.error || `HTTP ${res.status}`,
      );
      return;
    }

    saveLead(buildLeadFromGraphRow(data));
  } catch (err) {
    console.error('fetchLeadFromFacebook error:', err.message);
  }
}

// Facebook webhook verification
app.get('/webhook', (req, res) => {
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (verifyToken === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified!');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// Receive Facebook lead events (no signature validation)
app.post('/webhook', (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body || !body.entry) return;

  for (const entry of body.entry) {
    if (!entry.changes) continue;
    for (const change of entry.changes) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) {
        void fetchLeadFromFacebook(change.value.leadgen_id);
      }
    }
  }
});

app.get('/leads', (_req, res) => {
  res.json(leadsStore);
});

app.post('/sync-facebook', async (_req, res) => {
  try {
    const result = await syncAllLeadsFromFacebook();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('sync-facebook error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fake lead without Facebook API (GET)
app.get('/test-lead', (_req, res) => {
  saveLead(createTestLead());
  res.json({ success: true });
});

// Fake lead without Facebook API (POST — backward compatible)
app.post('/test-lead', (_req, res) => {
  saveLead(createTestLead());
  res.json({ success: true, message: 'Test lead added' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalLeads: leadsStore.length,
    uptime: process.uptime(),
  });
});

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
      api: { health: '/health', leads: '/leads', webhook: '/webhook' },
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
  if (hasDashboard) {
    console.log('CRM dashboard served from /dist');
  }
});
