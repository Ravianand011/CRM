const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const DEFAULT_SYNC_FROM = '2026-05-25T00:00:00.000Z';
const SYNC_FROM_MS = new Date(
  process.env.FB_SYNC_FROM || DEFAULT_SYNC_FROM,
).getTime();

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

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas connected!'))
  .catch((err) => console.log('❌ MongoDB connection error:', err));

const leadSchema = new mongoose.Schema(
  {
    fbLeadId: { type: String, unique: true, sparse: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    city: { type: String, default: '' },
    qualification: { type: String, default: '' },
    whenPlanningToJoin: { type: String, default: '' },
    source: {
      type: String,
      default: 'facebook',
      enum: ['facebook', 'manual', 'excel_import', 'website'],
    },
    status: {
      type: String,
      default: 'not_picked',
      enum: [
        'not_picked',
        'picked',
        'demo_scheduled',
        'demo_done',
        'converted',
        'not_interested',
        'switch_off',
      ],
    },
    missedCallCount: { type: Number, default: 0 },
    permanentlyHidden: { type: Boolean, default: false },
    nextFollowUp: { type: Date, default: null },
    demoScheduledAt: { type: Date, default: null },
    hiddenUntil: { type: Date, default: null },
    lastShownAt: { type: Date, default: null },
    callHistory: [
      {
        note: { type: String },
        statusAtTime: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    fbAdName: { type: String, default: '' },
    fbCampaignName: { type: String, default: '' },
  },
  { timestamps: true },
);

const Lead = mongoose.model('Lead', leadSchema);

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

async function findDuplicateByPhone(phone) {
  const phoneKey = normalizePhone(phone);
  if (!phoneKey) return null;
  const exact = await Lead.findOne({ phone: String(phone).trim() });
  if (exact) return exact;
  const matches = await Lead.find({ phone: { $ne: '' } });
  return matches.find((l) => normalizePhone(l.phone) === phoneKey) || null;
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

function getAppSecretProof(accessToken) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret || !accessToken) return null;
  return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

function graphApiUrl(path, query = {}) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('FB_PAGE_ACCESS_TOKEN not set');
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => params.set(k, String(v)));
  params.set('access_token', token);
  const proof = getAppSecretProof(token);
  if (proof) params.set('appsecret_proof', proof);
  return `https://graph.facebook.com/v19.0/${path}?${params}`;
}

function withAppSecretProof(url) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();
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

function buildLeadDataFromGraph(data) {
  const leadgenId = String(data.id);
  const fields = flattenFieldData(data.field_data);
  const createdAt = data.created_time
    ? new Date(data.created_time)
    : new Date();

  return {
    fbLeadId: leadgenId,
    name: fields.name || 'Facebook Lead',
    phone: fields.phone || '',
    email: fields.email || '',
    city: fields.city || '',
    qualification: fields.qualification || '',
    whenPlanningToJoin: fields.whenPlanningToJoin || '',
    source: 'facebook',
    status: 'not_picked',
    missedCallCount: 0,
    fbAdName: data.ad_name || '',
    fbCampaignName: data.campaign_name || '',
    createdAt,
    updatedAt: createdAt,
  };
}

function isOnOrAfterSyncFrom(createdTime) {
  if (!createdTime) return true;
  return new Date(createdTime).getTime() >= SYNC_FROM_MS;
}

async function upsertFbLeadFromGraph(data, { enforceDateFilter = false } = {}) {
  if (enforceDateFilter && !isOnOrAfterSyncFrom(data.created_time)) {
    return { action: 'filtered' };
  }

  const leadData = buildLeadDataFromGraph(data);
  const existing = await Lead.findOne({ fbLeadId: leadData.fbLeadId });
  if (existing) {
    return { action: 'skipped', lead: existing };
  }

  if (leadData.phone) {
    const phoneKey = normalizePhone(leadData.phone);
    if (phoneKey) {
      const matches = await Lead.find({ phone: { $ne: '' } });
      const dup = matches.find((l) => normalizePhone(l.phone) === phoneKey);
      if (dup) return { action: 'skipped', lead: dup };
    }
  }

  const lead = await Lead.create(leadData);
  return { action: 'added', lead };
}

function serializeLead(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: String(obj._id),
    _id: String(obj._id),
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
    nextFollowUp: obj.nextFollowUp ? new Date(obj.nextFollowUp).toISOString() : undefined,
    demoScheduledAt: obj.demoScheduledAt
      ? new Date(obj.demoScheduledAt).toISOString()
      : undefined,
    hiddenUntil: obj.hiddenUntil ? new Date(obj.hiddenUntil).toISOString() : undefined,
    lastShownAt: obj.lastShownAt ? new Date(obj.lastShownAt).toISOString() : undefined,
    callHistory: (obj.callHistory || []).map((n, i) => ({
      id: n._id ? String(n._id) : `note_${i}`,
      note: n.note || '',
      statusAtTime: n.statusAtTime || 'not_picked',
      timestamp: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString(),
    })),
  };
}

