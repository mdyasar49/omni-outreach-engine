# 🚀 OmniReach Engine — Open Source Cold Email & Outreach Automation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61dafb.svg)](client)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933.svg)](server)
[![Verification Engine](https://img.shields.io/badge/Core%20Engine-Python%203-3776ab.svg)](python_engine)
[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-f38020.svg)](https://omni-reach-engine.pages.dev)

> **OmniReach Engine** is a modern, modular, open-source cold outreach and email automation platform built with **React.js**, **Node.js (Express)**, and **Python**. It features live authoritative DNS MX record verification to prevent bounces, dynamic multi-account sender switching, universal customizable templates, and flexible recipient management.

---

## 🌟 Key Features

### 1. 🔄 Dynamic Email Sender Account Switcher
- Connect multiple email accounts (Gmail, Google Workspace, Microsoft Outlook, or any custom SMTP/IMAP server).
- **1-Click Active Sender Switcher**: Change the sender address anytime without editing code or restarting services.
- Built-in SMTP connection tester with live authentication feedback.

### 2. 🛡️ Pre-Flight DNS MX Verification (Zero-Bounce Guarantee)
- Multi-threaded DNS MX resolution queries authoritative name servers for every recipient's domain prior to dispatch.
- Filters out non-existent domains, dead mail servers, and malformed addresses.
- Protects your domain reputation and prevents blacklisting or spam flags.

### 3. 📝 Universal Template Studio (Any Template)
- Fully open-source template engine — build and customize templates for **any** industry, offer, or agency.
- Dynamic variable interpolation: `{{name}}`, `{{company}}`, `{{city}}`, `{{email}}`, `{{sender_name}}`, `{{sender_email}}`.
- 100% left-aligned HTML compliance ensures natural readability across mobile and desktop clients without awkward center-containers.

### 4. 👥 Flexible Recipient Management (Any To-Address)
- Support for any recipient list: import CSV, paste comma-separated text, or connect custom databases.
- Live badge statuses: `MX Verified`, `Dead Domain`, `Unverified`.

### 5. 🚀 Real-Time Dispatch Console
- Auto-reconnect retry logic to handle long batches without SMTP disconnections.
- Configurable throttle delay slider (1s - 30s) to simulate human sending patterns.
- Real-time progress bar, delivery counters (Sent / Skipped / Failed), and live streaming console logs.

### 6. ☁️ Cloudflare Pages & Workers Ready
- Optimized for instantaneous global delivery on Cloudflare's edge network.
- Live Demo: [https://omni-reach-engine.pages.dev](https://omni-reach-engine.pages.dev)

---

## 🏗️ Architecture

```
omni-reach-engine/
├── client/                 # React 18 + Vite + Lucide Icons (Cloudflare Pages)
│   ├── src/
│   │   ├── App.jsx         # Dashboard, Account Switcher, Template Studio, Dispatch Console
│   │   └── index.css       # Premium Dark-Theme Glassmorphism Design System
│   └── package.json
├── server/                 # Node.js + Express REST API Server
│   ├── server.js           # Account CRUD, Template Engine, MX Bridge, Dispatch Controller
│   ├── data/               # Persistent JSON Store (Accounts, Templates, Recipients)
│   └── package.json
├── python_engine/          # High-Performance Verification & Delivery Engine
│   ├── mx_verifier.py      # Multi-threaded Authoritative DNS MX Verifier
│   ├── send_engine.py      # Resilient SMTP Dispatcher with IMAP Sent Sync
│   └── auto_reply_listener.py # IMAP Inbox Listener (Bounce, Out-of-Office & Colleague Extractor)
├── docker-compose.yml      # 1-Click Containerized Deployment
├── Dockerfile              # Backend & Python Engine Container
└── README.md
```

---

## ⚡ Quickstart Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v20)
- **Python**: v3.10+
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/mdyasar49/omni-outreach-engine.git
cd omni-outreach-engine
```

### 2. Setup the Python Engine
```bash
cd python_engine
pip install -r requirements.txt
# Requires: dnspython
cd ..
```

### 3. Start the Backend API Server
```bash
cd server
npm install
npm start
# Runs on http://localhost:4000
```

### 4. Start the React Frontend
```bash
cd ../client
npm install
npm run dev
# Open http://localhost:5173
```

---

## 🐳 Docker Deployment

Run the complete stack in a single command using Docker:

```bash
docker-compose up --build -d
```

---

## 🔒 Gmail App Password Setup

If connecting a Gmail or Google Workspace account:
1. Enable **2-Step Verification** on your Google Account.
2. Go to **Security > 2-Step Verification > App Passwords**.
3. Create a new App Password named `OmniReach`.
4. Copy the generated 16-character code into the **Sender Accounts** tab in OmniReach.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free for personal, commercial, and open-source use.
