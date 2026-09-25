const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const RECIPIENTS_FILE = path.join(DATA_DIR, 'recipients.json');
const LOGS_FILE = path.join(DATA_DIR, 'dispatch_logs.json');

// Helper to read JSON
function readJSON(file, defaultVal = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return defaultVal;
}

// Helper to write JSON
function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Initialize seed data if not present
if (!fs.existsSync(ACCOUNTS_FILE)) {
  writeJSON(ACCOUNTS_FILE, [
    {
      id: "acc_default",
      name: "Primary Outreach (Gmail)",
      email: "infogenx.dm@gmail.com",
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      smtp_user: "infogenx.dm@gmail.com",
      smtp_pass: "qfeansqqiwvcpojz",
      secure: false,
      imap_host: "imap.gmail.com",
      is_default: true,
      created_at: new Date().toISOString()
    }
  ]);
}

if (!fs.existsSync(TEMPLATES_FILE)) {
  writeJSON(TEMPLATES_FILE, [
    {
      id: "tmpl_jv_partner",
      name: "Joint Venture & Revenue-Share Partnership",
      subject: "Joint Venture Opportunity: Revenue-Share Partner for Established Consultancy",
      category: "Partnership",
      html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body, p, div, table, td { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222; text-align: left !important; margin: 0; padding: 0; }
p { margin-bottom: 14px; }
ul { margin: 0 0 14px 20px; padding: 0; text-align: left; }
li { margin-bottom: 6px; }
a { color: #0056b3; }
</style>
</head>
<body style="text-align: left; margin: 0; padding: 15px;">
<div style="text-align: left; max-width: 100%;">
<p>Dear {{name}},</p>
<p>I hope this email finds you well at <strong>{{company}}</strong>.</p>
<p>We are reaching out to discuss a potential revenue-sharing Joint Venture partnership with your agency.</p>
<p><strong>What We Bring:</strong></p>
<ul>
  <li>10+ years delivery pedigree and full technical capabilities in Cloud, AI, and Software Architecture.</li>
  <li>Proven enterprise case studies and robust delivery infrastructure.</li>
  <li>Attractive revenue share based strictly on closed deals without upfront retainers.</li>
</ul>
<p>If you'd be open to exploring this mutually beneficial collaboration, please reply to this email to set up a quick 10-minute discovery call.</p>
<p>Best regards,<br>
<strong>{{sender_name}}</strong><br>
{{sender_email}}</p>
</div>
</body>
</html>`,
      created_at: new Date().toISOString()
    },
    {
      id: "tmpl_b2b_agency",
      name: "B2B Software & AI Solutions Pitch",
      subject: "Quick question regarding {{company}}'s digital roadmap",
      category: "B2B Sales",
      html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body, p, div, table, td { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222; text-align: left !important; margin: 0; padding: 0; }
p { margin-bottom: 14px; }
</style>
</head>
<body style="text-align: left; margin: 0; padding: 15px;">
<div style="text-align: left; max-width: 100%;">
<p>Hi {{name}},</p>
<p>I noticed the high quality of work {{company}} is executing in {{city}} and wanted to reach out.</p>
<p>We help businesses like yours accelerate their technical roadmap with high-performance custom web applications, automation, and AI pipelines.</p>
<p>Are you open to a brief conversation this week to see if we can assist your development bandwidth?</p>
<p>Best,<br><strong>{{sender_name}}</strong></p>
</div>
</body>
</html>`,
      created_at: new Date().toISOString()
    }
  ]);
}

// ==========================================
// 1. ACCOUNTS API (Dynamic Email Switcher)
// ==========================================
app.get('/api/accounts', (req, res) => {
  const accounts = readJSON(ACCOUNTS_FILE, []);
  // Return safe accounts without leaking full passwords
  const safeAccounts = accounts.map(a => ({
    ...a,
    smtp_pass: a.smtp_pass ? '••••••••••••' : ''
  }));
  res.json(safeAccounts);
});

app.post('/api/accounts', (req, res) => {
  const { name, email, smtp_host, smtp_port, smtp_user, smtp_pass, secure, imap_host, is_default } = req.body;
  if (!email || !smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'Missing required SMTP configuration fields' });
  }

  const accounts = readJSON(ACCOUNTS_FILE, []);
  if (is_default) {
    accounts.forEach(a => a.is_default = false);
  }

  const newAccount = {
    id: `acc_${Date.now()}`,
    name: name || email,
    email,
    smtp_host,
    smtp_port: parseInt(smtp_port) || 587,
    smtp_user,
    smtp_pass,
    secure: !!secure,
    imap_host: imap_host || 'imap.gmail.com',
    is_default: accounts.length === 0 ? true : !!is_default,
    created_at: new Date().toISOString()
  };

  accounts.push(newAccount);
  writeJSON(ACCOUNTS_FILE, accounts);
  res.status(201).json({ success: true, account: { ...newAccount, smtp_pass: '••••••••••••' } });
});