async function fetchAndSaveLead(leadgenId) {
  try {
    const url = graphApiUrl(leadgenId, {
      fields: 'id,created_time,field_data,ad_name,campaign_name',
    });
    console.log('🔍 Fetching lead:', leadgenId);
    const data = await graphGet(url);
    console.log('📊 FB Response:', JSON.stringify(data));

    const result = await upsertFbLeadFromGraph(data, { enforceDateFilter: false });
    if (result.action === 'added') {
      console.log('✅ Lead saved to MongoDB:', result.lead.name, result.lead.phone);
    } else if (result.action === 'skipped') {
      console.log('⏭️ Lead already exists:', leadgenId);
    }
  } catch (err) {
    console.log('❌ fetchAndSaveLead error:', err.message);
    try {
      const existing = await Lead.findOne({ fbLeadId: leadgenId });
      if (!existing) {
        await Lead.create({
          fbLeadId: leadgenId,
          name: 'Facebook Lead',
          source: 'facebook',
          status: 'not_picked',
        });
      }
    } catch (e) {
      console.log('❌ fallback save failed:', e.message);
    }
  }
}

let syncInFlight = false;
let syncProgress = {
  active: false,
  percent: 0,
  message: '',
  added: 0,
  skipped: 0,
  filtered: 0,
  processedForms: 0,
  totalForms: 0,
};

function updateSyncProgress(patch) {
  syncProgress = { ...syncProgress, ...patch };
}

async function syncAllLeadsFromFacebook() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not set in Railway variables');
  }

  updateSyncProgress({
    active: true,
    percent: 2,
    message: 'Connecting to Facebook...',
    added: 0,
    skipped: 0,
    filtered: 0,
    processedForms: 0,
    totalForms: 0,
  });

  let pageId = process.env.FB_PAGE_ID?.trim();
  if (!pageId) {
    const me = await graphGet(graphApiUrl('me', { fields: 'id' }));
    pageId = me.id;
  }

  updateSyncProgress({ percent: 8, message: 'Loading lead forms...' });

  const forms = await fetchAllPages(
    graphApiUrl(`${pageId}/leadgen_forms`, {
      fields: 'id,name',
      limit: '100',
    }),
  );

  let added = 0;
  let skipped = 0;
  let filtered = 0;

  updateSyncProgress({
    totalForms: forms.length,
    percent: 12,
    message:
      forms.length > 0
        ? `Found ${forms.length} form(s). Starting sync...`
        : 'No lead forms found on this Page.',
  });

  for (let formIndex = 0; formIndex < forms.length; formIndex += 1) {
    const form = forms[formIndex];
    const formLabel = form.name || `Form ${formIndex + 1}`;
    console.log(`📋 Syncing form: ${formLabel}`);

    updateSyncProgress({
      processedForms: formIndex,
      message: `Syncing ${formLabel} (${formIndex + 1}/${forms.length})...`,
      percent: Math.round(12 + (formIndex / Math.max(forms.length, 1)) * 78),
      added,
      skipped,
      filtered,
    });

    const rows = await fetchAllPages(
      graphApiUrl(`${form.id}/leads`, {
        fields: 'id,created_time,field_data,ad_name,campaign_name',
        limit: '100',
      }),
    );

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const result = await upsertFbLeadFromGraph(row, { enforceDateFilter: true });
      if (result.action === 'added') added += 1;
      else if (result.action === 'skipped') skipped += 1;
      else if (result.action === 'filtered') filtered += 1;

      if (rows.length > 0 && (rowIndex % 3 === 0 || rowIndex === rows.length - 1)) {
        const formSpan = 78 / Math.max(forms.length, 1);
        const withinForm = ((rowIndex + 1) / rows.length) * formSpan;
        updateSyncProgress({
          percent: Math.round(12 + formIndex * formSpan + withinForm),
          message: `Processing ${formLabel}: lead ${rowIndex + 1} of ${rows.length}`,
          added,
          skipped,
          filtered,
        });
      }
    }

    updateSyncProgress({
      processedForms: formIndex + 1,
      added,
      skipped,
      filtered,
    });
  }

  const total = await Lead.countDocuments();
  console.log(
    `✅ Facebook sync: ${added} added, ${skipped} skipped, ${filtered} before ${process.env.FB_SYNC_FROM || DEFAULT_SYNC_FROM}, ${forms.length} form(s), ${total} total`,
  );

  return {
    added,
    skipped,
    filtered,
    forms: forms.length,
    total,
    pageId,
    syncFrom: process.env.FB_SYNC_FROM || DEFAULT_SYNC_FROM,
  };
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified!');
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  console.log('📥 Webhook received:', JSON.stringify(req.body));
  const body = req.body;
  if (!body || !body.entry) return;
  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      if (change.field === 'leadgen') {
        await fetchAndSaveLead(change.value.leadgen_id);
      }
    }
  }
});

