/**
 * BizGuides - Side Panel Application Controller
 * Handles UI interactions, live progress updates for 1,000+ lead bulk scraping,
 * natural language prompt submission, B2B lead filtering, and CSV exports.
 */

(function () {
  const { storage, csvExporter, Logger } = window.LeadFinder || {};
  const logger = new Logger('BizGuides');

  // Application State
  const state = {
    isMapsActive: false,
    activeTabId: null,
    searchQuery: '',
    masterNiche: '',
    masterCity: '',
    detectedCount: 0,
    activeFilter: 'ALL', // 'ALL' | 'NO_WEBSITE' | 'HAS_WEBSITE' | 'HAS_PHONE'
    tableSearchTerm: '',
    leads: [],
    currentDecisionData: null,
    currentJob: {
      status: 'IDLE',
      processed: 0,
      totalFound: 0,
      noWebsite: 0,
      hasWebsite: 0,
      hasPhone: 0,
      errors: 0,
      minNoWebsiteTarget: 25,
      currentBusiness: '',
      currentCity: ''
    },
    settings: {
      maxBusinesses: 1000,
      minNoWebsiteTarget: 25,
      autoSave: true,
      delayBetweenClicks: 500,
      geminiApiKey: ''
    }
  };

  // DOM Elements
  const elements = {
    btnHeaderNewSession: document.getElementById('btnHeaderNewSession'),
    btnHeaderRefresh: document.getElementById('btnHeaderRefresh'),
    toastNotification: document.getElementById('toastNotification'),
    toastText: document.getElementById('toastText'),
    bannerNotMaps: document.getElementById('bannerNotMaps'),
    bannerSecurity: document.getElementById('bannerSecurity'),
    securityMessage: document.getElementById('securityMessage'),
    btnOpenMaps: document.getElementById('btnOpenMaps'),
    badgeDetectionStatus: document.getElementById('badgeDetectionStatus'),
    inputSearchQuery: document.getElementById('inputSearchQuery'),
    lblBusinessesFound: document.getElementById('lblBusinessesFound'),
    btnNewSession: document.getElementById('btnNewSession'),
    btnRefreshContext: document.getElementById('btnRefreshContext'),
    inputMinNoWebsite: document.getElementById('inputMinNoWebsite'),
    inputMaxBusinesses: document.getElementById('inputMaxBusinesses'),
    btnStartExtraction: document.getElementById('btnStartExtraction'),
    sectionStatus: document.getElementById('sectionStatus'),
    lblExtractionStatusTitle: document.getElementById('lblExtractionStatusTitle'),
    lblCurrentBusiness: document.getElementById('lblCurrentBusiness'),
    btnNewSearch: document.getElementById('btnNewSearch'),
    liveStatusBadge: document.getElementById('liveStatusBadge'),
    progressBarFill: document.getElementById('progressBarFill'),
    lblProgressPercent: document.getElementById('lblProgressPercent'),
    lblProgressCount: document.getElementById('lblProgressCount'),
    metricProcessed: document.getElementById('metricProcessed'),
    metricNoWebsite: document.getElementById('metricNoWebsite'),
    metricHasWebsite: document.getElementById('metricHasWebsite'),
    metricHasPhone: document.getElementById('metricHasPhone'),
    extractionControls: document.getElementById('extractionControls'),
    btnPauseResume: document.getElementById('btnPauseResume'),
    lblPauseResume: document.getElementById('lblPauseResume'),
    btnStopExtraction: document.getElementById('btnStopExtraction'),
    lblTotalLeadsCount: document.getElementById('lblTotalLeadsCount'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    tabCountAll: document.getElementById('tabCountAll'),
    tabCountNoWebsite: document.getElementById('tabCountNoWebsite'),
    tabCountHasWebsite: document.getElementById('tabCountHasWebsite'),
    tabCountHasPhone: document.getElementById('tabCountHasPhone'),
    inputTableSearch: document.getElementById('inputTableSearch'),
    btnToolbarNewSession: document.getElementById('btnToolbarNewSession'),
    btnDownloadCsv: document.getElementById('btnDownloadCsv'),
    btnClearLeads: document.getElementById('btnClearLeads'),
    leadsEmptyState: document.getElementById('leadsEmptyState'),
    leadsTable: document.getElementById('leadsTable'),
    leadsTableBody: document.getElementById('leadsTableBody'),
    leadModal: document.getElementById('leadModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    btnModalClose: document.getElementById('btnModalClose'),
    decisionModal: document.getElementById('decisionModal'),
    decisionTitle: document.getElementById('decisionTitle'),
    decisionFoundCount: document.getElementById('decisionFoundCount'),
    decisionCurrentQuery: document.getElementById('decisionCurrentQuery'),
    decisionNicheText: document.getElementById('decisionNicheText'),
    decisionCityText: document.getElementById('decisionCityText'),
    nearbyCitySuggestions: document.getElementById('nearbyCitySuggestions'),
    relatedNicheSuggestions: document.getElementById('relatedNicheSuggestions'),
    inputCustomCity: document.getElementById('inputCustomCity'),
    btnSubmitCustomCity: document.getElementById('btnSubmitCustomCity'),
    inputCustomNiche: document.getElementById('inputCustomNiche'),
    btnSubmitCustomNiche: document.getElementById('btnSubmitCustomNiche'),
    btnDecisionComplete: document.getElementById('btnDecisionComplete'),
    btnDecisionClose: document.getElementById('btnDecisionClose'),
    decisionCurrentTotal: document.getElementById('decisionCurrentTotal'),
    settingsModal: document.getElementById('settingsModal'),
    btnSettingsToggle: document.getElementById('btnSettingsToggle'),
    btnSettingsClose: document.getElementById('btnSettingsClose'),
    inputGeminiApiKey: document.getElementById('inputGeminiApiKey'),
    settingDelay: document.getElementById('settingDelay'),
    settingAutoSave: document.getElementById('settingAutoSave'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnPurgeAllData: document.getElementById('btnPurgeAllData')
  };

  /**
   * Initialize Side Panel
   */
  async function init() {
    logger.info('Initializing LeadFinder AI Side Panel UI');
    
    await loadInitialData();
    bindEvents();
    await checkActiveTab(false);
    listenForMessages();
    renderUI();
  }

  /**
   * Load data from Chrome storage
   */
  async function loadInitialData() {
    if (!storage) return;

    state.settings = await storage.getSettings();
    state.leads = await storage.getAllLeads();
    const savedJob = await storage.getActiveJob();

    if (savedJob && savedJob.jobId) {
      state.currentJob = savedJob;
      if (savedJob.searchQuery) {
        state.searchQuery = savedJob.searchQuery;
      }
      if (savedJob.niche) {
        state.masterNiche = savedJob.niche;
      }
      if (savedJob.city) {
        state.masterCity = savedJob.city;
      }
    }

    // Populate Settings UI
    if (elements.inputMinNoWebsite) {
      elements.inputMinNoWebsite.value = String(state.settings.minNoWebsiteTarget || 25);
    }
    if (elements.inputMaxBusinesses) {
      elements.inputMaxBusinesses.value = String(state.settings.maxBusinesses || 1000);
    }
    if (elements.inputGeminiApiKey) {
      elements.inputGeminiApiKey.value = state.settings.geminiApiKey || '';
    }
    if (elements.settingDelay) {
      elements.settingDelay.value = String(state.settings.delayBetweenClicks || 500);
    }
    if (elements.settingAutoSave) {
      elements.settingAutoSave.checked = state.settings.autoSave !== false;
    }
  }

  /**
   * Bind event handlers
   */
  function bindEvents() {
    // Header & Context Actions
    if (elements.btnHeaderNewSession) elements.btnHeaderNewSession.addEventListener('click', () => startNewSession(false));
    if (elements.btnHeaderRefresh) elements.btnHeaderRefresh.addEventListener('click', () => refreshSearchContext(true));
    if (elements.btnNewSession) elements.btnNewSession.addEventListener('click', () => startNewSession(false));
    if (elements.btnRefreshContext) elements.btnRefreshContext.addEventListener('click', () => refreshSearchContext(true));
    if (elements.btnToolbarNewSession) elements.btnToolbarNewSession.addEventListener('click', () => startNewSession(false));

    // Open Maps
    if (elements.btnOpenMaps) {
      elements.btnOpenMaps.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.google.com/maps' });
      });
    }

    // Search Input
    if (elements.inputSearchQuery) {
      elements.inputSearchQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          onStartExtraction();
        }
      });
    }

    // Extraction Control Buttons
    if (elements.btnStartExtraction) elements.btnStartExtraction.addEventListener('click', onStartExtraction);
    if (elements.btnPauseResume) elements.btnPauseResume.addEventListener('click', onTogglePauseResume);
    if (elements.btnStopExtraction) elements.btnStopExtraction.addEventListener('click', onStopExtraction);
    if (elements.btnNewSearch) elements.btnNewSearch.addEventListener('click', () => startNewSession(true));

    // Filter Tabs
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const filter = e.currentTarget.dataset.filter;
        switchTab(filter);
      });
    });

    // Table Search Filter
    if (elements.inputTableSearch) {
      elements.inputTableSearch.addEventListener('input', (e) => {
        state.tableSearchTerm = e.target.value.toLowerCase().trim();
        renderLeadsTable();
      });
    }

    // CSV Export & Clear
    if (elements.btnDownloadCsv) elements.btnDownloadCsv.addEventListener('click', onDownloadCsv);
    if (elements.btnClearLeads) elements.btnClearLeads.addEventListener('click', onClearLeads);

    // Modal Close
    if (elements.btnModalClose) {
      elements.btnModalClose.addEventListener('click', () => elements.leadModal.classList.add('hidden'));
    }
    if (elements.leadModal) {
      elements.leadModal.addEventListener('click', (e) => {
        if (e.target === elements.leadModal) elements.leadModal.classList.add('hidden');
      });
    }

    // Decision Modal Events
    if (elements.btnDecisionClose) {
      elements.btnDecisionClose.addEventListener('click', () => {
        elements.decisionModal.classList.add('hidden');
      });
    }
    if (elements.btnDecisionComplete) {
      elements.btnDecisionComplete.addEventListener('click', handleCompleteDecision);
    }
    if (elements.btnSubmitCustomCity) {
      elements.btnSubmitCustomCity.addEventListener('click', handleCustomCity);
    }
    if (elements.inputCustomCity) {
      elements.inputCustomCity.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCustomCity();
      });
    }
    if (elements.btnSubmitCustomNiche) {
      elements.btnSubmitCustomNiche.addEventListener('click', handleCustomNiche);
    }
    if (elements.inputCustomNiche) {
      elements.inputCustomNiche.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCustomNiche();
      });
    }

    // Settings Modal
    if (elements.btnSettingsToggle) {
      elements.btnSettingsToggle.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
    }
    if (elements.btnSettingsClose) {
      elements.btnSettingsClose.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));
    }
    if (elements.settingsModal) {
      elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) elements.settingsModal.classList.add('hidden');
      });
    }
    if (elements.btnSaveSettings) {
      elements.btnSaveSettings.addEventListener('click', onSaveSettings);
    }
    if (elements.btnPurgeAllData) {
      elements.btnPurgeAllData.addEventListener('click', async () => {
        if (confirm('Permanently purge and delete ALL saved leads, logs, and settings from local storage?')) {
          await storage.resetAllData();
          state.leads = [];
          state.settings = await storage.getSettings();
          state.currentJob = {
            status: 'IDLE',
            processed: 0,
            totalFound: 0,
            noWebsite: 0,
            hasWebsite: 0,
            hasPhone: 0,
            errors: 0,
            currentBusiness: 'Ready to scan leads',
            currentCity: ''
          };
          if (elements.inputGeminiApiKey) elements.inputGeminiApiKey.value = '';
          elements.settingsModal.classList.add('hidden');
          renderUI();
          showToast('All local application data purged');
        }
      });
    }
  }

  function showToast(text, durationMs = 2500) {
    if (!elements.toastNotification || !elements.toastText) return;
    elements.toastText.textContent = text;
    elements.toastNotification.classList.remove('hidden');
    setTimeout(() => {
      elements.toastNotification.classList.add('hidden');
    }, durationMs);
  }

  async function refreshSearchContext(showFeedback = true) {
    const icons = document.querySelectorAll('.refresh-icon');
    icons.forEach(ic => ic.classList.add('spin'));
    setTimeout(() => icons.forEach(ic => ic.classList.remove('spin')), 750);

    await checkActiveTab(showFeedback);
  }

  async function startNewSession(autoConfirm = false) {
    if (!autoConfirm && state.leads.length > 0) {
      if (!confirm(`Start a fresh new session? This will clear the ${state.leads.length} previously saved leads.`)) {
        return;
      }
    }

    await storage.clearLeads();
    state.leads = [];
    state.currentJob = {
      status: 'IDLE',
      processed: 0,
      totalFound: 0,
      noWebsite: 0,
      hasWebsite: 0,
      hasPhone: 0,
      errors: 0,
      currentBusiness: 'Ready to scan leads',
      currentCity: ''
    };

    await checkActiveTab(false);
    renderUI();
    showToast('✨ Clean session started! Lead count: 0', 3000);
  }

  /**
   * Locate active Google Maps tab
   */
  async function findActiveMapsTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url && (tabs[0].url.includes('google.com/maps') || tabs[0].url.includes('maps.google.com'))) {
        return tabs[0];
      }
      const allMapsTabs = await chrome.tabs.query({ url: ['*://www.google.com/maps/*', '*://maps.google.com/*'] });
      if (allMapsTabs.length > 0) {
        return allMapsTabs[0];
      }
    } catch {}
    return null;
  }

  /**
   * Self-healing message dispatcher to Google Maps tab
   */
  async function sendToMapsTab(messageData) {
    const tab = await findActiveMapsTab();
    if (!tab || !tab.id) {
      showNotMapsBanner(true);
      return { ok: false, isNotMaps: true, error: 'No Google Maps tab found' };
    }

    state.activeTabId = tab.id;
    state.isMapsActive = true;
    showNotMapsBanner(false);

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, messageData, (response) => {
        if (chrome.runtime?.lastError) {
          logger.warn('Tab script not attached. Injecting scripts dynamically...', chrome.runtime.lastError.message);
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
              'utils/logger.js',
              'utils/normalization.js',
              'utils/deduplication.js',
              'utils/location-matrix.js',
              'storage/storage-manager.js',
              'content/website-detector.js',
              'content/result-parser.js',
              'content/maps-detector.js',
              'content/maps-extractor.js'
            ]
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, messageData, (retryResponse) => {
                if (chrome.runtime?.lastError) {
                  resolve({ ok: false, error: chrome.runtime.lastError.message, needsTabRefresh: true });
                } else {
                  resolve(retryResponse || { ok: true });
                }
              });
            }, 100);
          }).catch((injErr) => {
            resolve({ ok: false, error: injErr.message, needsTabRefresh: true });
          });
        } else {
          resolve(response || { ok: true });
        }
      });
    });
  }

  async function checkActiveTab(showFeedback = false) {
    try {
      const tab = await findActiveMapsTab();
      if (!tab || !tab.url) {
        showNotMapsBanner(true);
        return;
      }

      state.activeTabId = tab.id;
      state.isMapsActive = true;
      showNotMapsBanner(false);

      const response = await sendToMapsTab({ type: 'LEADFINDER_REFRESH_CONTEXT' });
      if (response && response.ok) {
        if (response.searchQuery) {
          state.searchQuery = response.searchQuery;
          elements.inputSearchQuery.value = response.searchQuery;
        }
        state.detectedCount = response.itemsCount || 0;
        elements.lblBusinessesFound.innerHTML = `Businesses in view: <strong>${state.detectedCount}</strong>`;

        if (response.status && response.status !== 'IDLE') {
          state.currentJob.status = response.status;
        } else if (state.currentJob.status === 'COMPLETED' || state.currentJob.status === 'STOPPED') {
          elements.btnNewSearch.classList.remove('hidden');
        }

        renderStatusCard();

        if (showFeedback) {
          showToast(`Refreshed: ${state.searchQuery || 'Google Maps'} (${state.detectedCount} businesses in view)`);
        }
      } else if (response && response.needsTabRefresh) {
        elements.lblBusinessesFound.innerHTML = `<em>Connected (Ready to scan)</em>`;
      }
    } catch (err) {
      logger.warn('Could not query active tab:', err);
    }
  }

  function showNotMapsBanner(show) {
    if (show) {
      elements.bannerNotMaps.classList.remove('hidden');
      elements.badgeDetectionStatus.textContent = 'Disconnected';
      elements.badgeDetectionStatus.className = 'status-pill badge-idle';
    } else {
      elements.bannerNotMaps.classList.add('hidden');
      elements.badgeDetectionStatus.textContent = 'Connected';
      elements.badgeDetectionStatus.className = 'status-pill status-pill-active';
    }
  }

  function listenForMessages() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'LEADFINDER_PROGRESS') {
        const { status, job } = message.payload || {};
        if (job) {
          state.currentJob = { ...state.currentJob, ...job };
          if (status) state.currentJob.status = status;
          renderStatusCard();
          renderMetrics();
          renderFilterCounts();
        }
      } else if (message.type === 'LEADFINDER_LEAD_SAVED') {
        const { lead, job } = message.payload || {};
        if (lead) {
          const existingIdx = state.leads.findIndex(l => l.id === lead.id);
          if (existingIdx >= 0) {
            state.leads[existingIdx] = lead;
          } else {
            state.leads.unshift(lead);
          }
          if (job) state.currentJob = { ...state.currentJob, ...job };
          renderUI();
        }
      } else if (message.type === 'LEADFINDER_TAB_NAVIGATED') {
        checkActiveTab(false);
      } else if (message.type === 'LEADFINDER_TARGET_UNMET') {
        showDecisionModal(message.payload || {});
      }
    });
  }

  /**
   * Start Extraction Action
   */
  async function onStartExtraction() {
    const query = elements.inputSearchQuery.value.trim() || state.searchQuery || 'Google Maps Search';
    const minNoWebsite = parseInt(elements.inputMinNoWebsite?.value, 10) || 25;
    const maxBusinesses = parseInt(elements.inputMaxBusinesses?.value, 10) || 1000;
    const delay = state.settings.delayBetweenClicks || 500;

    // Parse niche & city upfront and store in master state
    if (window.LeadFinder && window.LeadFinder.locationMatrix) {
      const parsed = window.LeadFinder.locationMatrix.parseUserPrompt(query);
      state.masterNiche = parsed.niche || query;
      state.masterCity = parsed.region || parsed.location || (query.includes(' in ') ? query.split(' in ')[1].trim() : '');
    } else {
      const parts = query.split(' in ');
      if (parts.length > 1) {
        state.masterNiche = parts[0].trim();
        state.masterCity = parts[1].trim();
      } else {
        state.masterNiche = query;
        state.masterCity = '';
      }
    }

    const isNew = state.currentJob.status === 'COMPLETED' || 
                  state.currentJob.status === 'STOPPED' || 
                  (state.currentJob.searchQuery && state.currentJob.searchQuery.toLowerCase() !== query.toLowerCase());

    // Reset session for fresh runs if last one completed/stopped or new search
    if (isNew) {
      await storage.clearLeads();
      state.leads = [];
      state.currentJob = {
        status: 'RUNNING',
        processed: 0,
        totalFound: 0,
        noWebsite: 0,
        hasWebsite: 0,
        hasPhone: 0,
        errors: 0,
        minNoWebsiteTarget: minNoWebsite,
        searchQuery: query,
        niche: state.masterNiche,
        city: state.masterCity,
        currentBusiness: 'Initializing lead discovery...',
        currentCity: state.masterCity || query
      };
      renderUI();
    } else {
      state.searchQuery = query;
      state.currentJob.status = 'RUNNING';
      state.currentJob.searchQuery = query;
      state.currentJob.niche = state.masterNiche;
      state.currentJob.city = state.masterCity;
      state.currentJob.minNoWebsiteTarget = minNoWebsite;
      state.currentJob.currentBusiness = 'Scanning leads...';
      renderStatusCard();
    }

    const response = await sendToMapsTab({
      type: 'LEADFINDER_START',
      payload: {
        searchQuery: query,
        niche: state.masterNiche,
        city: state.masterCity,
        minNoWebsiteTarget: minNoWebsite,
        maxBusinesses: maxBusinesses,
        delayBetweenClicks: delay,
        apiKey: state.settings.geminiApiKey || '',
        isNewSession: isNew
      }
    });

    if (!response || !response.ok) {
      if (response && response.needsTabRefresh && state.activeTabId) {
        showToast('Reconnecting tab...', 2000);
        await chrome.tabs.reload(state.activeTabId);
        setTimeout(() => {
          onStartExtraction();
        }, 1500);
      } else {
        logger.warn('Extraction start response:', response);
      }
    }
  }

  async function onTogglePauseResume() {
    const isCurrentlyPaused = state.currentJob.status === 'PAUSED' || state.currentJob.status === 'WAITING_DECISION';
    const msgType = isCurrentlyPaused ? 'LEADFINDER_RESUME' : 'LEADFINDER_PAUSE';

    state.currentJob.status = isCurrentlyPaused ? 'RUNNING' : 'PAUSED';
    renderStatusCard();

    const response = await sendToMapsTab({ type: msgType });
    if (!response || !response.ok) {
      if (isCurrentlyPaused) {
        logger.info('Reconnecting extraction on resume...');
        await onStartExtraction();
      }
    } else {
      showToast(isCurrentlyPaused ? 'Extraction resumed' : 'Extraction paused');
    }
  }

  async function onStopExtraction() {
    const response = await sendToMapsTab({ type: 'LEADFINDER_STOP' });
    if (response && response.ok) {
      state.currentJob.status = 'STOPPED';
      renderStatusCard();
    }
  }

  function onDownloadCsv() {
    const filteredLeads = getFilteredLeads();
    if (filteredLeads.length === 0) {
      alert('No leads match the current filter to export.');
      return;
    }

    const query = state.searchQuery || 'google-maps';
    csvExporter.downloadCsv(filteredLeads, query, state.activeFilter);
    showToast(`Downloaded CSV (${filteredLeads.length} leads)`);
  }

  async function onClearLeads() {
    if (confirm('Are you sure you want to clear all extracted leads?')) {
      await storage.clearLeads();
      state.leads = [];
      state.currentJob = {
        status: 'IDLE',
        processed: 0,
        totalFound: 0,
        noWebsite: 0,
        hasWebsite: 0,
        hasPhone: 0,
        errors: 0,
        currentBusiness: 'Ready to scan leads',
        currentCity: ''
      };
      renderUI();
      showToast('All leads cleared');
    }
  }

  async function onSaveSettings() {
    const apiKey = elements.inputGeminiApiKey.value.trim();
    const delay = parseInt(elements.settingDelay.value, 10) || 500;
    const autoSave = elements.settingAutoSave.checked;

    state.settings = await storage.saveSettings({
      geminiApiKey: apiKey,
      delayBetweenClicks: delay,
      autoSave: autoSave
    });

    elements.settingsModal.classList.add('hidden');
    showToast('Settings saved successfully');
  }

  /**
   * Master Render Function
   */
  function renderUI() {
    if (state.searchQuery && elements.inputSearchQuery) {
      elements.inputSearchQuery.value = state.searchQuery;
    }

    renderStatusCard();
    renderMetrics();
    renderFilterCounts();
    renderLeadsTable();
  }

  function renderStatusCard() {
    const job = state.currentJob;
    const status = job.status || 'IDLE';

    elements.liveStatusBadge.textContent = status;
    elements.liveStatusBadge.className = `status-badge badge-${status.toLowerCase()}`;

    if (status === 'RUNNING') {
      elements.extractionControls.classList.remove('hidden');
      elements.btnStartExtraction.disabled = true;
      elements.lblPauseResume.textContent = 'Pause';
      elements.lblExtractionStatusTitle.textContent = job.currentCity ? `Extracting: ${job.currentCity}` : 'Extracting Leads...';
      if (elements.btnNewSearch) elements.btnNewSearch.classList.add('hidden');
    } else if (status === 'PAUSED') {
      elements.extractionControls.classList.remove('hidden');
      elements.btnStartExtraction.disabled = true;
      elements.lblPauseResume.textContent = 'Resume';
      elements.lblExtractionStatusTitle.textContent = 'Extraction Paused';
      if (elements.btnNewSearch) elements.btnNewSearch.classList.add('hidden');
    } else {
      elements.extractionControls.classList.add('hidden');
      elements.btnStartExtraction.disabled = false;
      if (status === 'COMPLETED') {
        elements.lblExtractionStatusTitle.textContent = 'Extraction Complete ✓';
        if (elements.btnNewSearch) elements.btnNewSearch.classList.remove('hidden');
      } else if (status === 'STOPPED') {
        elements.lblExtractionStatusTitle.textContent = 'Extraction Stopped';
        if (elements.btnNewSearch) elements.btnNewSearch.classList.remove('hidden');
      } else {
        elements.lblExtractionStatusTitle.textContent = 'Extraction Status';
        if (elements.btnNewSearch) elements.btnNewSearch.classList.add('hidden');
      }
    }

    elements.lblCurrentBusiness.textContent = job.currentBusiness || (status === 'IDLE' ? 'Ready to scan leads' : '');

    const maxTarget = parseInt(elements.inputMaxBusinesses?.value, 10) || state.settings.maxBusinesses || 1000;
    const processedCount = Math.max(state.leads.length, state.currentJob.processed || 0);
    
    let percent = 0;
    if (status === 'COMPLETED') {
      percent = 100;
      elements.lblProgressCount.textContent = `${processedCount} / ${processedCount} (Done)`;
    } else {
      percent = maxTarget > 0 ? Math.min(100, Math.round((processedCount / maxTarget) * 100)) : 0;
      elements.lblProgressCount.textContent = `${processedCount} / ${maxTarget}`;
    }

    elements.progressBarFill.style.width = `${percent}%`;
    elements.lblProgressPercent.textContent = `${percent}%`;
  }

  function renderMetrics() {
    let noWebCount = 0;
    let hasWebCount = 0;
    let hasPhoneCount = 0;

    if (state.leads.length > 0) {
      state.leads.forEach(lead => {
        const hasWeb = Boolean(lead.website && lead.website !== 'No Website');
        if (hasWeb) hasWebCount++;
        else noWebCount++;

        if (lead.phone) hasPhoneCount++;
      });

      elements.metricProcessed.textContent = state.leads.length;
      elements.metricNoWebsite.textContent = noWebCount;
      elements.metricHasWebsite.textContent = hasWebCount;
      elements.metricHasPhone.textContent = hasPhoneCount;
    } else {
      elements.metricProcessed.textContent = state.currentJob.processed || 0;
      elements.metricNoWebsite.textContent = state.currentJob.noWebsite || 0;
      elements.metricHasWebsite.textContent = state.currentJob.hasWebsite || 0;
      elements.metricHasPhone.textContent = state.currentJob.hasPhone || 0;
    }
  }

  function renderFilterCounts() {
    let noWebCount = 0;
    let hasWebCount = 0;
    let hasPhoneCount = 0;

    if (state.leads.length > 0) {
      state.leads.forEach(lead => {
        const hasWeb = Boolean(lead.website && lead.website !== 'No Website');
        if (hasWeb) hasWebCount++;
        else noWebCount++;

        if (lead.phone) hasPhoneCount++;
      });

      elements.tabCountAll.textContent = state.leads.length;
      elements.tabCountNoWebsite.textContent = noWebCount;
      elements.tabCountHasWebsite.textContent = hasWebCount;
      elements.tabCountHasPhone.textContent = hasPhoneCount;
      elements.lblTotalLeadsCount.textContent = `${state.leads.length} Total`;
    } else {
      const total = state.currentJob.processed || 0;
      elements.tabCountAll.textContent = total;
      elements.tabCountNoWebsite.textContent = state.currentJob.noWebsite || 0;
      elements.tabCountHasWebsite.textContent = state.currentJob.hasWebsite || 0;
      elements.tabCountHasPhone.textContent = state.currentJob.hasPhone || 0;
      elements.lblTotalLeadsCount.textContent = `${total} Total`;
    }
  }

  function getFilteredLeads() {
    return state.leads.filter(lead => {
      const hasWeb = Boolean(lead.website && lead.website !== 'No Website');

      if (state.activeFilter === 'NO_WEBSITE' && hasWeb) return false;
      if (state.activeFilter === 'HAS_WEBSITE' && !hasWeb) return false;
      if (state.activeFilter === 'HAS_PHONE' && !lead.phone) return false;

      if (state.tableSearchTerm) {
        const term = state.tableSearchTerm;
        const nameMatch = (lead.businessName || '').toLowerCase().includes(term);
        const phoneMatch = (lead.phone || '').includes(term);
        const catMatch = (lead.category || '').toLowerCase().includes(term);
        const pitchMatch = (lead.pitchHook || '').toLowerCase().includes(term);
        if (!nameMatch && !phoneMatch && !catMatch && !pitchMatch) return false;
      }

      return true;
    });
  }

  function renderLeadsTable() {
    const filtered = getFilteredLeads();

    if (filtered.length === 0) {
      elements.leadsTable.classList.add('hidden');
      elements.leadsEmptyState.classList.remove('hidden');
      return;
    }

    elements.leadsEmptyState.classList.add('hidden');
    elements.leadsTable.classList.remove('hidden');
    elements.leadsTableBody.innerHTML = '';

    filtered.forEach(lead => {
      const row = document.createElement('tr');
      row.addEventListener('click', () => openLeadModal(lead));

      const hasWeb = Boolean(lead.website && lead.website !== 'No Website');
      const badgeClass = hasWeb ? 'badge-modern' : 'badge-nowebsite';
      const badgeText = hasWeb ? 'HAS WEBSITE' : 'NO WEBSITE';

      row.innerHTML = `
        <td>
          <div class="lead-name-cell" title="${escapeHtml(lead.businessName)}">${escapeHtml(lead.businessName)}</div>
          ${lead.category ? `<span class="lead-category-sub">${escapeHtml(lead.category)}</span>` : ''}
        </td>
        <td><span class="status-pill-table ${badgeClass}">${badgeText}</span></td>
        <td class="lead-phone-cell">${escapeHtml(lead.phone || '—')}</td>
        <td>★ ${lead.rating !== null && lead.rating !== undefined ? lead.rating : '—'} <span style="font-size:10px;color:var(--text-muted);">(${lead.reviewCount || 0})</span></td>
        <td>
          ${lead.mapsUrl ? `
            <a href="${safeUrl(lead.mapsUrl)}" target="_blank" class="btn-link" title="Open in Google Maps" onclick="event.stopPropagation()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          ` : '—'}
        </td>
      `;

      elements.leadsTableBody.appendChild(row);
    });
  }

  function switchTab(filterType) {
    state.activeFilter = filterType;
    elements.filterTabs.forEach(t => {
      if (t.dataset.filter === filterType) t.classList.add('active');
      else t.classList.remove('active');
    });
    renderLeadsTable();
  }

  /**
   * Open Lead Detail Modal with Cold Pitch Hook
   */
  function openLeadModal(lead) {
    elements.modalTitle.textContent = lead.businessName;

    const hasWeb = Boolean(lead.website && lead.website !== 'No Website');
    const pitch = lead.pitchHook || (hasWeb
      ? `Pitch local SEO & digital customer acquisition to ${lead.businessName}.`
      : `Pitch building a professional modern website for ${lead.businessName} to capture local search leads.`);

    elements.modalBody.innerHTML = `
      <!-- Cold Pitch Script Box -->
      <div class="pitch-box">
        <div class="pitch-header">
          <span class="pitch-label">💡 Personalized Outreach Hook</span>
          <button id="btnCopyPitch" class="btn btn-copy btn-xs">📋 Copy Pitch</button>
        </div>
        <p class="pitch-content" id="pitchText">${escapeHtml(pitch)}</p>
      </div>

      <div class="detail-row">
        <div class="detail-label">Website Status</div>
        <div class="detail-val" style="display:flex;align-items:center;gap:8px;">
          <span class="status-pill-table ${hasWeb ? 'badge-modern' : 'badge-nowebsite'}">
            ${hasWeb ? 'HAS WEBSITE' : 'NO WEBSITE'}
          </span>
          ${hasWeb ? `<a href="${safeUrl(lead.website)}" target="_blank" class="btn-link" style="font-size:12px;">${escapeHtml(lead.website)}</a>` : ''}
        </div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Phone Number</div>
        <div class="detail-val">${escapeHtml(lead.phone || 'Not listed')}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Address</div>
        <div class="detail-val">${escapeHtml(lead.address || 'Not listed')}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">Category & Rating</div>
        <div class="detail-val">${escapeHtml(lead.category || 'Local Business')} • ★ ${lead.rating || 'N/A'} (${lead.reviewCount || 0} reviews)</div>
      </div>

      <div style="display:flex;gap:8px;margin-top:14px;">
        ${lead.mapsUrl ? `<a href="${safeUrl(lead.mapsUrl)}" target="_blank" class="btn btn-primary btn-sm" style="flex:1;">View Google Maps Profile</a>` : ''}
      </div>
    `;

    // Bind Copy Pitch Button
    const copyBtn = document.getElementById('btnCopyPitch');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(pitch);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy Pitch', 2000);
      });
    }

    elements.leadModal.classList.remove('hidden');
  }

  /**
   * Display Interactive Continuation / Decision Modal when target is unmet
   */
  async function showDecisionModal(payload) {
    if (!elements.decisionModal) return;

    const noWebsiteFound = payload.noWebsiteFound !== undefined ? payload.noWebsiteFound : (state.currentJob.noWebsite || 0);
    const targetNoWebsite = payload.targetNoWebsite || state.currentJob.minNoWebsiteTarget || 25;

    // Retrieve active niche and city from payload or preserved master state
    let niche = payload.niche || state.masterNiche || '';
    let city = payload.city || payload.currentCity || state.masterCity || '';

    // If niche or city is missing, parse the search query (NOT just a bare city name)
    if (!niche || !city) {
      const fullQuery = payload.searchQuery || state.searchQuery || payload.currentCity || '';
      if (window.LeadFinder && window.LeadFinder.locationMatrix) {
        const parsed = window.LeadFinder.locationMatrix.parseUserPrompt(fullQuery);
        if (!niche) niche = parsed.niche || 'business';
        if (!city) city = parsed.region || parsed.location || (fullQuery.includes(' in ') ? fullQuery.split(' in ')[1].trim() : fullQuery);
      } else {
        const parts = fullQuery.split(' in ');
        if (parts.length > 1) {
          if (!niche) niche = parts[0].trim();
          if (!city) city = parts[1].trim();
        } else {
          if (!niche) niche = fullQuery;
          if (!city) city = fullQuery;
        }
      }
    }

    // Persist to master state so changing multiple times never loses niche or city
    state.masterNiche = niche;
    state.masterCity = city;

    const activeDisplayQuery = city ? `${niche} in ${city}` : niche;
    state.searchQuery = activeDisplayQuery;

    state.currentDecisionData = {
      niche: niche,
      city: city,
      rawQuery: activeDisplayQuery,
      targetNoWebsite: targetNoWebsite,
      noWebsiteFound: noWebsiteFound
    };

    if (elements.decisionFoundCount) {
      elements.decisionFoundCount.innerHTML = `Found: <strong style="color:#f87171;">${noWebsiteFound}</strong> / <strong>${targetNoWebsite}</strong> "No Website" leads`;
    }
    if (elements.decisionCurrentQuery) {
      elements.decisionCurrentQuery.textContent = activeDisplayQuery;
    }
    if (elements.decisionNicheText) {
      elements.decisionNicheText.textContent = niche;
    }
    if (elements.decisionCityText) {
      elements.decisionCityText.textContent = city;
    }
    if (elements.decisionCurrentTotal) {
      elements.decisionCurrentTotal.textContent = state.leads.length || payload.totalProcessed || 0;
    }

    // Reset and show loading states for AI suggestions
    if (elements.nearbyCitySuggestions) {
      elements.nearbyCitySuggestions.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Finding nearby commercial cities with AI...</span>';
    }
    if (elements.relatedNicheSuggestions) {
      elements.relatedNicheSuggestions.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Finding related commercial niches with AI...</span>';
    }

    elements.decisionModal.classList.remove('hidden');

    // Fetch AI nearby cities
    if (window.LeadFinder && window.LeadFinder.locationMatrix && elements.nearbyCitySuggestions) {
      const nearbyCities = await window.LeadFinder.locationMatrix.getNearbyCitySuggestions(
        city,
        '',
        niche,
        state.settings.geminiApiKey || ''
      );

      elements.nearbyCitySuggestions.innerHTML = '';
      if (nearbyCities && nearbyCities.length > 0) {
        nearbyCities.forEach(cityName => {
          const pill = document.createElement('button');
          pill.className = 'suggestion-pill-btn';
          pill.innerHTML = `<span>📍</span> ${escapeHtml(cityName)}`;
          pill.addEventListener('click', () => handleSelectDecisionCity(cityName, niche));
          elements.nearbyCitySuggestions.appendChild(pill);
        });
      } else {
        elements.nearbyCitySuggestions.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">No nearby suggestions found. Enter custom city below:</span>';
      }
    }

    // Fetch AI related niches
    if (window.LeadFinder && window.LeadFinder.locationMatrix && elements.relatedNicheSuggestions) {
      const relatedNiches = await window.LeadFinder.locationMatrix.getRelatedNicheSuggestions(
        niche,
        state.settings.geminiApiKey || ''
      );

      elements.relatedNicheSuggestions.innerHTML = '';
      if (relatedNiches && relatedNiches.length > 0) {
        relatedNiches.forEach(nicheName => {
          const pill = document.createElement('button');
          pill.className = 'suggestion-pill-btn';
          pill.innerHTML = `<span>💼</span> ${escapeHtml(nicheName)}`;
          pill.addEventListener('click', () => handleSelectDecisionNiche(nicheName, city));
          elements.relatedNicheSuggestions.appendChild(pill);
        });
      } else {
        elements.relatedNicheSuggestions.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">No niche suggestions found. Enter custom niche below:</span>';
      }
    }
  }

  async function handleSelectDecisionCity(cityName, niche) {
    if (!cityName) return;
    const cleanNiche = niche || state.masterNiche || state.currentDecisionData?.niche || 'business';
    const cleanCity = cityName.trim();

    // Store both distinctly!
    state.masterNiche = cleanNiche;
    state.masterCity = cleanCity;

    const newQuery = `${cleanNiche} in ${cleanCity}`;
    state.searchQuery = newQuery;

    elements.decisionModal.classList.add('hidden');
    if (elements.inputSearchQuery) elements.inputSearchQuery.value = newQuery;
    showToast(`Searching nearby location: ${cleanCity}...`, 2500);

    await sendToMapsTab({
      type: 'LEADFINDER_CONTINUE_SEARCH',
      payload: {
        newQuery: newQuery,
        newCity: cleanCity,
        newNiche: cleanNiche
      }
    });
  }

  async function handleSelectDecisionNiche(nicheName, city) {
    if (!nicheName) return;
    const cleanCity = city || state.masterCity || state.currentDecisionData?.city || '';
    const cleanNiche = nicheName.trim();

    // Store both distinctly!
    state.masterNiche = cleanNiche;
    state.masterCity = cleanCity;

    const newQuery = cleanCity ? `${cleanNiche} in ${cleanCity}` : cleanNiche;
    state.searchQuery = newQuery;

    elements.decisionModal.classList.add('hidden');
    if (elements.inputSearchQuery) elements.inputSearchQuery.value = newQuery;
    showToast(`Searching related niche: ${cleanNiche}...`, 2500);

    await sendToMapsTab({
      type: 'LEADFINDER_CONTINUE_SEARCH',
      payload: {
        newQuery: newQuery,
        newCity: cleanCity,
        newNiche: cleanNiche
      }
    });
  }

  async function handleCustomCity() {
    const city = elements.inputCustomCity?.value.trim();
    if (!city) return;
    const niche = state.masterNiche || state.currentDecisionData?.niche || 'business';
    elements.inputCustomCity.value = '';
    await handleSelectDecisionCity(city, niche);
  }

  async function handleCustomNiche() {
    const niche = elements.inputCustomNiche?.value.trim();
    if (!niche) return;
    const city = state.masterCity || state.currentDecisionData?.city || '';
    elements.inputCustomNiche.value = '';
    await handleSelectDecisionNiche(niche, city);
  }

  async function handleCompleteDecision() {
    elements.decisionModal.classList.add('hidden');
    await sendToMapsTab({ type: 'LEADFINDER_COMPLETE_DECISION' });
    state.currentJob.status = 'COMPLETED';
    renderStatusCard();
    showToast('Extraction completed! All leads saved.');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return escapeHtml(trimmed);
    }
    if (/^www\./i.test(trimmed)) {
      return escapeHtml(`https://${trimmed}`);
    }
    return '#';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