app.post('/api/accounts/:id/set-default', (req, res) => {
  const { id } = req.params;
  const accounts = readJSON(ACCOUNTS_FILE, []);
  const target = accounts.find(a => a.id === id);
  if (!target) return res.status(404).json({ error: 'Account not found' });

  accounts.forEach(a => a.is_default = (a.id === id));
  writeJSON(ACCOUNTS_FILE, accounts);
  res.json({ success: true, default_account: target.email });
});

app.delete('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  let accounts = readJSON(ACCOUNTS_FILE, []);
  accounts = accounts.filter(a => a.id !== id);
  if (accounts.length > 0 && !accounts.some(a => a.is_default)) {
    accounts[0].is_default = true;
  }
  writeJSON(ACCOUNTS_FILE, accounts);
  res.json({ success: true });
});

app.post('/api/accounts/test', async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, secure } = req.body;
  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 587,
      secure: !!secure || parseInt(smtp_port) === 465,
      auth: {
        user: smtp_user,
        pass: smtp_pass
      },
      connectionTimeout: 10000
    });

    await transporter.verify();
    res.json({ success: true, message: 'SMTP credentials verified successfully! Connection established.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. TEMPLATES API (Open Source Any Template)
// ==========================================
app.get('/api/templates', (req, res) => {
  const templates = readJSON(TEMPLATES_FILE, []);
  res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const { name, subject, category, html_content } = req.body;
  if (!name || !subject || !html_content) {
    return res.status(400).json({ error: 'Missing required template fields' });
  }

  const templates = readJSON(TEMPLATES_FILE, []);
  const newTemplate = {
    id: `tmpl_${Date.now()}`,
    name,
    subject,
    category: category || 'General',
    html_content,
    created_at: new Date().toISOString()
  };

  templates.push(newTemplate);
  writeJSON(TEMPLATES_FILE, templates);
  res.status(201).json(newTemplate);
});

app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const { name, subject, category, html_content } = req.body;
  const templates = readJSON(TEMPLATES_FILE, []);
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });

  templates[idx] = {
    ...templates[idx],
    name: name || templates[idx].name,
    subject: subject || templates[idx].subject,
    category: category || templates[idx].category,
    html_content: html_content || templates[idx].html_content,
    updated_at: new Date().toISOString()
  };

  writeJSON(TEMPLATES_FILE, templates);
  res.json(templates[idx]);
});

app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  let templates = readJSON(TEMPLATES_FILE, []);
  templates = templates.filter(t => t.id !== id);
  writeJSON(TEMPLATES_FILE, templates);
  res.json({ success: true });
});

// ==========================================
// 3. RECIPIENTS / LEADS API (Any To-Address)
// ==========================================
app.get('/api/recipients', (req, res) => {
  const recipients = readJSON(RECIPIENTS_FILE, []);
  res.json(recipients);
});

app.post('/api/recipients', (req, res) => {
  const { list } = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Expected an array of recipients in list field' });
  }

  const existing = readJSON(RECIPIENTS_FILE, []);
  const existingEmails = new Set(existing.map(r => r.email.toLowerCase().trim()));

  const added = [];
  list.forEach(item => {
    if (item.email && !existingEmails.has(item.email.toLowerCase().trim())) {
      const rec = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        email: item.email.toLowerCase().trim(),
        name: item.name || 'Prospective Partner',
        company: item.company || 'Enterprise Partner',
        city: item.city || 'Tamil Nadu',
        status: 'pending',
        mx_status: item.mx_status || 'unverified',
        created_at: new Date().toISOString()
      };
      existing.push(rec);
      added.push(rec);
      existingEmails.add(rec.email);
    }
  });

  writeJSON(RECIPIENTS_FILE, existing);
  res.json({ success: true, count: added.length, total: existing.length });
});

app.delete('/api/recipients/clear', (req, res) => {
  writeJSON(RECIPIENTS_FILE, []);
  res.json({ success: true, message: 'Recipients cleared' });
});

