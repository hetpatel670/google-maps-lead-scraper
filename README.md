# Google Maps B2B Lead Scraper (by BizGuides Agency)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)](manifest.json)
[![Built by BizGuides Agency](https://img.shields.io/badge/Built%20by-BizGuides%20Agency-purple.svg)](https://github.com/hetpatel670/google-maps-lead-scraper)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/hetpatel670/google-maps-lead-scraper)

A free, fast, and open-source Google Chrome Extension (Manifest V3) engineered to extract **1,000+ verified B2B leads** directly from Google Maps with automated multi-city expansion, no-website prospect filtering, and AI-powered sales pitch generation.

Built and open-sourced by **BizGuides Agency**.

---

## 🏢 About BizGuides Agency

**BizGuides** is a digital growth & B2B client acquisition agency specializing in:
- 🎯 **Automated Outbound Lead Infrastructure**: Building scalable cold email, LinkedIn, and cold calling acquisition funnels.
- 🌐 **High-Converting Web Development**: Modern, high-speed websites designed for local businesses and enterprise service providers.
- ⚡ **Custom Growth Tools & Automation**: Developing proprietary scrapers, CRM integrations, and sales intelligence software.

We created and open-sourced this **Google Maps B2B Lead Scraper** to give agencies, founders, freelancers, and sales teams access to enterprise-grade lead generation software without expensive monthly subscription fees or scraping credits.

---

## 🚀 Key Features

- ⚡ **1,000+ Bulk Lead Extraction**: Seamlessly extract 50, 250, 500, or 1,000+ leads in a single automated session.
- 🔴 **"No-Website" Lead Finder**: Instantly isolate local businesses operating without a website—the highest-converting target for web design, SEO, and digital marketing agencies.
- 📍 **Multi-City Automated Expansion**:
  - Automatically expands broad regional queries (e.g., `"scrape 1000 dentists in usa"` or `"haulage companies in Australia"`) across high-density metro and regional city sequences.
  - Automatically transitions between cities without interrupting your extraction session.
- 🎯 **Interactive Decision Modal**:
  - If a city exhausts all visible business listings on Google Maps before hitting your target lead count, the extension prompts you with nearby cities or related commercial niches to continue extracting effortlessly.
- 🧠 **AI Cold Outreach Pitch Hooks (Optional)**:
  - Connect your free Google Gemini API key to generate customized 1-sentence sales pitch hooks tailored to each business's category and online presence.
- 🔒 **Privacy First & Formula Injection Safe (CWE-1236)**:
  - Zero external telemetry; 100% of data stays locally on your device.
  - Exported CSVs are sanitized against spreadsheet formula injection attacks.
- 📊 **One-Click RFC-4180 CSV Export**: Standard UTF-8 BOM CSV ready for Excel, Google Sheets, Apollo, Instantly, Smartlead, Lemlist, or any CRM.

---

## 📖 Step-by-Step User Guide

### Step 1: Installation & Setup

1. **Clone or Download this Repository**:
   ```bash
   git clone https://github.com/hetpatel670/google-maps-lead-scraper.git
   ```
   *(Or download and extract the ZIP archive).*

2. **Open Chrome Extensions Manager**:
   - Open Google Chrome and enter `chrome://extensions` in your address bar.
   - In the top-right corner, toggle on **Developer mode**.

3. **Load the Extension**:
   - Click **Load unpacked** in the top-left corner.
   - Select the `google-maps-lead-scraper` (or `EXTENSION`) folder.
   - Click the **Extensions puzzle icon** in your Chrome toolbar and **pin Google Maps Lead Scraper** for quick access.

---

### Step 2: Open Google Maps & Launch Side Panel

1. Navigate to [Google Maps](https://www.google.com/maps).
2. Click the **Google Maps Lead Scraper (by BizGuides)** icon in your Chrome toolbar to open the side panel dashboard.
3. The dashboard will automatically connect and sync with your active Google Maps tab.

---

### Step 3: Configure Target Goals & Extraction

1. **Enter your Search Prompt**:
   - Specific query: `roofing contractors in Derby, KS` or `haulage company Wagga Wagga`
   - Bulk query: `scrape 1000 dentists in usa` or `plumbers in texas`
2. **Set your Target "No Website" Leads**:
   - Specify your desired minimum goal of businesses with no website (e.g., `25` or `100`).
3. **Set Max Total Leads**:
   - Specify a maximum limit of total leads to collect (e.g., `1000`).
4. *(Optional)* **Add Gemini API Key in Settings**:
   - Click the **⚙️ Settings** icon in the header.
   - Paste your free [Google Gemini API Key](https://aistudio.google.com/app/apikey).
   - Adjust extraction pacing speed (Turbo 0.3s, Fast 0.5s, or Balanced 1.0s).
5. Click **Start Lead Extraction**!

---

### Step 4: Live Extraction & Interactive Decision Modal

- **Live Progress**: Watch the live status badge, progress bar, and metrics (Total Scanned, 🔴 No Website, 🌐 Has Website, 📞 Has Phone) update in real-time.
- **Background Detail Scraping**: The extension opens ultra-fast background tabs (<100ms) to scrape full phone numbers, addresses, categories, ratings, reviews, and website URLs without interrupting your browsing.
- **Feed Exhaustion & Decision Modal**:
  - When a city has no more businesses to display on Google Maps, the extension checks if your "No Website" lead goal was met.
  - If more leads are needed, the **Interactive Decision Modal** prompts you with 3 intelligent choices:
    - 📍 **Option 1: Search Nearby Cities** (maintains your niche and transitions to neighboring towns).
    - 💼 **Option 2: Search Related Niches in Same City** (maintains the city and explores related sub-industries).
    - ✅ **Option 3: Complete Extraction** (finalize and keep all current leads).

---

### Step 5: Filter, Review & Export Leads

1. **Filter Tabs**: Toggle between **All**, **🔴 No Website**, **🌐 Has Website**, and **📞 Has Phone**.
2. **Search / Table Filter**: Filter leads instantly by business name, phone number, city, or niche.
3. **Inspect Lead Details**: Click on any row to open the **Lead Detail Modal** with full metadata, Google Maps links, and personalized AI cold outreach hooks.
4. **Copy Outreach Script**: Click **📋 Copy Pitch** to copy the cold email/call pitch directly to your clipboard.
5. **Download CSV**: Click **CSV** in the results toolbar to download your formatted prospect list.

---

## 📁 Directory Structure

```text
google-maps-lead-scraper
├── manifest.json                  # Manifest V3 configuration with Side Panel, tabs & storage
├── background/
│   └── service-worker.js          # Fast background tab extraction & tab navigator
├── utils/
│   ├── location-matrix.js         # Multi-city expansion matrix & Gemini AI parser
│   ├── normalization.js           # Text, phone, URL, and address normalization
│   ├── deduplication.js           # Cross-query duplicate prevention engine
│   └── logger.js                  # Namespaced console logger with credential masking
├── content/
│   ├── maps-detector.js           # Google Maps feed DOM detector & search controller
│   ├── website-detector.js        # Strict website validator & directory exclusion filter
│   ├── result-parser.js           # Multi-selector business detail parser
│   └── maps-extractor.js          # Multi-location 1,000+ lead scrolling & extraction loop
├── sidepanel/
│   ├── index.html                 # SaaS side panel dashboard UI (with BizGuides Agency branding)
│   ├── styles.css                 # Modern dark/light theme styles
│   └── app.js                     # Side panel reactive controller & state sync
├── storage/
│   └── storage-manager.js         # Chrome storage wrapper for leads, jobs, and settings
├── export/
│   └── csv-exporter.js            # RFC-4180 CSV exporter with formula injection protection
├── assets/
│   └── icons/                     # Extension icons (16px, 32px, 48px, 128px, 256px, logo)
├── LICENSE                        # Open-source MIT License
├── SECURITY.md                    # Vulnerability disclosure policy
├── .gitignore                     # Git ignore rules
└── README.md                      # Complete documentation & user guide
```

---

## 🔒 Security & Privacy Architecture

- **Zero Third-Party Telemetry**: No tracking, analytics, or external telemetry servers.
- **Client-Side Storage**: Gemini API keys and leads are stored exclusively in sandboxed `chrome.storage.local`.
- **Header-Based Authentication**: AI calls transmit keys securely via HTTP headers rather than query strings.
- **Anti-Formula Injection (CWE-1236)**: Protects against spreadsheet DDE/formula execution when opening CSV files in Excel or LibreOffice.
- **Minimal Permissions**: The extension only requests host permissions for Google Maps and Google's official Gemini endpoint.

---

## ❓ Troubleshooting & FAQ

<details>
<summary><strong>Q: Google Maps shows a CAPTCHA / verification check?</strong></summary>
The extension automatically detects access verification screens, pauses extraction, and displays a safety banner. Simply solve the CAPTCHA in the Google Maps tab, and click <strong>Resume</strong>.
</details>

<details>
<summary><strong>Q: Do I need a Gemini API key to use this tool?</strong></summary>
No! Gemini API is completely optional. The extension includes built-in offline geographic location matrices, niche suggestions, and deterministic sales pitch generators that work 100% offline without any API key.
</details>

<details>
<summary><strong>Q: How do I reset and start a fresh list?</strong></summary>
Click the <strong>New Session</strong> button in the header or results toolbar to clear saved leads and start fresh from 0.
</details>

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please review our [SECURITY.md](SECURITY.md) for vulnerability disclosure guidelines.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

**Built with ❤️ by BizGuides Agency**
