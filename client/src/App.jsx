import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Send, Mail, Users, FileText, Settings, ShieldCheck, CheckCircle2,
  AlertTriangle, XCircle, Play, Square, Plus, Trash2, RefreshCw, Eye,
  Globe, Server, ArrowRight, Layers, BarChart3, Database, KeyRound,
  FileSpreadsheet, Upload, Link as LinkIcon, HelpCircle, ExternalLink,
  ChevronRight, Filter, Search, Download, Info
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('sheet_studio'); // Default to the newly requested Sheet Studio!
  const [stats, setStats] = useState({
    accounts_count: 1,
    default_sender: 'infogenx.dm@gmail.com',
    templates_count: 2,
    recipients_count: 65,
    verified_mx_count: 65,
    dead_domain_count: 0,
    dispatched_count: 0,
    delivered_count: 0,
    bounced_count: 0,
    skipped_count: 0
  });

  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [dispatchStatus, setDispatchStatus] = useState({
    running: false, total: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, skipped: 0, current: '', logs: []
  });

  // ==========================================
  // SPREADSHEET & EXCEL MULTI-TAB STATE
  // ==========================================
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1vl5moxgRvXo-rJOFPYphtqgROb1L29hYxe8JhRQfHE0/edit?gid=1245949174#gid=1245949174');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [sheetData, setSheetData] = useState(null); // { sheet_id, total_tabs, tabs: [...] }
  const [activeSheetTabIdx, setActiveSheetTabIdx] = useState(0);
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [showHowToShareModal, setShowHowToShareModal] = useState(false);
  const [showAppPasswordGuide, setShowAppPasswordGuide] = useState(false);
  const fileInputRef = useRef(null);

  // Dispatch from Sheet Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchScope, setDispatchScope] = useState('current_tab'); // 'current_tab' | 'all_tabs'
  const [dispatchSummaryReport, setDispatchSummaryReport] = useState(null);

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

  // Dispatch Config
  const [dispatchConfig, setDispatchConfig] = useState({
    account_id: '',
    template_id: '',
    delay_seconds: 5,
    only_verified: false
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
      if (resAccs && resAccs.length > 0) {
        setAccounts(resAccs);
        const defAcc = resAccs.find(a => a.is_default) || resAccs[0];
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
      if (resDisp) {
        setDispatchStatus(resDisp);
        if (resDisp.running) {
          setDispatchSummaryReport(null);
        } else if (!resDisp.running && resDisp.sent > 0 && !dispatchSummaryReport) {
          setDispatchSummaryReport({
            total: resDisp.total,
            sent: resDisp.sent,
            delivered: resDisp.delivered || resDisp.sent,
            skipped: resDisp.skipped,
            bounced: resDisp.bounced,
            failed: resDisp.failed
          });
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto load default sample Google Sheet on mount
    loadGoogleSheetUrl(sheetUrl);

    const interval = setInterval(async () => {
      try {
        const d = await fetch(`${API_BASE}/dispatch/status`).then(r => r.json());
        setDispatchStatus(d);
        if (d.running) {
          const s = await fetch(`${API_BASE}/stats`).then(r => r.json());
          setStats(s);
        } else if (d.sent > 0 && !dispatchSummaryReport) {
          setDispatchSummaryReport({
            total: d.total,
            sent: d.sent,
            delivered: d.delivered || d.sent,
            skipped: d.skipped,
            bounced: d.bounced,
            failed: d.failed
          });
        }
      } catch (e) {}
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // SPREADSHEET PARSING FUNCTIONS
  // ==========================================
  const loadGoogleSheetUrl = async (urlToLoad) => {
    const targetUrl = urlToLoad || sheetUrl;
    if (!targetUrl.trim()) {
      setSheetError("Please enter a Google Spreadsheet URL");
      return;
    }
    setSheetLoading(true);
    setSheetError(null);
    try {
      const res = await fetch(`${API_BASE}/sheets/load-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSheetData(data);
        setActiveSheetTabIdx(0);
      } else {
        setSheetError(data.error || "Failed to load Google Sheet. Ensure access is set to 'Anyone with the link'.");
      }
    } catch (err) {
      setSheetError("Network error loading Google Sheet: " + err.message);
    } finally {
      setSheetLoading(false);
    }
  };

  // Handle Local Excel / CSV File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSheetLoading(true);
    setSheetError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const tabs = workbook.SheetNames.map(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (rawData.length === 0) {
            return { name: sheetName, row_count: 0, headers: [], rows: [], detected_columns: {} };
          }

          const headerRowIndex = rawData.findIndex(r => r.some(cell => String(cell).trim() !== ''));
          const headers = headerRowIndex !== -1 ? rawData[headerRowIndex].map(h => String(h).trim()) : [];
          const dataRows = headerRowIndex !== -1 ? rawData.slice(headerRowIndex + 1).filter(r => r.some(c => String(c).trim() !== '')) : [];

          // Column Detection
          const lowerHeaders = headers.map(h => String(h || '').toLowerCase().trim());
          const colMap = { email: null, name: null, company: null, city: null };

          const emailKw = ['work email', 'email', 'e-mail', 'mail', 'email address', 'contact email'];
          for (let kw of emailKw) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { colMap.email = headers[idx]; break; }
          }
          if (!colMap.email) {
            for (let c = 0; c < headers.length; c++) {
              if (dataRows.some(r => r[c] && String(r[c]).includes('@') && String(r[c]).includes('.'))) {
                colMap.email = headers[c];
                break;
              }
            }
          }

          const nameKw = ['contact person', 'name', 'full name', 'person name', 'lead name', 'first name'];
          for (let kw of nameKw) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { colMap.name = headers[idx]; break; }
          }

          const compKw = ['company', 'agency', 'company / agency name', 'organization', 'business name'];
          for (let kw of compKw) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { colMap.company = headers[idx]; break; }
          }

          const cityKw = ['city', 'location', 'place', 'city / place', 'region'];
          for (let kw of cityKw) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { colMap.city = headers[idx]; break; }
          }

          const formattedRows = dataRows.map((row, idx) => {
            const obj = { _row_index: idx + 1 };
            headers.forEach((h, colIdx) => {
              if (h) obj[h] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
            });
            obj._detected_email = colMap.email ? obj[colMap.email] : '';
            obj._detected_name = colMap.name ? obj[colMap.name] : 'Prospective Partner';
            obj._detected_company = colMap.company ? obj[colMap.company] : 'Your Agency';
            obj._detected_city = colMap.city ? obj[colMap.city] : 'your region';
            return obj;
          });

          return {
            name: sheetName,
            row_count: formattedRows.length,
            headers,
            detected_columns: colMap,
            rows: formattedRows
          };
        });

        setSheetData({
          filename: file.name,
          total_tabs: tabs.length,
          tabs
        });
        setActiveSheetTabIdx(0);
      } catch (err) {
        setSheetError("Failed to parse file: " + err.message);
      } finally {
        setSheetLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Launch One-by-One Dispatch for Active Tab
  const launchDispatchForSheet = async () => {
    if (!sheetData || !sheetData.tabs || sheetData.tabs.length === 0) {
      alert("No sheet loaded to dispatch!");
      return;
    }

    const currentTab = sheetData.tabs[activeSheetTabIdx];
    let targetRecipients = [];

    if (dispatchScope === 'current_tab') {
      targetRecipients = currentTab.rows.filter(r => r._detected_email && r._detected_email.includes('@'));
    } else {
      // All tabs
      sheetData.tabs.forEach(t => {
        const validRows = t.rows.filter(r => r._detected_email && r._detected_email.includes('@'));
        targetRecipients.push(...validRows);
      });
    }

    if (targetRecipients.length === 0) {
      alert("Could not detect any valid email addresses in the selected rows. Please verify column headers.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/dispatch/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: dispatchConfig.account_id,
          template_id: dispatchConfig.template_id,
          delay_seconds: dispatchConfig.delay_seconds,
          custom_recipients: targetRecipients,
          batch_label: `Sheet-Tab-${currentTab.name}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setDispatchModalOpen(false);
        setActiveTab('dispatch');
        setDispatchSummaryReport(null);
      } else {
        alert(data.error || "Failed to start dispatch");
      }
    } catch (err) {
      alert(err.message);
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
        alert("Account connected successfully!");
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add account');
      }
    } catch (err) {
      alert(err.message);
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

  // Set Default Account
  const setDefaultAccount = async (id) => {
    try {
      await fetch(`${API_BASE}/accounts/${id}/set-default`, { method: 'POST' });
      fetchData();
    } catch (err) {
      alert("Failed to update active account: " + err.message);
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

  // Render Template Interpolation Preview
  const renderPreviewHTML = (tmplStr) => {
    if (!tmplStr) return '';
    let rendered = tmplStr;
    Object.keys(templatePreviewContext).forEach(k => {
      rendered = rendered.split(`{{${k}}}`).join(templatePreviewContext[k] || '');
    });
    return rendered;
  };

  const activeTabObj = sheetData?.tabs?.[activeSheetTabIdx];
  const filteredRows = activeTabObj?.rows?.filter(r => {
    if (!sheetSearchQuery) return true;
    return Object.values(r).some(v => String(v).toLowerCase().includes(sheetSearchQuery.toLowerCase()));
  }) || [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ background: '#0e1422', borderBottom: '1px solid var(--border-color)', padding: '0.85rem 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>OmniReach</span>
                <span className="badge badge-blue">Open Source Engine</span>
              </div>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Multi-Tab Excel &amp; Google Sheet Automation • Zero-Bounce Delivery</p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Active Sender Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#141d2e', padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="live-pulse"></span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sender:</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38bdf8' }}>
                {accounts.find(a => a.is_default)?.email || 'None Configured'}
              </span>
            </div>

            {/* Quick App Password Helper Button */}
            <button
              onClick={() => setShowAppPasswordGuide(true)}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.8rem', borderColor: '#f59e0b', color: '#fbbf24' }}
              title="How to generate Gmail App Password"
            >
              <KeyRound size={14} /> App Password Guide
            </button>

            {/* Add Sender Account */}
            <button
              onClick={() => { setActiveTab('accounts'); setShowAddAccount(true); }}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.8rem' }}
            >
              <Plus size={14} /> Add Sender Account
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div style={{ background: '#121929', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 1.5rem' }}>
          {[
            { id: 'sheet_studio', label: 'Excel & Sheet Studio', icon: FileSpreadsheet, badge: sheetData?.total_tabs ? `${sheetData.total_tabs} Tabs` : null, highlight: true },
            { id: 'dashboard', label: 'Dashboard & Reports', icon: BarChart3 },
            { id: 'dispatch', label: 'Live Dispatch Console', icon: Send, pulse: dispatchStatus.running },
            { id: 'templates', label: 'Templates Studio', icon: FileText, count: templates.length },
            { id: 'accounts', label: 'Sender Accounts (Switcher)', icon: Settings, count: accounts.length }
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
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  background: active ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  color: active ? '#60a5fa' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && <span className="badge badge-emerald" style={{ fontSize: '0.675rem', padding: '0.1rem 0.4rem' }}>{tab.badge}</span>}
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

      {/* Main Content Area */}
      <main className="container" style={{ flex: 1, padding: '2rem 1.5rem' }}>

        {/* ============================================================ */}
        {/* 1. EXCEL & SPREADSHEET STUDIO (Multi-Tab Interactive Viewer) */}
        {/* ============================================================ */}
        {activeTab === 'sheet_studio' && (
          <div>
            {/* Top Description & Guide Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet color="#38bdf8" /> Multi-Tab Sheet Studio &amp; Auto-Reader
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Paste any Google Spreadsheet link (View or Edit mode) or drag &amp; drop Excel (.xlsx, .xls, .csv). Each tab is separated into its own table with 1-click one-by-one outreach!
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowHowToShareModal(true)} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                  <HelpCircle size={14} /> How to Share Google Sheet
                </button>
                <button onClick={() => setShowAppPasswordGuide(true)} className="btn btn-outline" style={{ fontSize: '0.8rem', borderColor: '#f59e0b', color: '#fbbf24' }}>
                  <KeyRound size={14} /> App Password Steps
                </button>
              </div>
            </div>

            {/* Input Box: Google Sheet URL & File Upload */}
            <div className="glass-card" style={{ marginBottom: '1.5rem', background: '#131b2e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
                {/* Google Sheet URL Input */}
                <div>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <LinkIcon size={14} color="#38bdf8" /> Google Spreadsheet URL (View or Edit Mode)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input-field"
                      placeholder="https://docs.google.com/spreadsheets/d/1vl5moxgRvXo.../edit#gid=0"
                      value={sheetUrl}
                      onChange={e => setSheetUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') loadGoogleSheetUrl(); }}
                    />
                    <button
                      onClick={() => loadGoogleSheetUrl()}
                      disabled={sheetLoading}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <RefreshCw size={15} className={sheetLoading ? 'spin' : ''} />
                      {sheetLoading ? 'Loading...' : 'Load Tabs'}
                    </button>
                  </div>
                </div>

                {/* Local File Upload */}
                <div>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={14} color="#10b981" /> Or Upload Local Excel / CSV File (.xlsx, .xls, .csv)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'border-color 0.2s',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <Upload size={16} color="#38bdf8" />
                    <span>Click or Drag &amp; Drop Excel file here to parse all tabs</span>
                  </div>
                </div>
              </div>

              {sheetError && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  <span>{sheetError}</span>
                  <button onClick={() => setShowHowToShareModal(true)} style={{ background: 'none', border: 'none', color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem' }}>
                    View sharing steps
                  </button>
                </div>
              )}
            </div>

            {/* Multi-Tab Viewer */}
            {sheetData && sheetData.tabs && sheetData.tabs.length > 0 ? (
              <div>
                {/* Sheet Tabs Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', maxWidth: '100%' }}>
                    {sheetData.tabs.map((tab, idx) => {
                      const isActive = activeSheetTabIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveSheetTabIdx(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            background: isActive ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#162032',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            border: isActive ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                            boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <FileSpreadsheet size={15} />
                          <span>{tab.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '12px', background: isActive ? 'rgba(255,255,255,0.25)' : '#0f172a', color: '#fff' }}>
                            {tab.row_count} rows
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Send Mail & Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setDispatchScope('current_tab');
                        setDispatchModalOpen(true);
                      }}
                      className="btn btn-success"
                      style={{ boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
                    >
                      <Send size={16} /> Send Mail to this Tab ({activeTabObj?.row_count || 0})
                    </button>
                    <button
                      onClick={() => {
                        setDispatchScope('all_tabs');
                        setDispatchModalOpen(true);
                      }}
                      className="btn btn-primary"
                    >
                      <Layers size={16} /> Send to ALL Tabs ({sheetData.tabs.reduce((acc, t) => acc + t.row_count, 0)})
                    </button>
                  </div>
                </div>

                {/* Active Tab Information Bar */}
                <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1rem', background: '#101726', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff' }}>
                      Tab: {activeTabObj?.name}
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                      Total Records: <strong style={{ color: '#38bdf8' }}>{activeTabObj?.row_count}</strong>
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                      Detected Email Column: <strong style={{ color: '#34d399' }}>{activeTabObj?.detected_columns?.email || 'Not Detected'}</strong>
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                      Detected Name Column: <strong style={{ color: '#fbbf24' }}>{activeTabObj?.detected_columns?.name || 'Not Detected'}</strong>
                    </span>
                  </div>

                  {/* Search Filter in Tab */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      className="input-field"
                      style={{ padding: '0.35rem 0.65rem', width: '220px', fontSize: '0.8rem' }}
                      placeholder="Filter tab records..."
                      value={sheetSearchQuery}
                      onChange={e => setSheetSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Table Data View */}
                <div className="data-table-container" style={{ maxHeight: '550px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        {activeTabObj?.headers.map((h, i) => (
                          <th key={i}>
                            {h}
                            {h === activeTabObj.detected_columns?.email && <span className="badge badge-emerald" style={{ marginLeft: '0.3rem', fontSize: '0.65rem' }}>Email</span>}
                            {h === activeTabObj.detected_columns?.name && <span className="badge badge-amber" style={{ marginLeft: '0.3rem', fontSize: '0.65rem' }}>Name</span>}
                            {h === activeTabObj.detected_columns?.company && <span className="badge badge-blue" style={{ marginLeft: '0.3rem', fontSize: '0.65rem' }}>Company</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length > 0 ? (
                        filteredRows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{rowIdx + 1}</td>
                            {activeTabObj.headers.map((h, colIdx) => {
                              const val = row[h] || '';
                              const isEmail = h === activeTabObj.detected_columns?.email;
                              return (
                                <td key={colIdx} style={{ fontFamily: isEmail ? 'monospace' : 'inherit', color: isEmail ? '#38bdf8' : 'inherit' }}>
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={activeTabObj?.headers.length + 1 || 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No matching records found in this tab.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#0e1422' }}>
                <FileSpreadsheet size={48} color="#3b82f6" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Spreadsheet Loaded Yet</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                  Paste a Google Spreadsheet link above or upload an Excel file to view all tabs and dispatch cold outreach directly.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <button onClick={() => loadGoogleSheetUrl()} className="btn btn-primary">
                    Load Demo Google Sheet
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn btn-outline">
                    <Upload size={14} /> Upload .xlsx File
                  </button>
                </div>
              </div>
            )}

            {/* SEND OUTREACH MODAL */}
            {dispatchModalOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '560px', background: '#121a2d', border: '1px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Send size={18} color="#10b981" /> One-by-One Cold Outreach Dispatch
                    </h2>
                    <button onClick={() => setDispatchModalOpen(false)} className="btn btn-outline" style={{ padding: '0.35rem' }}>
                      <XCircle size={18} />
                    </button>
                  </div>

                  <div style={{ background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target Scope:</span>
                      <strong style={{ color: '#fff' }}>
                        {dispatchScope === 'current_tab' ? `Current Tab: ${activeTabObj?.name}` : 'All Tabs in Workbook'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Recipients Count:</span>
                      <strong style={{ color: '#34d399' }}>
                        {dispatchScope === 'current_tab' ? activeTabObj?.row_count : sheetData.tabs.reduce((a, b) => a + b.row_count, 0)} leads
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Zero-Bounce Verification:</span>
                      <span className="badge badge-emerald"><CheckCircle2 size={12} /> Live DNS MX Check Active</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Select Sender Account</label>
                    <select
                      className="input-field"
                      value={dispatchConfig.account_id}
                      onChange={e => setDispatchConfig({ ...dispatchConfig, account_id: e.target.value })}
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email}) {a.is_default ? '★ Active Sender' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Select Email Template</label>
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
                      min="2"
                      max="15"
                      step="1"
                      className="input-field"
                      value={dispatchConfig.delay_seconds}
                      onChange={e => setDispatchConfig({ ...dispatchConfig, delay_seconds: e.target.value })}
                    />
                    <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      Sends emails one-by-one with human-like throttling to protect your account reputation.
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button onClick={() => setDispatchModalOpen(false)} className="btn btn-outline">Cancel</button>
                    <button onClick={launchDispatchForSheet} className="btn btn-success" style={{ padding: '0.65rem 1.5rem' }}>
                      <Play size={16} /> Start One-by-One Dispatch
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. DASHBOARD & FINAL DELIVERY REPORT                         */}
        {/* ============================================================ */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery Analytics &amp; Campaign Report</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Complete breakdown of sent, delivered, bounced, and skipped emails across all campaigns.
              </p>
            </div>

            {/* 4 Core Stat Cards: Sent, Delivered, Bounced, Skipped */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>TOTAL DELIVERED</span>
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#10b981' }}>
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
                  {stats.delivered_count || stats.dispatched_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.35rem' }}>
                  Accepted by destination mail servers
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>BOUNCED EMAILS</span>
                  <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#f43f5e' }}>
                    <XCircle size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fb7185' }}>
                  {stats.bounced_count || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: stats.bounced_count === 0 ? '#34d399' : '#fb7185', marginTop: '0.35rem' }}>
                  {stats.bounced_count === 0 ? '0% Bounce Rate (Protected)' : 'Failed delivery'}
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>SKIPPED / PROTECTED</span>
                  <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#f59e0b' }}>
                    <ShieldCheck size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24' }}>
                  {stats.skipped_count || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.35rem' }}>
                  Skipped due to dead MX or duplicates
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>ACTIVE SENDER MAIL</span>
                  <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#3b82f6' }}>
                    <Mail size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', wordBreak: 'break-all' }}>
                  {stats.default_sender}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.35rem' }}>
                  Change anytime via Sender Accounts
                </div>
              </div>
            </div>

            {/* Final Dispatch Summary Report Card (if recent campaign executed) */}
            {dispatchSummaryReport && (
              <div className="glass-card" style={{ marginBottom: '2rem', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={20} /> Latest Campaign Completion Summary
                  </h3>
                  <span className="badge badge-emerald">Dispatched Successfully</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ background: '#0e1524', padding: '1rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL PROCESSED</span>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{dispatchSummaryReport.total}</p>
                  </div>
                  <div style={{ background: '#0e1524', padding: '1rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SENT / DELIVERED</span>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{dispatchSummaryReport.delivered}</p>
                  </div>
                  <div style={{ background: '#0e1524', padding: '1rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SKIPPED</span>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{dispatchSummaryReport.skipped}</p>
                  </div>
                  <div style={{ background: '#0e1524', padding: '1rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BOUNCED</span>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fb7185' }}>{dispatchSummaryReport.bounced}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Navigation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet size={18} color="#38bdf8" /> Open Multi-Tab Sheet Studio
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Load any Google Sheet or local Excel file. All tabs appear on screen in tables ready for instant sending.
                </p>
                <button onClick={() => setActiveTab('sheet_studio')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                  Launch Sheet Studio <ArrowRight size={14} />
                </button>
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Send size={18} color="#10b981" /> Real-Time Dispatch Terminal
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Watch one-by-one sending live with human-like delays, delivery logs, and connection retry monitors.
                </p>
                <button onClick={() => setActiveTab('dispatch')} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                  Open Dispatch Console <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. LIVE DISPATCH CONSOLE                                     */}
        {/* ============================================================ */}
        {activeTab === 'dispatch' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Live Dispatch Console</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Emails are dispatched one-by-one with configurable delays and automatic reconnection resilience.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Progress Summary Card */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Sending Progress (One-by-One)</span>
                  {dispatchStatus.running && <span className="badge badge-emerald">Active Sending</span>}
                </h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                    <span>Processed:</span>
                    <span>{dispatchStatus.sent} / {dispatchStatus.total || 0} ({dispatchStatus.total ? Math.round((dispatchStatus.sent / dispatchStatus.total) * 100) : 0}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#0e1422', borderRadius: '5px', overflow: 'hidden' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: '#111827', padding: '0.75rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>DELIVERED</span>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>{dispatchStatus.delivered || dispatchStatus.sent}</p>
                  </div>
                  <div style={{ background: '#111827', padding: '0.75rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SKIPPED</span>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>{dispatchStatus.skipped}</p>
                  </div>
                  <div style={{ background: '#111827', padding: '0.75rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>BOUNCED</span>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fb7185' }}>{dispatchStatus.bounced || 0}</p>
                  </div>
                  <div style={{ background: '#111827', padding: '0.75rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>FAILED</span>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>{dispatchStatus.failed}</p>
                  </div>
                </div>
              </div>

              {/* Status Details Card */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>Active Session Details</h3>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div><strong>Current Task:</strong> <span style={{ color: '#38bdf8' }}>{dispatchStatus.current || 'Idle'}</span></div>
                  <div><strong>Sender:</strong> <span style={{ fontFamily: 'monospace' }}>{accounts.find(a => a.id === dispatchConfig.account_id)?.email || accounts.find(a => a.is_default)?.email}</span></div>
                  <div><strong>Delay Throttle:</strong> {dispatchConfig.delay_seconds} seconds per recipient</div>
                  <div style={{ marginTop: '0.5rem' }}>
                    {dispatchStatus.running ? (
                      <button onClick={async () => { await fetch(`${API_BASE}/dispatch/stop`, { method: 'POST' }); }} className="btn btn-danger" style={{ width: '100%' }}>
                        <Square size={16} /> Stop Active Dispatch
                      </button>
                    ) : (
                      <button onClick={() => setActiveTab('sheet_studio')} className="btn btn-primary" style={{ width: '100%' }}>
                        <FileSpreadsheet size={16} /> Choose Tab to Send From Sheet Studio
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Console Logs */}
            <div className="glass-card" style={{ background: '#0a0e17' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  ONE-BY-ONE DISPATCH LIVE LOGS
                </span>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Real-time streaming</span>
              </div>
              <div
                style={{
                  height: '280px',
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
                  <p style={{ color: 'var(--text-muted)' }}>[READY] No dispatch session running. Select a tab in Sheet Studio and click "Send Mail" to start.</p>
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

        {/* ============================================================ */}
        {/* 4. TEMPLATES STUDIO                                          */}
        {/* ============================================================ */}
        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Templates Studio</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Universal template engine: Use any template for any outreach, with full variable replacement.
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
                    fontWeight: selectedTemplate?.id === t.id ? 700 : 400,
                    background: selectedTemplate?.id === t.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(26, 34, 52, 0.7)',
                    border: selectedTemplate?.id === t.id ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    color: selectedTemplate?.id === t.id ? '#60a5fa' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap'
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
                  <label className="input-label">Subject Line</label>
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
                  <label className="input-label">HTML Content (100% Left-Aligned Standard)</label>
                  <textarea
                    className="input-field"
                    rows={12}
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
        {/* 5. SENDER ACCOUNTS (Switcher)                                */}
        {/* ============================================================ */}
        {activeTab === 'accounts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sender Accounts Manager</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Switch your sender email account anytime. Configure multiple accounts with live connection testing.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowAppPasswordGuide(true)} className="btn btn-outline" style={{ borderColor: '#f59e0b', color: '#fbbf24' }}>
                  <KeyRound size={15} /> App Password Guide
                </button>
                <button onClick={() => setShowAddAccount(true)} className="btn btn-primary">
                  <Plus size={16} /> Add New Sender Account
                </button>
              </div>
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
                    <button onClick={async () => {
                      if (window.confirm("Remove this account?")) {
                        await fetch(`${API_BASE}/accounts/${acc.id}`, { method: 'DELETE' });
                        fetchData();
                      }
                    }} className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>Host: <strong style={{ color: '#fff' }}>{acc.smtp_host}</strong></div>
                    <div>Port: <strong style={{ color: '#fff' }}>{acc.smtp_port}</strong></div>
                    <div>User: <strong style={{ color: '#fff' }}>{acc.smtp_user}</strong></div>
                    <div>Security: <strong style={{ color: '#fff' }}>{acc.secure ? 'SSL' : 'STARTTLS'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {!acc.is_default && (
                      <button onClick={() => setDefaultAccount(acc.id)} className="btn btn-success" style={{ flex: 1, fontSize: '0.8rem' }}>
                        Set as Active Sender
                      </button>
                    )}
                    <button className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
                      <CheckCircle2 size={14} /> Connected
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Account Modal */}
            {showAddAccount && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
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
                        placeholder="e.g. Marketing Lead / Outreach Specialist"
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
                        placeholder="user@gmail.com or contact@domain.com"
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label className="input-label" style={{ margin: 0 }}>SMTP App Password / Secret</label>
                        <button
                          type="button"
                          onClick={() => setShowAppPasswordGuide(true)}
                          style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          Need help getting App Password?
                        </button>
                      </div>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="16-character Google App Password"
                        value={accountForm.smtp_pass}
                        onChange={e => setAccountForm({ ...accountForm, smtp_pass: e.target.value })}
                        required
                      />
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
                        <button type="submit" className="btn btn-primary">Save &amp; Connect</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* HOW TO GET GMAIL APP PASSWORD GUIDE MODAL                    */}
      {/* ============================================================ */}
      {showAppPasswordGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '1.5rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', background: '#121829', border: '1px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} /> How to Generate Gmail / Workspace App Password
              </h2>
              <button onClick={() => setShowAppPasswordGuide(false)} className="btn btn-outline" style={{ padding: '0.35rem' }}>
                <XCircle size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              Google requires a 16-character App Password to send emails via SMTP securely without exposing your main Google Account password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                {
                  step: 1,
                  title: "Turn ON 2-Step Verification",
                  desc: "Go to your Google Account > Security. Make sure '2-Step Verification' is turned ON (required by Google to enable App Passwords)."
                },
                {
                  step: 2,
                  title: "Open App Passwords Page",
                  desc: "Search for 'App passwords' in Google Account Security search bar, or visit direct link: myaccount.google.com/apppasswords"
                },
                {
                  step: 3,
                  title: "Create App Password",
                  desc: "Enter 'OmniReach' or 'Cold Email' as the App Name, and click the 'Create' button."
                },
                {
                  step: 4,
                  title: "Copy the 16-Character Code",
                  desc: "Google will display a yellow box with a 16-letter code (e.g. 'qfea nsqq iwvc pojz'). Copy this code without spaces into OmniReach!"
                }
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: '0.85rem', background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f59e0b', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0 }}>
                    {item.step}
                  </div>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '0.2rem' }}>{item.title}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', color: '#38bdf8', borderColor: '#38bdf8', textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Open Google App Passwords Page
              </a>
              <button onClick={() => setShowAppPasswordGuide(false)} className="btn btn-primary">
                Got it, Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* HOW TO SHARE GOOGLE SHEET MODAL                              */}
      {/* ============================================================ */}
      {showHowToShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '1.5rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '620px', background: '#121829', border: '1px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={20} /> How to Share Your Google Sheet Link
              </h2>
              <button onClick={() => setShowHowToShareModal(false)} className="btn btn-outline" style={{ padding: '0.35rem' }}>
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>
                  Step 1: Click the Share button
                </strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  Open your Google Sheet and click the big green <strong>Share</strong> button in the top right corner.
                </p>
              </div>

              <div style={{ background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>
                  Step 2: Change General Access to "Anyone with the link"
                </strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  Under <em>General Access</em>, change <strong>Restricted</strong> to <strong>Anyone with the link</strong> (either Viewer or Editor).
                </p>
              </div>

              <div style={{ background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>
                  Step 3: Copy and Paste the link
                </strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  Click <strong>Copy link</strong> and paste it directly into the <em>Google Spreadsheet URL</em> box in OmniReach Sheet Studio!
                </p>
              </div>

              <div style={{ background: '#0a0f1b', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#34d399', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>
                  Alternative: Download Excel file (.xlsx)
                </strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  You can also click <em>File &gt; Download &gt; Microsoft Excel (.xlsx)</em> and drag &amp; drop the file directly into OmniReach.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHowToShareModal(false)} className="btn btn-primary">
                Got it, Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem 0', background: '#090d16', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>OmniReach Engine • Open Source Multi-Tab Cold Email Platform</div>
          <div>Built with React.js, Node.js &amp; Python • Zero-Bounce DNS Verification</div>
        </div>
      </footer>
    </div>
  );
}