// Real-time DNS MX Verification Bridge (Uses Python Engine)
app.post('/api/recipients/verify-mx', (req, res) => {
  const recipients = readJSON(RECIPIENTS_FILE, []);
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients to verify' });
  }

  const emails = recipients.map(r => r.email);
  const scriptPath = path.join(__dirname, '..', 'python_engine', 'mx_verifier.py');

  const py = spawn('python', [scriptPath, JSON.stringify(emails)]);
  let stdoutData = '';
  let stderrData = '';

  py.stdout.on('data', data => { stdoutData += data.toString(); });
  py.stderr.on('data', data => { stderrData += data.toString(); });

  py.on('close', code => {
    try {
      const verificationMap = JSON.parse(stdoutData);
      let validCount = 0;
      recipients.forEach(r => {
        const v = verificationMap[r.email];
        if (v) {
          r.mx_status = v.valid ? 'verified' : 'dead_domain';
          r.mx_reason = v.reason;
          if (v.valid) validCount++;
        }
      });
      writeJSON(RECIPIENTS_FILE, recipients);
      res.json({ success: true, total: recipients.length, verified_count: validCount, recipients });
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse MX verification output', details: stdoutData, stderr: stderrData });
    }
  });
});

// ==========================================
// 4. DISPATCH ENGINE (Real-Time Outreach)
// ==========================================
let activeDispatchProcess = null;
let dispatchStatus = {
  running: false,
  total: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  current: '',
  logs: []
};

app.get('/api/dispatch/status', (req, res) => {
  res.json(dispatchStatus);
});

app.post('/api/dispatch/start', (req, res) => {
  if (dispatchStatus.running) {
    return res.status(400).json({ error: 'A dispatch campaign is already running' });
  }

  const { account_id, template_id, delay_seconds, only_verified } = req.body;
  const accounts = readJSON(ACCOUNTS_FILE, []);
  const templates = readJSON(TEMPLATES_FILE, []);
  let recipients = readJSON(RECIPIENTS_FILE, []);

  const account = account_id ? accounts.find(a => a.id === account_id) : accounts.find(a => a.is_default);
  const template = templates.find(t => t.id === template_id) || templates[0];

  if (!account) return res.status(400).json({ error: 'No sender email account configured' });
  if (!template) return res.status(400).json({ error: 'No email template selected' });

  if (only_verified) {
    recipients = recipients.filter(r => r.mx_status === 'verified');
  }

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients available for dispatch' });
  }

  const payload = {
    account,
    campaign: {
      name: template.name,
      subject: template.subject,
      html_template: template.html_content,
      text_template: ""
    },
    recipients,
    options: {
      delay_seconds: parseFloat(delay_seconds) || 5.0,
      verify_mx: true,
      save_to_sent: true,
      label_name: "Outreach-Omni"
    }
  };

  const scriptPath = path.join(__dirname, '..', 'python_engine', 'send_engine.py');
  activeDispatchProcess = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

  dispatchStatus = {
    running: true,
    total: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    current: 'Initializing connection...',
    logs: []
  };

  activeDispatchProcess.stdin.write(JSON.stringify(payload));
  activeDispatchProcess.stdin.end();

  activeDispatchProcess.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line.trim());
        if (msg.type === 'progress') {
          const item = msg.item;
          if (item.status === 'sent') dispatchStatus.sent++;
          else if (item.status === 'failed') dispatchStatus.failed++;
          else if (item.status === 'skipped') dispatchStatus.skipped++;
          dispatchStatus.current = `${item.status.toUpperCase()}: ${item.email}`;
          dispatchStatus.logs.push(item);
        } else if (msg.type === 'finished') {
          dispatchStatus.running = false;
          dispatchStatus.current = 'Completed';
        }
      } catch (e) {
        // Raw line
      }
    });
  });

  activeDispatchProcess.on('close', code => {
    dispatchStatus.running = false;
    activeDispatchProcess = null;
  });

  res.json({ success: true, message: 'Dispatch process started', total: recipients.length });
});

app.post('/api/dispatch/stop', (req, res) => {
  if (activeDispatchProcess) {
    activeDispatchProcess.kill();
    activeDispatchProcess = null;
    dispatchStatus.running = false;
    dispatchStatus.current = 'Terminated by user';
    return res.json({ success: true, message: 'Dispatch stopped' });
  }
  res.json({ success: false, message: 'No active dispatch running' });
});

// ==========================================
// 5. STATS & OVERVIEW API
// ==========================================
app.get('/api/stats', (req, res) => {
  const accounts = readJSON(ACCOUNTS_FILE, []);
  const templates = readJSON(TEMPLATES_FILE, []);
  const recipients = readJSON(RECIPIENTS_FILE, []);

  res.json({
    accounts_count: accounts.length,
    default_sender: (accounts.find(a => a.is_default) || {}).email || 'None',
    templates_count: templates.length,
    recipients_count: recipients.length,
    verified_mx_count: recipients.filter(r => r.mx_status === 'verified').length,
    dead_domain_count: recipients.filter(r => r.mx_status === 'dead_domain').length,
    dispatched_count: dispatchStatus.sent
  });
});

app.listen(PORT, () => {
  console.log(`[Infonix Omni Engine API] Running on http://localhost:${PORT}`);
});
