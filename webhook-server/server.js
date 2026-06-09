const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Load leads from file on startup (/tmp is writable on Railway)
const LEADS_FILE = path.join('/tmp', 'leads.json');
let leadsStore = [];
try {
  if (fs.existsSync(LEADS_FILE)) {
    leadsStore = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    console.log('Loaded', leadsStore.length, 'leads from file');
  }
} catch (e) {
  console.log('No existing leads file');
}

function saveLeadsToFile() {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leadsStore, null, 2));
    console.log('Leads saved to file:', leadsStore.length);
  } catch (e) {
    console.log('Error saving leads:', e.message);
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function removeLeads({ id, phone, fbLeadId }) {
  const phoneKey = normalizePhone(phone);
  let removed = 0;
  for (let i = leadsStore.length - 1; i >= 0; i -= 1) {
    const l = leadsStore[i];
    const match =
      (id && l.id === id) ||
      (fbLeadId && l.fbLeadId === fbLeadId) ||
      (phoneKey && normalizePhone(l.phone) === phoneKey);
    if (match) {
      leadsStore.splice(i, 1);
      removed += 1;
    }
  }
  if (removed > 0) saveLeadsToFile();
  return removed;
}

// GET /webhook - Facebook verification
app.get('/webhook', (req, res) => {
  console.log('WEBHOOK VERIFY REQUEST:', req.query);
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFIED!');
    res.send(challenge);
  } else {
    console.log('VERIFY FAILED - token mismatch');
    console.log('Expected:', process.env.VERIFY_TOKEN);
    console.log('Got:', token);
    res.sendStatus(403);
  }
});

// POST /webhook - Receive Facebook leads
app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  console.log('WEBHOOK POST RECEIVED:', JSON.stringify(req.body));

  const body = req.body;
  if (!body || !body.entry) {
    console.log('No entry in body');
    return;
  }

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      console.log('Change field:', change.field);
      if (change.field === 'leadgen') {
        const leadgenId = change.value.leadgen_id;
        console.log('Processing leadgen_id:', leadgenId);
        void fetchAndSaveLead(leadgenId);
      }
    }
  }
});

// Fetch lead from Facebook Graph API
async function fetchAndSaveLead(leadgenId) {
  try {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    console.log('Token available:', !!token);
    console.log('Token first 20 chars:', token ? token.substring(0, 20) : 'NONE');

    const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,created_time,field_data,ad_name,campaign_name&access_token=${token}`;
    console.log('Fetching URL:', url.substring(0, 100));

    const response = await fetch(url);
    const data = await response.json();
    console.log('FB API Response:', JSON.stringify(data));

    if (data.error) {
      console.log('FB API Error:', data.error.message);
      const exists = leadsStore.find((l) => l.fbLeadId === leadgenId);
      if (exists) {
        console.log('Duplicate fallback lead, skipping:', leadgenId);
        return;
      }
      const fallbackLead = {
        id: `fb_${Date.now()}`,
        name: 'Facebook Lead',
        phone: '',
        email: '',
        city: '',
        qualification: '',
        source: 'facebook',
        status: 'not_picked',
        missedCallCount: 0,
        permanentlyHidden: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        callHistory: [],
        fbLeadId: leadgenId,
      };
      leadsStore.push(fallbackLead);
      saveLeadsToFile();
      console.log('Fallback lead saved');
      return;
    }

    const fields = {};
    (data.field_data || []).forEach((f) => {
      fields[f.name] = f.values ? f.values[0] : '';
    });
    console.log('Mapped fields:', JSON.stringify(fields));

    const lead = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: fields.full_name || fields.name || 'Facebook Lead',
      phone: fields.phone_number || fields.phone || '',
      email: fields.email || '',
      city: fields.city || '',
      qualification:
        fields.what_is_your_qualification || fields.qualification || '',
      whenPlanningToJoin: fields.when_are_you_planning_to_join || '',
      source: 'facebook',
      status: 'not_picked',
      missedCallCount: 0,
      permanentlyHidden: false,
      createdAt: data.created_time || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      callHistory: [],
      fbLeadId: leadgenId,
      fbAdName: data.ad_name || '',
      fbCampaignName: data.campaign_name || '',
    };

    const exists = leadsStore.find((l) => l.fbLeadId === leadgenId);
    if (exists) {
      console.log('Duplicate lead, skipping:', leadgenId);
      return;
    }

    leadsStore.push(lead);
    saveLeadsToFile();
    console.log('LEAD SAVED:', lead.name, lead.phone);
  } catch (err) {
    console.log('fetchAndSaveLead ERROR:', err.message);
  }
}

// GET /leads - Return all leads
app.get('/leads', (_req, res) => {
  console.log('GET /leads - returning', leadsStore.length, 'leads');
  res.json(leadsStore);
});

app.delete('/leads/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const found = leadsStore.find((l) => l.id === id);
  const removed = removeLeads({
    id,
    phone: found?.phone,
    fbLeadId: found?.fbLeadId,
  });
  res.json({ success: true, removed });
});

app.delete('/leads', (req, res) => {
  const { id, phone, fbLeadId } = req.body || {};
  const removed = removeLeads({ id, phone, fbLeadId });
  res.json({ success: true, removed });
});

// GET /test-lead - Add test lead directly
app.get('/test-lead', (_req, res) => {
  const testLead = {
    id: `test_${Date.now()}`,
    name: 'Test Student',
    phone: '9876543210',
    email: 'test@innobuzz.in',
    city: 'Delhi',
    qualification: 'B.Tech',
    whenPlanningToJoin: 'Within 1 month',
    source: 'facebook',
    status: 'not_picked',
    missedCallCount: 0,
    permanentlyHidden: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    callHistory: [],
    fbLeadId: `test_${Date.now()}`,
  };
  leadsStore.push(testLead);
  saveLeadsToFile();
  console.log('TEST LEAD ADDED');
  res.json({ success: true, lead: testLead, total: leadsStore.length });
});

app.post('/test-lead', (_req, res) => {
  const testLead = {
    id: `test_${Date.now()}`,
    name: 'Test Student',
    phone: '9876543210',
    email: 'test@innobuzz.in',
    city: 'Delhi',
    qualification: 'B.Tech',
    whenPlanningToJoin: 'Within 1 month',
    source: 'facebook',
    status: 'not_picked',
    missedCallCount: 0,
    permanentlyHidden: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    callHistory: [],
    fbLeadId: `test_${Date.now()}`,
  };
  leadsStore.push(testLead);
  saveLeadsToFile();
  res.json({ success: true, lead: testLead, total: leadsStore.length });
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalLeads: leadsStore.length,
    tokenSet: !!process.env.FB_PAGE_ACCESS_TOKEN,
    verifyTokenSet: !!process.env.VERIFY_TOKEN,
    leadsFile: LEADS_FILE,
    uptime: process.uptime(),
  });
});

// CRM dashboard (Docker production build)
const distPath = path.join(__dirname, 'dist');
const indexHtml = path.join(distPath, 'index.html');
const hasDashboard = fs.existsSync(indexHtml);

if (hasDashboard) {
  app.use(express.static(distPath, { index: 'index.html' }));
  app.get(/^\/(?!webhook|health|leads|test-lead).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'FB Webhook Server Running', leads: leadsStore.length });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port:', PORT);
  console.log('VERIFY_TOKEN set:', !!process.env.VERIFY_TOKEN);
  console.log('FB_PAGE_ACCESS_TOKEN set:', !!process.env.FB_PAGE_ACCESS_TOKEN);
  console.log('Leads file:', LEADS_FILE);
  if (hasDashboard) console.log('CRM dashboard served from /dist');
});
