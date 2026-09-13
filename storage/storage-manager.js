/**
 * LeadFinder AI - Storage Manager
 * Handles local persistence with Chrome Storage API.
 * Ensures data survives side panel close/reopen, popup changes, and tab reloads.
 */

(function (root) {
  const STORAGE_KEYS = {
    ACTIVE_JOB: 'leadfinder_active_job',
    LEADS: 'leadfinder_leads',
    SETTINGS: 'leadfinder_settings',
    LOGS: 'leadfinder_logs'
  };

  const DEFAULT_SETTINGS = {
    maxBusinesses: 1000,
    minNoWebsiteTarget: 25,
    onlyNoWebsite: false,
    autoSave: true,
    delayBetweenClicks: 500, // ms
    activeFilter: 'ALL',
    geminiApiKey: ''
  };

  class StorageManager {
    constructor() {
      this.isChromeStorageAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    _isContextValid() {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    }

    /**
     * Low-level getter
     */
    async get(key, defaultValue = null) {
      if (this._isContextValid()) {
        try {
          const res = await chrome.storage.local.get([key]).catch(() => null);
          if (res && res[key] !== undefined) {
            return res[key];
          }
          return defaultValue;
        } catch {
          return defaultValue;
        }
      }
      // LocalStorage fallback for browser/testing
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    }

    /**
     * Low-level setter
     */
    async set(key, value) {
      if (this._isContextValid()) {
        try {
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
          return true;
        } catch (err) {
          if (root.LeadFinder && root.LeadFinder.logger) {
            root.LeadFinder.logger.warn(`Storage write error for key "${key}":`, err.message || err);
          }
          return false;
        }
      }
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        if (root.LeadFinder && root.LeadFinder.logger) {
          root.LeadFinder.logger.warn(`LocalStorage write error for key "${key}":`, err.message || err);
        }
        return false;
      }
    }

    /**
     * Get or initialize application settings
     */
    async getSettings() {
      const stored = await this.get(STORAGE_KEYS.SETTINGS, {});
      return { ...DEFAULT_SETTINGS, ...stored };
    }

    /**
     * Save user settings
     */
    async saveSettings(settings) {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await this.set(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    }

    /**
     * Get current or last active job
     */
    async getActiveJob() {
      return await this.get(STORAGE_KEYS.ACTIVE_JOB, {
        jobId: null,
        searchQuery: '',
        startedAt: null,
        completedAt: null,
        status: 'IDLE', // 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ERROR'
        totalFound: 0,
        processed: 0,
        noWebsite: 0,
        websiteFound: 0,
        unknown: 0,
        errors: 0,
        currentBusiness: '',
        errorMessage: null
      });
    }

    /**
     * Update active job state
     */
    async updateJob(patch) {
      const current = await this.getActiveJob();
      const updated = { ...current, ...patch };
      await this.set(STORAGE_KEYS.ACTIVE_JOB, updated);
      return updated;
    }

    /**
     * Get all saved leads
     */
    async getAllLeads() {
      return await this.get(STORAGE_KEYS.LEADS, []);
    }

    /**
     * Save a new lead or update an existing lead immediately
     */
    async saveLead(lead) {
      if (!lead || !lead.businessName) return false;
      const leads = await this.getAllLeads();

      // Check if item already exists by ID
      const existingIdx = leads.findIndex(item => item.id === lead.id);
      if (existingIdx >= 0) {
        leads[existingIdx] = { ...leads[existingIdx], ...lead };
      } else {
        leads.unshift(lead); // Put newest lead at top
      }

      await this.set(STORAGE_KEYS.LEADS, leads);
      return lead;
    }

    /**
     * Clear all saved leads
     */
    async clearLeads() {
      await this.set(STORAGE_KEYS.LEADS, []);
      await this.updateJob({
        processed: 0,
        noWebsite: 0,
        websiteFound: 0,
        unknown: 0,
        errors: 0,
        totalFound: 0,
        status: 'IDLE',
        currentBusiness: ''
      });
    }

    /**
     * Complete data purge / wipe (Privacy compliance)
     */
    async resetAllData() {
      if (this._isContextValid()) {
        try {
          await chrome.storage.local.clear().catch(() => null);
        } catch {}
      }
      try {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      } catch {}
      await this.saveSettings(DEFAULT_SETTINGS);
      return true;
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.StorageManager = StorageManager;
  root.LeadFinder.storage = new StorageManager();
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
