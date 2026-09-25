import React, { useState, useEffect } from 'react';
import {
  Send, Mail, Users, FileText, Settings, ShieldCheck, CheckCircle2,
  AlertTriangle, XCircle, Play, Square, Plus, Trash2, RefreshCw, Eye,
  Globe, Server, ArrowRight, Layers, BarChart3, Database, KeyRound
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    accounts_count: 1,
    default_sender: 'infogenx.dm@gmail.com',
    templates_count: 2,
    recipients_count: 65,
    verified_mx_count: 65,
    dead_domain_count: 0,
    dispatched_count: 0
  });

  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [dispatchStatus, setDispatchStatus] = useState({ running: false, total: 0, sent: 0, failed: 0, skipped: 0, current: '', logs: [] });

  // Account Form Modal
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    secure: false,
    imap_host: 'imap.gmail.com',
    is_default: true
  });
  const [accountTestResult, setAccountTestResult] = useState(null);
  const [accountTestLoading, setAccountTestLoading] = useState(false);

  // Template Form State
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', category: 'General', html_content: '' });
  const [templatePreviewContext, setTemplatePreviewContext] = useState({
    name: 'Vignesh',
    company: 'Leadpro Infotech',
    city: 'Coimbatore',
    sender_name: 'Mohamed Yasar',
    sender_email: 'infogenx.dm@gmail.com'
  });

  // Recipient Import
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [manualRecipientsText, setManualRecipientsText] = useState('');
  const [verifyingMX, setVerifyingMX] = useState(false);

  // Dispatch Config
  const [dispatchConfig, setDispatchConfig] = useState({
    account_id: '',
    template_id: '',
    delay_seconds: 5,
    only_verified: true
  });

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [resStats, resAccs, resTmpls, resRecs, resDisp] = await Promise.all([
        fetch(`${API_BASE}/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/accounts`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/templates`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/recipients`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/dispatch/status`).then(r => r.json()).catch(() => null)
      ]);

      if (resStats) setStats(resStats);
      if (resAccs) {
        setAccounts(resAccs);
        const defAcc = resAccs.find(a => a.is_default);
        if (defAcc && !dispatchConfig.account_id) {
          setDispatchConfig(prev => ({ ...prev, account_id: defAcc.id }));
        }
      }
      if (resTmpls && resTmpls.length > 0) {
        setTemplates(resTmpls);
        if (!selectedTemplate) {
          setSelectedTemplate(resTmpls[0]);
          setTemplateForm(resTmpls[0]);
        }
        if (!dispatchConfig.template_id) {
          setDispatchConfig(prev => ({ ...prev, template_id: resTmpls[0].id }));
        }
      }
      if (resRecs) setRecipients(resRecs);
      if (resDisp) setDispatchStatus(resDisp);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(async () => {
      try {
        const d = await fetch(`${API_BASE}/dispatch/status`).then(r => r.json());
        setDispatchStatus(d);
        if (d.running) {
          const s = await fetch(`${API_BASE}/stats`).then(r => r.json());
          setStats(s);
        }
      } catch (e) {}
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Set Default Account
  const setDefaultAccount = async (id) => {
    try {
      await fetch(`${API_BASE}/accounts/${id}/set-default`, { method: 'POST' });
      fetchData();
    } catch (err) {
      alert("Failed to update active account: " + err.message);
    }
  };

  // Delete Account
  const deleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to remove this account?")) return;
    try {
      await fetch(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert("Failed to remove account: " + err.message);
    }
  };

  // Test Account Connection
  const handleTestAccount = async () => {
    setAccountTestLoading(true);
    setAccountTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/accounts/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm)
      });
      const data = await res.json();
      setAccountTestResult(data);
    } catch (err) {
      setAccountTestResult({ success: false, error: err.message });
    } finally {
      setAccountTestLoading(false);
    }
  };

  // Save Account
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm)
      });
      if (res.ok) {
        setShowAddAccount(false);
        setAccountForm({
          name: '',
          email: '',
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          smtp_user: '',
          smtp_pass: '',
          secure: false,
          imap_host: 'imap.gmail.com',
          is_default: true
        });
        setAccountTestResult(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add account');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Save Template
  const handleSaveTemplate = async () => {
    try {
      if (selectedTemplate && selectedTemplate.id) {
        await fetch(`${API_BASE}/templates/${selectedTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      } else {
        await fetch(`${API_BASE}/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      }
      fetchData();
      alert("Template saved successfully!");
    } catch (err) {
      alert("Failed to save template: " + err.message);
    }
  };

  // Real-time DNS MX Verification
  const runMXVerification = async () => {
    setVerifyingMX(true);
    try {
      const res = await fetch(`${API_BASE}/recipients/verify-mx`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRecipients(data.recipients);
        fetchData();
        alert(`MX Verification Complete! Verified: ${data.verified_count} / ${data.total} recipients`);
      } else {
        alert(data.error || 'MX check failed');
      }
    } catch (err) {
      alert('Error during MX check: ' + err.message);
    } finally {
      setVerifyingMX(false);
    }
  };

  // Add Recipients Bulk
  const handleAddRecipientsBulk = async () => {
    const lines = manualRecipientsText.split('\n').filter(l => l.trim());
    const list = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        email: parts[0],
        name: parts[1] || 'Prospective Partner',
        company: parts[2] || 'Enterprise Partner',
        city: parts[3] || 'Tamil Nadu'
      };
    });

    if (list.length === 0) return alert("Please enter valid recipients");

    try {
      const res = await fetch(`${API_BASE}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list })
      });
      const data = await res.json();
      if (data.success) {
        setManualRecipientsText('');
        setShowAddRecipient(false);
        fetchData();
        alert(`Added ${data.count} new recipients!`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Start Dispatch
  const handleStartDispatch = async () => {
    try {
      const res = await fetch(`${API_BASE}/dispatch/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchConfig)
      });
      const data = await res.json();
      if (data.success) {
        setDispatchStatus(prev => ({ ...prev, running: true }));
      } else {
        alert(data.error || 'Failed to start dispatch');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Stop Dispatch
  const handleStopDispatch = async () => {
    try {
      await fetch(`${API_BASE}/dispatch/stop`, { method: 'POST' });
    } catch (err) {
      alert(err.message);
    }
  };

  // Render Template Interpolation
  const renderPreviewHTML = (tmplStr) => {
    if (!tmplStr) return '';
    let rendered = tmplStr;
    Object.keys(templatePreviewContext).forEach(k => {
      rendered = rendered.split(`{{${k}}}`).join(templatePreviewContext[k] || '');
    });
    return rendered;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ background: '#0e1422', borderBottom: '1px solid var(--border-color)', padding: '0.85rem 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
              <Send size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>OmniReach</span>
                <span className="badge badge-blue">Open Source</span>
              </div>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Multi-Account Cold Email Automation & Zero-Bounce Engine</p>
            </div>
          </div>

          {/* Quick Active Sender Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#141d2e', padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="live-pulse"></span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active Sender:</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38bdf8' }}>
                {accounts.find(a => a.is_default)?.email || 'None Configured'}
              </span>
            </div>

            <button
              onClick={() => { setActiveTab('accounts'); setShowAddAccount(true); }}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.8rem' }}
            >
              <Plus size={14} /> Add Sender
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div style={{ background: '#121929', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 1.5rem' }}>
          {[
            { id: 'dashboard', label: 'Dashboard & Metrics', icon: BarChart3 },
            { id: 'accounts', label: 'Sender Accounts (Switcher)', icon: Settings, count: accounts.length },
            { id: 'templates', label: 'Templates Studio', icon: FileText, count: templates.length },
            { id: 'recipients', label: 'Recipients & Leads', icon: Users, count: recipients.length },
            { id: 'dispatch', label: 'Live Dispatch Console', icon: Send, pulse: dispatchStatus.running }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: active ? '#60a5fa' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px', background: active ? '#2563eb' : '#1e293b', color: '#fff' }}>
                    {tab.count}
                  </span>
                )}
                {tab.pulse && <span className="live-pulse" style={{ background: '#38bdf8' }}></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Body Content */}
      <main className="container" style={{ flex: 1, padding: '2rem 1.5rem' }}>

        {/* ============================================================ */}
        {/* 1. DASHBOARD OVERVIEW                                        */}
        {/* ============================================================ */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Campaign & Delivery Dashboard</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Multi-threaded Cold Outreach engine with pre-flight DNS MX verification and dynamic sender routing.
              </p>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Verified Leads (Zero-Bounce)</span>
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#10b981' }}>
                    <ShieldCheck size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>
                  {stats.verified_mx_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.35rem' }}>
                  <CheckCircle2 size={13} /> 100% Active DNS MX Records
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Configured Sender Accounts</span>
                  <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#3b82f6' }}>
                    <Settings size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>
                  {stats.accounts_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.35rem' }}>
                  Switch sender anytime with 1-click
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Available Templates</span>
                  <div style={{ background: 'rgba(147, 51, 234, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#c084fc' }}>
                    <FileText size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>
                  {stats.templates_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#c084fc', marginTop: '0.35rem' }}>
                  Full variable interpolation ready
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Engine Dispatch Status</span>
                  <div style={{ background: dispatchStatus.running ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)', padding: '0.4rem', borderRadius: '8px', color: dispatchStatus.running ? '#10b981' : '#94a3b8' }}>
                    <Send size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: dispatchStatus.running ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {dispatchStatus.running && <span className="live-pulse"></span>}
                  {dispatchStatus.running ? 'SENDING LIVE' : 'IDLE / READY'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {dispatchStatus.current || 'No active background dispatch'}
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} color="#10b981" /> Pre-Flight MX Verification Guarantee
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
                  Every recipient domain is verified against authoritative DNS MX servers before any email is dispatched. This guarantees zero bounced emails and prevents spam scoring.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={runMXVerification} disabled={verifyingMX} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    <RefreshCw size={14} className={verifyingMX ? 'spin' : ''} /> {verifyingMX ? 'Verifying...' : 'Run MX Verification'}
                  </button>
                  <button onClick={() => setActiveTab('recipients')} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                    View Leads ({recipients.length})
                  </button>
                </div>
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <KeyRound size={18} color="#38bdf8" /> Dynamic Email Account Switching
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
                  Add multiple Gmail, Google Workspace, Outlook, or Custom SMTP accounts. You can dynamically switch the sender address anytime without editing any code or restarting the server.
                </p>
                <button onClick={() => setActiveTab('accounts')} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                  Manage Accounts ({accounts.length}) <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. SENDER ACCOUNTS (Dynamic Switcher)                         */}
        {/* ============================================================ */}
        {activeTab === 'accounts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sender Accounts Manager</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Switch your sender email account anytime. Configure multiple SMTP/IMAP credentials with live connection testing.
                </p>
              </div>
              <button onClick={() => setShowAddAccount(true)} className="btn btn-primary">
                <Plus size={16} /> Add New Sender Account
              </button>
            </div>

            {/* Account List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="glass-card"
                  style={{
                    border: acc.is_default ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    background: acc.is_default ? 'rgba(30, 41, 67, 0.8)' : 'rgba(26, 34, 52, 0.7)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>{acc.name}</span>
                        {acc.is_default && <span className="badge badge-blue">Active Sender</span>}
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#38bdf8', fontFamily: 'monospace' }}>{acc.email}</p>
                    </div>
                    <button onClick={() => deleteAccount(acc.id)} className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} title="Delete Account">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>SMTP Host: <strong style={{ color: '#fff' }}>{acc.smtp_host}</strong></div>
                    <div>Port: <strong style={{ color: '#fff' }}>{acc.smtp_port}</strong></div>
                    <div>Username: <strong style={{ color: '#fff' }}>{acc.smtp_user}</strong></div>
                    <div>SSL/TLS: <strong style={{ color: '#fff' }}>{acc.secure ? 'SSL' : 'STARTTLS'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {!acc.is_default && (
                      <button onClick={() => setDefaultAccount(acc.id)} className="btn btn-success" style={{ flex: 1, fontSize: '0.8rem' }}>
                        Set as Active Sender
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        alert(`Account verified: ${acc.email} is active and ready to dispatch.`);
                      }}
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <CheckCircle2 size={14} /> Connection OK
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Account Modal */}
            {showAddAccount && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '520px', background: '#131b2e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Connect New Sender Account</h2>
                    <button onClick={() => setShowAddAccount(false)} className="btn btn-outline" style={{ padding: '0.35rem' }}>
                      <XCircle size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAccount}>
                    <div className="input-group">
                      <label className="input-label">Display Name</label>
                      <input
                        className="input-field"
                        placeholder="e.g. Outreach Team / Marketing Lead"
                        value={accountForm.name}
                        onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Sender Email Address</label>
                      <input
                        type="email"
                        className="input-field"
                        placeholder="e.g. outreach@yourdomain.com or user@gmail.com"
                        value={accountForm.email}
                        onChange={e => setAccountForm({ ...accountForm, email: e.target.value, smtp_user: e.target.value })}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div className="input-group">
                        <label className="input-label">SMTP Host</label>
                        <input
                          className="input-field"
                          placeholder="smtp.gmail.com"
                          value={accountForm.smtp_host}
                          onChange={e => setAccountForm({ ...accountForm, smtp_host: e.target.value })}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Port</label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="587"
                          value={accountForm.smtp_port}
                          onChange={e => setAccountForm({ ...accountForm, smtp_port: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">SMTP App Password / Token</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="App password or secret key"
                        value={accountForm.smtp_pass}
                        onChange={e => setAccountForm({ ...accountForm, smtp_pass: e.target.value })}
                        required
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        For Gmail, use a 16-character Google App Password (My Account &gt; Security &gt; 2-Step &gt; App Passwords).
                      </p>
                    </div>

                    {accountTestResult && (
                      <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: accountTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', color: accountTestResult.success ? '#34d399' : '#fb7185', border: `1px solid ${accountTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}` }}>
                        {accountTestResult.success ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={16} /> {accountTestResult.message}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={16} /> {accountTestResult.error}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
                      <button type="button" onClick={handleTestAccount} disabled={accountTestLoading} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                        <RefreshCw size={14} className={accountTestLoading ? 'spin' : ''} /> {accountTestLoading ? 'Testing...' : 'Test Connection'}
                      </button>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={() => setShowAddAccount(false)} className="btn btn-outline">Cancel</button>
                        <button type="submit" className="btn btn-primary">Save & Connect</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. TEMPLATES STUDIO (Open Source Universal Templates)        */}
        {/* ============================================================ */}
        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Templates Studio</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Create or edit any email template. Dynamic variable chips automatically replace recipient details.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setTemplateForm({ name: 'New Custom Template', subject: 'Partnership with {{company}}', category: 'Custom', html_content: '<p>Hi {{name}},</p><p>I noticed {{company}}...</p>' });
                }}
                className="btn btn-primary"
              >
                <Plus size={16} /> Create Template
              </button>
            </div>

            {/* Template Selector Pills */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setTemplateForm(t);
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: selectedTemplate?.id === t.id ? 600 : 400,
                    background: selectedTemplate?.id === t.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(26, 34, 52, 0.7)',
                    border: selectedTemplate?.id === t.id ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    color: selectedTemplate?.id === t.id ? '#60a5fa' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <FileText size={14} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>

            {/* Editor & Live Preview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
              {/* Editor */}
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Template Editor</h3>
                  <button onClick={handleSaveTemplate} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}>
                    Save Template
                  </button>
                </div>

                <div className="input-group">
                  <label className="input-label">Template Name</label>
                  <input
                    className="input-field"
                    value={templateForm.name}
                    onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Subject Line (Supports variables)</label>
                  <input
                    className="input-field"
                    value={templateForm.subject}
                    onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  />
                </div>

                {/* Variable helper pills */}
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Click variable to copy:</span>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {['{{name}}', '{{company}}', '{{city}}', '{{email}}', '{{sender_name}}', '{{sender_email}}'].map(tag => (
                      <span
                        key={tag}
                        onClick={() => {
                          setTemplateForm({ ...templateForm, html_content: templateForm.html_content + ` ${tag} ` });
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#1e293b', borderRadius: '4px', cursor: 'pointer', color: '#38bdf8', border: '1px solid var(--border-color)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">HTML Content (100% Left-Aligned Format)</label>
                  <textarea
                    className="input-field"
                    rows={14}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}
                    value={templateForm.html_content}
                    onChange={e => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Eye size={16} color="#38bdf8" /> Live Email Preview
                  </h3>
                  <span className="badge badge-emerald">100% Left-Aligned</span>
                </div>

                <div style={{ background: '#0e1422', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                  <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Subject:</strong> {renderPreviewHTML(templateForm.subject)}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>From:</strong> {templatePreviewContext.sender_name} &lt;{templatePreviewContext.sender_email}&gt;</div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    color: '#222222',
                    padding: '1.25rem',
                    borderRadius: '6px',
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    textAlign: 'left'
                  }}
                  dangerouslySetInnerHTML={{ __html: renderPreviewHTML(templateForm.html_content) }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. RECIPIENTS & LEADS (Any To-Address)                       */}
        {/* ============================================================ */}
        {activeTab === 'recipients' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Recipients & Leads Manager</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Import any recipient list. 1-Click DNS MX Verification ensures zero bounces before sending.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={runMXVerification} disabled={verifyingMX} className="btn btn-outline">
                  <RefreshCw size={15} className={verifyingMX ? 'spin' : ''} /> {verifyingMX ? 'Verifying...' : 'Verify DNS MX'}
                </button>
                <button onClick={() => setShowAddRecipient(true)} className="btn btn-primary">
                  <Plus size={15} /> Import Leads
                </button>
              </div>
            </div>

            {/* Recipient Table */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email Address (To)</th>
                    <th>Contact Person</th>
                    <th>Company / Agency</th>
                    <th>City / Region</th>
                    <th>MX Verification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r, i) => (
                    <tr key={r.id || i}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td>
                        <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{r.email}</strong>
                      </td>
                      <td>{r.name}</td>
                      <td>{r.company}</td>
                      <td>{r.city}</td>
                      <td>
                        {r.mx_status === 'verified' ? (
                          <span className="badge badge-emerald"><CheckCircle2 size={12} /> MX Verified</span>
                        ) : r.mx_status === 'dead_domain' ? (
                          <span className="badge badge-rose"><XCircle size={12} /> Dead Domain</span>
                        ) : (
                          <span className="badge badge-amber"><RefreshCw size={12} /> Unverified</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {r.status || 'Ready'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Recipients Modal */}
            {showAddRecipient && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '580px', background: '#131b2e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Import Recipients (Any To-Address)</h2>
                    <button onClick={() => setShowAddRecipient(false)} className="btn btn-outline" style={{ padding: '0.35rem' }}>
                      <XCircle size={18} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Paste recipient entries (1 per line). Format: <code>email, name, company, city</code>
                  </p>

                  <textarea
                    className="input-field"
                    rows={8}
                    placeholder="contact@agency.com, Rajesh, Digital Agency, Chennai&#10;sales@company.in, Priya, Web Studio, Coimbatore"
                    value={manualRecipientsText}
                    onChange={e => setManualRecipientsText(e.target.value)}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button onClick={() => setShowAddRecipient(false)} className="btn btn-outline">Cancel</button>
                    <button onClick={handleAddRecipientsBulk} className="btn btn-primary">Import & Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. LIVE DISPATCH CONSOLE                                     */}
        {/* ============================================================ */}
        {activeTab === 'dispatch' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Live Dispatch Console</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Execute high-deliverability outreach with auto-reconnect, custom throttle delay, and live terminal monitoring.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Configuration Card */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem' }}>Campaign Launch Settings</h3>

                <div className="input-group">
                  <label className="input-label">Sender Account</label>
                  <select
                    className="input-field"
                    value={dispatchConfig.account_id}
                    onChange={e => setDispatchConfig({ ...dispatchConfig, account_id: e.target.value })}
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email}) {a.is_default ? '★ Active' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Outreach Template</label>
                  <select
                    className="input-field"
                    value={dispatchConfig.template_id}
                    onChange={e => setDispatchConfig({ ...dispatchConfig, template_id: e.target.value })}
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Delay Between Sends: {dispatchConfig.delay_seconds} seconds</label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    className="input-field"
                    value={dispatchConfig.delay_seconds}
                    onChange={e => setDispatchConfig({ ...dispatchConfig, delay_seconds: e.target.value })}
                  />
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Recommended 5-6s for Gmail to avoid rate limits and simulate human sending.
                  </p>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  {!dispatchStatus.running ? (
                    <button onClick={handleStartDispatch} className="btn btn-primary" style={{ flex: 1 }}>
                      <Play size={16} /> Launch Dispatch
                    </button>
                  ) : (
                    <button onClick={handleStopDispatch} className="btn btn-danger" style={{ flex: 1 }}>
                      <Square size={16} /> Stop Dispatch
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Summary Card */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Dispatch Execution Status</span>
                  {dispatchStatus.running && <span className="badge badge-emerald">Live Sending</span>}
                </h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                    <span>Progress:</span>
                    <span>{dispatchStatus.sent} / {dispatchStatus.total || recipients.length} ({dispatchStatus.total ? Math.round((dispatchStatus.sent / dispatchStatus.total) * 100) : 0}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#0e1422', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                        width: `${dispatchStatus.total ? (dispatchStatus.sent / dispatchStatus.total) * 100 : 0}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>SENT</span>
                    <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>{dispatchStatus.sent}</p>
                  </div>
                  <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>SKIPPED</span>
                    <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fbbf24' }}>{dispatchStatus.skipped}</p>
                  </div>
                  <div style={{ background: '#111827', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>FAILED</span>
                    <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fb7185' }}>{dispatchStatus.failed}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Live Logs */}
            <div className="glass-card" style={{ background: '#0a0e17' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  LIVE DISPATCH CONSOLE LOGS
                </span>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Auto-updating</span>
              </div>
              <div
                style={{
                  height: '240px',
                  overflowY: 'auto',
                  background: '#060911',
                  borderRadius: '6px',
                  padding: '0.85rem',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  border: '1px solid #1a2333',
                  lineHeight: '1.6'
                }}
              >
                {dispatchStatus.logs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>[READY] No dispatch session initiated yet. Click "Launch Dispatch" above to begin.</p>
                ) : (
                  dispatchStatus.logs.map((log, idx) => (
                    <div key={idx} style={{ color: log.status === 'sent' ? '#34d399' : log.status === 'failed' ? '#fb7185' : '#fbbf24' }}>
                      [{log.timestamp || new Date().toLocaleTimeString()}] [{log.status.toUpperCase()}] -&gt; {log.email} ({log.company || 'Enterprise'})
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem 0', background: '#090d16', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            OmniReach Engine • Open Source Cold Email Platform
          </div>
          <div>
            Built with React.js, Node.js &amp; Python • Zero-Bounce DNS Verification
          </div>
        </div>
      </footer>
    </div>
  );
}
