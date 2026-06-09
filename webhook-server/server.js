const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

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
      enum: ['facebook', 'manual', 'excel_import'],
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
    const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();
    const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,created_time,field_data,ad_name,campaign_name&access_token=${token}`;
    console.log('🔍 Fetching lead:', leadgenId);
    const response = await fetch(url);
    const data = await response.json();
    console.log('📊 FB Response:', JSON.stringify(data));

    const fields = {};
    (data.field_data || []).forEach((f) => {
      fields[f.name] = f.values ? f.values[0] : '';
    });

    const leadData = {
      fbLeadId: leadgenId,
      name: fields.full_name || fields.name || '',
      phone: fields.phone_number || fields.phone || '',
      email: fields.email || '',
      city: fields.city || '',
      qualification: fields.what_is_your_qualification || fields.qualification || '',
      whenPlanningToJoin: fields.when_are_you_planning_to_join || '',
      source: 'facebook',
      status: 'not_picked',
      missedCallCount: 0,
      fbAdName: data.ad_name || '',
      fbCampaignName: data.campaign_name || '',
    };

    const saved = await Lead.findOneAndUpdate(
      { fbLeadId: leadgenId },
      { $setOnInsert: leadData },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log('✅ Lead saved to MongoDB:', saved.name, saved.phone);
  } catch (err) {
    console.log('❌ fetchAndSaveLead error:', err.message);
    try {
      await Lead.findOneAndUpdate(
        { fbLeadId: leadgenId },
        {
          $setOnInsert: {
            fbLeadId: leadgenId,
            name: 'Facebook Lead',
            source: 'facebook',
            status: 'not_picked',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (e) {
      console.log('❌ fallback save failed:', e.message);
    }
  }
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
      const phoneKey = normalizePhone(body.phone);
      const existing = await Lead.findOne({ phone: body.phone });
      if (existing) {
        return res.status(400).json({ error: 'Lead with this phone already exists' });
      }
      if (phoneKey) {
        const all = await Lead.find({ phone: { $ne: '' } });
        const dup = all.find((l) => normalizePhone(l.phone) === phoneKey);
        if (dup) {
          return res.status(400).json({ error: 'Lead with this phone already exists' });
        }
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
  app.get(/^\/(?!webhook|health|leads|test-lead|migrate-leads).*/, (_req, res) => {
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
  if (hasDashboard) console.log('CRM dashboard served from /dist');
});