app.get('/leads', async (_req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    console.log('📋 Returning', leads.length, 'leads');
    res.json(leads.map(serializeLead));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(serializeLead(lead));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/leads', async (req, res) => {
  try {
    const body = { ...req.body };
    delete body._id;
    delete body.id;

    if (body.phone) {
      const dup = await findDuplicateByPhone(body.phone);
      if (dup) {
        return res.status(400).json({ error: 'Lead with this phone already exists' });
      }
    }

    const lead = new Lead(body);
    await lead.save();
    console.log('✅ New lead created:', lead.name);
    res.json(serializeLead(lead));
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Lead already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/website-lead', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your phone number.',
      });
    }

    const duplicate = await findDuplicateByPhone(phone);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'We already have your details. Our team will contact you soon.',
      });
    }

    const lead = await Lead.create({
      name: 'Website Lead',
      phone,
      source: 'website',
      status: 'not_picked',
      qualification: 'Book Trial - Website',
    });

    console.log('✅ Website lead created:', lead.phone);
    res.json({
      success: true,
      message: 'Thank you! We will contact you shortly.',
      lead: serializeLead(lead),
    });
  } catch (err) {
    console.error('website-lead error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong. Please try again.',
    });
  }
});

app.put('/leads/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    delete body._id;
    delete body.id;
    delete body.createdAt;

    const lead = await Lead.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    console.log('✅ Lead updated:', lead.name, '→', lead.status);
    res.json(serializeLead(lead));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/leads/:id', async (req, res) => {
  try {
    const result = await Lead.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Lead not found' });
    console.log('🗑️ Lead deleted:', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/leads', async (req, res) => {
  try {
    const { id, phone, fbLeadId } = req.body || {};
    let removed = 0;
    if (id) {
      const r = await Lead.findByIdAndDelete(id);
      if (r) removed += 1;
    }
    if (fbLeadId) {
      const r = await Lead.deleteOne({ fbLeadId });
      removed += r.deletedCount || 0;
    }
    if (phone) {
      const phoneKey = normalizePhone(phone);
      const matches = await Lead.find({ phone: { $ne: '' } });
      for (const l of matches) {
        if (normalizePhone(l.phone) === phoneKey) {
          await Lead.findByIdAndDelete(l._id);
          removed += 1;
        }
      }
    }
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sync-facebook/status', (_req, res) => {
  res.json(syncProgress);
});

app.post('/sync-facebook', async (_req, res) => {
  if (syncInFlight) {
    return res.status(409).json({ success: false, error: 'Sync already in progress' });
  }

  syncInFlight = true;
  try {
    const result = await syncAllLeadsFromFacebook();
    updateSyncProgress({
      active: false,
      percent: 100,
      message: `Sync complete — ${result.added} added, ${result.total} total`,
      added: result.added,
      skipped: result.skipped,
      filtered: result.filtered,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    updateSyncProgress({
      active: false,
      percent: 0,
      message: `Sync failed: ${err.message}`,
    });
    console.error('sync-facebook error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    syncInFlight = false;
  }
});

app.post('/migrate-leads', async (req, res) => {
  try {
    const leads = req.body.leads || [];
    console.log('🔄 Migrating', leads.length, 'leads...');
    let inserted = 0;
    let skipped = 0;

    for (const lead of leads) {
      try {
        const newLead = {
          fbLeadId: lead.fbLeadId || (lead.source === 'facebook' ? lead.id : undefined),
          name: lead.name || '',
          phone: lead.phone || '',
          email: lead.email || '',
          city: lead.city || '',
          qualification: lead.qualification || '',
          whenPlanningToJoin: lead.whenPlanningToJoin || '',
          source: lead.source || 'manual',
          status: lead.status || 'not_picked',
          missedCallCount: lead.missedCallCount || 0,
          permanentlyHidden: lead.permanentlyHidden || false,
          nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : null,
          demoScheduledAt: lead.demoScheduledAt ? new Date(lead.demoScheduledAt) : null,
          hiddenUntil: lead.hiddenUntil ? new Date(lead.hiddenUntil) : null,
          lastShownAt: lead.lastShownAt ? new Date(lead.lastShownAt) : null,
          callHistory: (lead.callHistory || []).map((n) => ({
            note: n.note || '',
            statusAtTime: n.statusAtTime || 'not_picked',
            timestamp: n.timestamp ? new Date(n.timestamp) : new Date(),
          })),
          fbAdName: lead.fbAdName || '',
          fbCampaignName: lead.fbCampaignName || '',
        };

        const or = [];
        if (newLead.fbLeadId) or.push({ fbLeadId: newLead.fbLeadId });
        if (newLead.phone) or.push({ phone: newLead.phone });

        if (or.length > 0) {
          const existing = await Lead.findOne({ $or: or });
          if (existing) {
            skipped += 1;
            continue;
          }
        }

        await Lead.create(newLead);
        inserted += 1;
      } catch (e) {
        skipped += 1;
      }
    }

    console.log(`✅ Migration done: ${inserted} inserted, ${skipped} skipped`);
    res.json({ success: true, inserted, skipped, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test-lead', async (_req, res) => {
  try {
    const lead = new Lead({
      fbLeadId: `test_${Date.now()}`,
      name: 'Test Student',
      phone: '9876543210',
      email: 'test@innobuzz.in',
      city: 'Delhi',
      qualification: 'B.Tech',
      whenPlanningToJoin: 'Within 1 month',
      source: 'facebook',
      status: 'not_picked',
    });
    await lead.save();
    const total = await Lead.countDocuments();
    console.log('✅ Test lead added to MongoDB');
    res.json({ success: true, lead: serializeLead(lead), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test-lead', async (_req, res) => {
  try {
    const lead = new Lead({
      fbLeadId: `test_${Date.now()}`,
      name: 'Test Student',
      phone: `9876543${Math.floor(Math.random() * 1000)}`,
      email: 'test@innobuzz.in',
      city: 'Delhi',
      qualification: 'B.Tech',
      whenPlanningToJoin: 'Within 1 month',
      source: 'facebook',
      status: 'not_picked',
    });
    await lead.save();
    const total = await Lead.countDocuments();
    res.json({ success: true, lead: serializeLead(lead), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', async (_req, res) => {
  try {
    const count = await Lead.countDocuments();
    res.json({
      status: 'ok',
      database: 'MongoDB Atlas',
      mongoConnected: mongoose.connection.readyState === 1,
      totalLeads: count,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.json({ status: 'ok', mongoConnected: false, error: err.message });
  }
});

const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
const indexHtml = path.join(distPath, 'index.html');
const hasDashboard = fs.existsSync(indexHtml);

if (hasDashboard) {
  app.use(express.static(distPath, { index: 'index.html' }));
  app.get(/^\/(?!webhook|health|leads|test-lead|migrate-leads|sync-facebook|website-lead).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'FB Lead CRM Server', db: 'MongoDB Atlas' });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server running on port:', PORT);
  console.log('📦 MongoDB URI set:', !!process.env.MONGODB_URI);
  console.log('🔑 VERIFY_TOKEN set:', !!process.env.VERIFY_TOKEN);
  console.log('📘 FB_PAGE_ACCESS_TOKEN set:', !!process.env.FB_PAGE_ACCESS_TOKEN);
  console.log('📅 FB sync from:', process.env.FB_SYNC_FROM || DEFAULT_SYNC_FROM);
  if (hasDashboard) console.log('CRM dashboard served from /dist');
});
