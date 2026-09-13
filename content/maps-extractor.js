/**
 * LeadFinder AI - Google Maps High-Volume Extractor Engine
 * Automates searches, feed scrolling, multi-location transitions (1,000+ leads),
 * fast lead extraction, and real-time streaming progress.
 */

(function (root) {
  const STATUS = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  };

  class MapsExtractor {
    constructor() {
      this.status = STATUS.IDLE;
      this.detector = new root.LeadFinder.MapsDetector();
      this.parser = new root.LeadFinder.ResultParser();
      this.deduplicator = new root.LeadFinder.Deduplicator();
      this.storage = root.LeadFinder.storage;
      this.locationMatrix = root.LeadFinder.locationMatrix || (root.LeadFinder.LocationMatrix ? new root.LeadFinder.LocationMatrix() : null);
      this.logger = new root.LeadFinder.Logger('Extractor');

      this.currentJob = null;
      this.options = {
        maxBusinesses: 1000,
        delayBetweenClicks: 400,
        searchQuery: '',
        apiKey: ''
      };

      this.stopRequested = false;
      this.pauseRequested = false;
      this.processedSignatures = new Set();
      this._isLoopActive = false;
      this._pauseResolver = null;

      this._initMessageListeners();
    }

    _initMessageListeners() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          this._handleMessage(message, sender, sendResponse);
          return true; // Async reply
        });
      }
    }

    async _handleMessage(message, sender, sendResponse) {
      if (sender.id && sender.id !== chrome.runtime.id) {
        sendResponse({ ok: false, error: 'Unauthorized sender context' });
        return;
      }
      try {
        switch (message.type) {
          case 'LEADFINDER_PING':
          case 'LEADFINDER_REFRESH_CONTEXT': {
            const query = this.detector.detectSearchQuery();
            const items = this.detector.getResultItems();
            sendResponse({
              ok: true,
              status: this.status,
              searchQuery: query,
              itemsCount: items.length
            });
            break;
          }

          case 'LEADFINDER_GET_STATE': {
            const query = this.detector.detectSearchQuery();
            const items = this.detector.getResultItems();
            sendResponse({
              ok: true,
              status: this.status,
              searchQuery: query,
              itemsCount: items.length,
              currentJob: this.currentJob
            });
            break;
          }

          case 'LEADFINDER_SEARCH': {
            const query = message.payload?.query || '';
            const success = await this.detector.executeSearch(query);
            sendResponse({ ok: success, query });
            break;
          }

          case 'LEADFINDER_CLEAR_SEARCH': {
            const success = this.detector.clearSearch();
            sendResponse({ ok: success });
            break;
          }

          case 'LEADFINDER_BACK': {
            const success = this.detector.closeDetailPane();
            sendResponse({ ok: success });
            break;
          }

          case 'LEADFINDER_START': {
            const options = message.payload || {};
            this.startExtraction(options);
            sendResponse({ ok: true, status: this.status });
            break;
          }

          case 'LEADFINDER_CONTINUE_SEARCH': {
            const { newQuery, newCity, newNiche } = message.payload || {};
            this.continueSearch(newQuery, newCity, newNiche);
            sendResponse({ ok: true, status: this.status });
            break;
          }

          case 'LEADFINDER_COMPLETE_DECISION': {
            this.completeDecision();
            sendResponse({ ok: true, status: this.status });
            break;
          }

          case 'LEADFINDER_PAUSE': {
            this.pauseExtraction();
            sendResponse({ ok: true, status: this.status });
            break;
          }

          case 'LEADFINDER_RESUME': {
            this.resumeExtraction();
            sendResponse({ ok: true, status: this.status });
            break;
          }

          case 'LEADFINDER_STOP': {
            this.stopExtraction();
            sendResponse({ ok: true, status: this.status });
            break;
          }

          default:
            sendResponse({ ok: false, error: 'Unknown message type' });
        }
      } catch (err) {
        this.logger.error('Message handler error:', err);
        sendResponse({ ok: false, error: err.message });
      }
    }

    /**
     * Start the automated extraction process
     */
    async startExtraction(customOptions = {}) {
      if (this.status === STATUS.RUNNING) {
        this.logger.warn('Extraction is already running');
        return;
      }

      this.stopRequested = false;
      this.pauseRequested = false;
      this.status = STATUS.RUNNING;
      this.processedSignatures.clear();

      const detectedQuery = this.detector.detectSearchQuery();
      const rawQuery = customOptions.searchQuery || detectedQuery || 'Google Maps Search';
      const maxTarget = customOptions.maxBusinesses || 1000;
      const minNoWebsite = customOptions.minNoWebsiteTarget || 25;
      const apiKey = customOptions.apiKey || '';

      // Parse niche and location distinctly
      let parsedPlan = null;
      if (apiKey && this.locationMatrix) {
        parsedPlan = await this.locationMatrix.generateWithGeminiAI(rawQuery, apiKey, maxTarget);
      }
      if (!parsedPlan && this.locationMatrix) {
        parsedPlan = this.locationMatrix.parseUserPrompt(rawQuery, maxTarget);
      }

      const initialNiche = customOptions.niche || parsedPlan?.niche || rawQuery;
      const initialCity = customOptions.city || parsedPlan?.location || parsedPlan?.region || '';

      this.options = {
        maxBusinesses: maxTarget,
        minNoWebsiteTarget: minNoWebsite,
        delayBetweenClicks: customOptions.delayBetweenClicks || 400,
        searchQuery: rawQuery,
        niche: initialNiche,
        city: initialCity,
        apiKey: apiKey
      };

      this.currentJob = {
        jobId: `job_${Date.now()}`,
        searchQuery: rawQuery,
        niche: initialNiche,
        city: initialCity,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: STATUS.RUNNING,
        totalFound: 0,
        processed: 0,
        noWebsite: 0,
        hasWebsite: 0,
        hasPhone: 0,
        errors: 0,
        minNoWebsiteTarget: minNoWebsite,
        currentBusiness: 'Initializing lead discovery...',
        currentCity: initialCity || rawQuery,
        errorMessage: null
      };

      // Always reset deduplicator keys for clean extraction state
      this.deduplicator.reset();

      // Seed existing leads only if not starting a brand new session
      if (!customOptions.isNewSession) {
        const existingLeads = await this.storage.getAllLeads();
        if (existingLeads && existingLeads.length > 0) {
          this.deduplicator.seed(existingLeads);
        }
      }

      await this.storage.updateJob(this.currentJob);
      this._broadcastProgress();

      this.logger.info(`Starting lead extraction for "${rawQuery}" (Niche: "${initialNiche}", City: "${initialCity}", Goal: ${minNoWebsite} No-Website leads, Max Total: ${maxTarget})`);

      // Run master multi-location loop in background
      this._isLoopActive = true;
      this._runMultiLocationLoop().catch(err => {
        if (!this._isContextValid() || (err?.message && err.message.includes('Extension context invalidated'))) {
          this.logger.warn('Extraction safely halted: extension context invalidated.');
          this.status = STATUS.STOPPED;
          return;
        }
        this.logger.error('Fatal extraction error:', err);
        this.status = STATUS.ERROR;
        this.currentJob.status = STATUS.ERROR;
        this.currentJob.errorMessage = err.message;
        if (this._isContextValid()) {
          this.storage.updateJob(this.currentJob);
          this._broadcastProgress();
        }
      }).finally(() => {
        this._isLoopActive = false;
      });
    }

    pauseExtraction() {
      this.pauseRequested = true;
      this.status = STATUS.PAUSED;
      if (this.currentJob) {
        this.currentJob.status = STATUS.PAUSED;
        this.storage.updateJob(this.currentJob);
      }
      this._broadcastProgress();
      this.logger.info('Extraction paused');
    }

    resumeExtraction() {
      this.pauseRequested = false;
      this.stopRequested = false;
      this.status = STATUS.RUNNING;

      // Detect if user manually changed the search query in Google Maps while paused
      const activeDetectorQuery = this.detector.detectSearchQuery();
      if (activeDetectorQuery && activeDetectorQuery !== this.options.searchQuery && !activeDetectorQuery.includes('google.com')) {
        this.logger.info(`Detected manual search query update while paused: "${activeDetectorQuery}" (was "${this.options.searchQuery}")`);
        this.options.searchQuery = activeDetectorQuery;
        if (this.currentJob) {
          this.currentJob.searchQuery = activeDetectorQuery;
          this.currentJob.currentCity = activeDetectorQuery;
          if (this.locationMatrix) {
            const parsed = this.locationMatrix.parseUserPrompt(activeDetectorQuery, this.options.maxBusinesses);
            if (parsed.niche) {
              this.options.niche = parsed.niche;
              this.currentJob.niche = parsed.niche;
            }
            if (parsed.region || parsed.location) {
              this.options.city = parsed.region || parsed.location;
              this.currentJob.city = parsed.region || parsed.location;
            }
          }
        }
        this.processedSignatures.clear();
      }

      if (this._pauseResolver) {
        const resolve = this._pauseResolver;
        this._pauseResolver = null;
        resolve();
      }

      if (this.currentJob) {
        this.currentJob.status = STATUS.RUNNING;
        this.storage.updateJob(this.currentJob);
      }
      this._broadcastProgress();
      this.logger.info('Extraction resumed');

      // If background loop had finished or was waiting, restart active extraction loop
      if (!this._isLoopActive) {
        this._isLoopActive = true;
        this.logger.info('Resuming extraction loop...');
        this._runMultiLocationLoop().catch(err => {
          this.logger.error('Error on resumed extraction loop:', err);
        }).finally(() => {
          this._isLoopActive = false;
        });
      }
    }

    stopExtraction() {
      this.stopRequested = true;
      this.pauseRequested = false;
      this.status = STATUS.STOPPED;

      if (this._pauseResolver) {
        const resolve = this._pauseResolver;
        this._pauseResolver = null;
        resolve();
      }

      if (this.currentJob) {
        this.currentJob.status = STATUS.STOPPED;
        this.currentJob.completedAt = new Date().toISOString();
        this.storage.updateJob(this.currentJob);
      }
      this._broadcastProgress();
      this.logger.info('Extraction stopped by user');
    }

    _isContextValid() {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    }

    /**
     * Multi-Location Master Loop
     * Executes queries directly in Google Maps UI and smoothly iterates across cities
     */
    async _runMultiLocationLoop() {
      const { searchQuery, maxBusinesses, minNoWebsiteTarget, apiKey } = this.options;

      // 1. Parse prompt & determine sub-queries
      let parsedPlan = null;
      if (apiKey && this.locationMatrix) {
        parsedPlan = await this.locationMatrix.generateWithGeminiAI(searchQuery, apiKey, maxBusinesses);
      }
      if (!parsedPlan && this.locationMatrix) {
        parsedPlan = this.locationMatrix.parseUserPrompt(searchQuery, maxBusinesses);
      }

      const subQueries = (parsedPlan && parsedPlan.subQueries && parsedPlan.subQueries.length > 0)
        ? parsedPlan.subQueries
        : [searchQuery];

      this.logger.info(`Extraction plan: ${subQueries.length} search sequence(s) for target ${maxBusinesses} leads (Goal: ${minNoWebsiteTarget} No-Website leads)`, subQueries);

      for (let i = 0; i < subQueries.length; i++) {
        if (this.stopRequested || 
            this.currentJob.processed >= maxBusinesses || 
            this.currentJob.noWebsite >= minNoWebsiteTarget || 
            !this._isContextValid()) {
          break;
        }

        const currentSubQuery = subQueries[i];
        this.currentJob.currentCity = currentSubQuery;
        this.currentJob.currentBusiness = `Searching [${i + 1}/${subQueries.length}]: ${currentSubQuery}...`;
        this._broadcastProgress();

        // Actively trigger in-page search for every location in the sequence
        this.logger.info(`[Search ${i + 1}/${subQueries.length}] Executing: "${currentSubQuery}"`);
        await this.detector.executeSearch(currentSubQuery);
        await this.detector.waitForFeed(7000);
        await this._sleep(1500); // Allow results feed to stabilize

        // Process cards in this city's feed
        await this._extractCurrentCityFeed(maxBusinesses);
      }

      // Check if target "No Website" leads count was NOT met and user needs to decide next action
      if (!this.stopRequested && 
          this.status !== STATUS.ERROR && 
          this.currentJob.noWebsite < minNoWebsiteTarget && 
          this.currentJob.processed < maxBusinesses && 
          this._isContextValid()) {
        
        this.logger.info(`Initial search feed exhausted: ${this.currentJob.noWebsite}/${minNoWebsiteTarget} "No Website" leads found. Prompting user continuation decision.`);
        this.status = STATUS.PAUSED;
        this.currentJob.status = 'WAITING_DECISION';
        this.currentJob.currentBusiness = `Found ${this.currentJob.noWebsite}/${minNoWebsiteTarget} "No Website" leads. Choose next search location/niche.`;
        await this.storage.updateJob(this.currentJob);
        this._broadcastProgress();
        this._broadcastTargetUnmet();
        return;
      }

      // Finalize job
      if (!this.stopRequested && this.status !== STATUS.ERROR && this._isContextValid()) {
        this.status = STATUS.COMPLETED;
        this.currentJob.status = STATUS.COMPLETED;
        this.currentJob.completedAt = new Date().toISOString();
        this.currentJob.currentBusiness = `Extraction Complete! ${this.currentJob.noWebsite} "No Website" leads (${this.currentJob.processed} total) collected.`;
        await this.storage.updateJob(this.currentJob);
        this._broadcastProgress();
        this.logger.info(`Extraction complete! Total leads: ${this.currentJob.processed}`);
      }
    }

    /**
     * Seamlessly continue extraction with a new city or new niche selected by user
     */
    async continueSearch(newQuery, newCity, newNiche) {
      if (newCity) {
        this.currentJob.city = newCity;
        this.options.city = newCity;
      }
      if (newNiche) {
        this.currentJob.niche = newNiche;
        this.options.niche = newNiche;
      }

      const activeNiche = this.currentJob.niche || this.options.niche || 'business';
      const activeCity = this.currentJob.city || this.options.city || '';
      const cleanTargetQuery = newQuery || (activeCity ? `${activeNiche} in ${activeCity}` : activeNiche);

      this.logger.info(`Continuing extraction with clean query: "${cleanTargetQuery}" (Niche: "${activeNiche}", City: "${activeCity}")`);

      this.stopRequested = false;
      this.pauseRequested = false;
      this.status = STATUS.RUNNING;
      this.currentJob.status = STATUS.RUNNING;
      this.currentJob.searchQuery = cleanTargetQuery;
      this.options.searchQuery = cleanTargetQuery;
      this.currentJob.currentCity = activeCity || cleanTargetQuery;
      this.currentJob.currentBusiness = `Searching: ${cleanTargetQuery}...`;
      
      // Clear per-feed card signatures so cards in new city/niche are extracted
      this.processedSignatures.clear();

      await this.storage.updateJob(this.currentJob);
      this._broadcastProgress();

      try {
        await this.detector.executeSearch(cleanTargetQuery);
        await this.detector.waitForFeed(7000);
        await this._sleep(1500);

        await this._extractCurrentCityFeed(this.options.maxBusinesses);

        // Check if target is met or if still unmet
        if (!this.stopRequested && 
            this.status !== STATUS.ERROR && 
            this.currentJob.noWebsite < this.options.minNoWebsiteTarget && 
            this.currentJob.processed < this.options.maxBusinesses && 
            this._isContextValid()) {
          this.status = STATUS.PAUSED;
          this.currentJob.status = 'WAITING_DECISION';
          this.currentJob.currentBusiness = `Found ${this.currentJob.noWebsite}/${this.options.minNoWebsiteTarget} "No Website" leads. Choose next action.`;
          await this.storage.updateJob(this.currentJob);
          this._broadcastProgress();
          this._broadcastTargetUnmet();
        } else if (!this.stopRequested && this.status !== STATUS.ERROR && this._isContextValid()) {
          this.status = STATUS.COMPLETED;
          this.currentJob.status = STATUS.COMPLETED;
          this.currentJob.completedAt = new Date().toISOString();
          this.currentJob.currentBusiness = `Extraction Complete! ${this.currentJob.noWebsite} "No Website" leads (${this.currentJob.processed} total) collected.`;
          await this.storage.updateJob(this.currentJob);
          this._broadcastProgress();
        }
      } catch (err) {
        this.logger.error('Error during continueSearch:', err);
      }
    }

    /**
     * Finalize extraction when user chooses to complete from decision modal
     */
    async completeDecision() {
      this.status = STATUS.COMPLETED;
      this.currentJob.status = STATUS.COMPLETED;
      this.currentJob.completedAt = new Date().toISOString();
      this.currentJob.currentBusiness = `Extraction Complete! ${this.currentJob.noWebsite} "No Website" leads (${this.currentJob.processed} total) collected.`;
      await this.storage.updateJob(this.currentJob);
      this._broadcastProgress();
    }

    _broadcastTargetUnmet() {
      if (!this._isContextValid()) return;
      try {
        chrome.runtime.sendMessage({
          type: 'LEADFINDER_TARGET_UNMET',
          payload: {
            job: this.currentJob,
            searchQuery: this.options.searchQuery,
            niche: this.currentJob.niche || this.options.niche,
            city: this.currentJob.city || this.options.city || this.currentJob.currentCity,
            currentCity: this.currentJob.currentCity || this.currentJob.city,
            noWebsiteFound: this.currentJob.noWebsite || 0,
            targetNoWebsite: this.options.minNoWebsiteTarget || 25,
            totalProcessed: this.currentJob.processed || 0
          }
        }).catch(() => {});
      } catch {}
    }

    /**
     * Extract all leads from the currently active search feed
     */
    async _extractCurrentCityFeed(targetCount) {
      let consecutiveEmptyScrolls = 0;
      const MAX_EMPTY_SCROLLS = 5;
      this.processedSignatures.clear(); // Reset per-feed card signatures for fresh feed

      while (!this.stopRequested && this.currentJob.processed < targetCount) {
        if (!this._isContextValid()) return;

        // Pause handling
        while (this.pauseRequested && !this.stopRequested) {
          if (!this._isContextValid()) return;
          await this._sleep(300);
        }
        if (this.stopRequested || !this._isContextValid()) break;

        // Check for security/CAPTCHA
        const restriction = this.detector.detectAccessRestriction();
        if (restriction.isRestricted) {
          this.logger.warn(`Security restriction: ${restriction.message}`);
          this.status = STATUS.ERROR;
          this.currentJob.status = STATUS.ERROR;
          this.currentJob.errorMessage = restriction.message;
          if (this._isContextValid()) {
            await this.storage.updateJob(this.currentJob);
            this._broadcastProgress();
          }
          break;
        }

        // Get visible cards in current feed view
        const visibleCards = this.detector.getResultItems();
        this.currentJob.totalFound = Math.max(this.currentJob.totalFound, visibleCards.length);

        // Find the first unprocessed card
        let nextCard = null;
        for (const card of visibleCards) {
          if (!this.processedSignatures.has(card.signature)) {
            nextCard = card;
            break;
          }
        }

        if (nextCard) {
          this.processedSignatures.add(nextCard.signature);
          this.currentJob.currentBusiness = nextCard.name || 'Extracting lead details...';
          this._broadcastProgress();

          try {
            await this._processCard(nextCard);
            consecutiveEmptyScrolls = 0;
          } catch (err) {
            if (!this._isContextValid() || (err.message && err.message.includes('Extension context invalidated'))) {
              return;
            }
            this.logger.error(`Error processing "${nextCard.name}":`, err);
            this.currentJob.errors += 1;
            this.currentJob.processed += 1;
            if (this._isContextValid()) {
              await this.storage.updateJob(this.currentJob);
              this._broadcastProgress();
            }
          }

          await this._sleep(this.options.delayBetweenClicks);
        } else {
          // All visible cards processed -> scroll feed to load next batch
          if (this.detector.isEndOfResults()) {
            this.logger.info("Reached end of Google Maps results for this location.");
            break;
          }

          const scrolled = await this._scrollResultsFeed();
          if (!scrolled) {
            consecutiveEmptyScrolls++;
            if (consecutiveEmptyScrolls >= MAX_EMPTY_SCROLLS) {
              this.logger.info("No more items loaded after scrolling. Moving to next search.");
              break;
            }
            await this._sleep(800);
          } else {
            await this._sleep(400); // Allow lazy-loaded cards to render
          }
        }
      }

      // Card Reconciliation & Mismatch Verification Pass
      if (!this.stopRequested && this._isContextValid()) {
        await this._reconcileFeedCards(targetCount);
      }
    }

    /**
     * Card Reconciliation & Mismatch Verification Pass
     * Compares the total cards loaded in the search feed with the extracted count.
     * If any card was missed, it brings it into view and extracts it until 100% of feed cards match.
     */
    async _reconcileFeedCards(targetCount) {
      let pass = 0;
      const MAX_RECONCILE_PASSES = 3;

      while (pass < MAX_RECONCILE_PASSES && !this.stopRequested && this.currentJob.processed < targetCount) {
        if (!this._isContextValid()) return;

        // Pause handling
        while (this.pauseRequested && !this.stopRequested) {
          if (!this._isContextValid()) return;
          await this._sleep(300);
        }
        if (this.stopRequested || !this._isContextValid()) break;

        const allFeedCards = this.detector.getResultItems();
        const unextracted = allFeedCards.filter(card => !this.processedSignatures.has(card.signature));

        if (unextracted.length === 0) {
          this.logger.info(`Feed reconciliation verified: all ${allFeedCards.length} business cards in search results matched and extracted.`);
          break;
        }

        this.logger.info(`Feed reconciliation pass ${pass + 1}: Found ${unextracted.length} unextracted cards out of ${allFeedCards.length} in search results. Extracting missing profiles now...`);

        for (const card of unextracted) {
          if (this.stopRequested || this.currentJob.processed >= targetCount || !this._isContextValid()) {
            break;
          }

          while (this.pauseRequested && !this.stopRequested) {
            await this._sleep(300);
          }

          if (this.processedSignatures.has(card.signature)) continue;

          // Scroll card into view so DOM is hydrated
          if (card.container && typeof card.container.scrollIntoView === 'function') {
            try {
              card.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await this._sleep(250);
            } catch {}
          }

          this.processedSignatures.add(card.signature);
          this.currentJob.currentBusiness = card.name || 'Extracting missing profile...';
          this._broadcastProgress();

          try {
            await this._processCard(card);
          } catch (err) {
            this.logger.warn(`Reconciliation error for "${card.name}":`, err);
          }

          await this._sleep(this.options.delayBetweenClicks);
        }

        pass++;
      }
    }

    /**
     * Process an individual business card via Background Tab Extraction
     */
    async _processCard(cardItem) {
      const { container, clickable, name, mapsUrl, directWebsite, category, phone, address, rating, reviewCount } = cardItem;

      // 1. Base card snippet data
      let initialCardData = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
        businessName: name || '',
        category: category || '',
        phone: phone || '',
        address: address || '',
        website: directWebsite || null,
        websiteStatus: directWebsite ? 'HAS_WEBSITE' : 'NO_WEBSITE',
        pitchHook: '',
        rating: rating !== undefined ? rating : null,
        reviewCount: reviewCount !== undefined ? reviewCount : null,
        mapsUrl: mapsUrl || window.location.href,
        searchQuery: this.currentJob.currentCity || this.options.searchQuery,
        extractedAt: new Date().toISOString()
      };

      // 2. Full detail extraction via background tab (opens place URL, extracts, closes tab)
      let finalLead = initialCardData;

      if (mapsUrl && mapsUrl.includes('google.com/maps')) {
        try {
          const response = await this._extractViaBackgroundTab(mapsUrl, initialCardData, { apiKey: this.options.apiKey });
          if (response && response.lead) {
            finalLead = {
              ...initialCardData,
              ...response.lead,
              businessName: response.lead.businessName || initialCardData.businessName || name,
              mapsUrl: mapsUrl
            };
          }
        } catch (err) {
          this.logger.warn(`Background tab extraction fallback for "${name}":`, err);
        }
      }

      // 3. Generate outreach pitch hook
      if (this.locationMatrix) {
        finalLead.pitchHook = await this.locationMatrix.generatePitchHook(finalLead, this.options.apiKey);
      }

      // 4. Deduplication check
      if (this.deduplicator.isDuplicate(finalLead)) {
        this.logger.info(`Skipping duplicate business: "${finalLead.businessName}"`);
        return;
      }

      // Register deduplication
      this.deduplicator.register(finalLead);

      // 5. Final Website Sanity Check (Reject Google claim links / internal URLs)
      const norm = root.LeadFinder?.Normalization;
      if (finalLead.website) {
        let isRealWebsite = false;
        if (norm && typeof norm.isValidBusinessWebsite === 'function') {
          isRealWebsite = norm.isValidBusinessWebsite(finalLead.website);
        } else {
          const wLower = String(finalLead.website).toLowerCase();
          isRealWebsite = !wLower.includes('google.') && !wLower.includes('claim');
        }

        if (!isRealWebsite) {
          finalLead.website = null;
          finalLead.websiteStatus = 'NO_WEBSITE';
        } else {
          finalLead.websiteStatus = 'HAS_WEBSITE';
        }
      } else {
        finalLead.website = null;
        finalLead.websiteStatus = 'NO_WEBSITE';
      }

      // 6. Update counters
      this.currentJob.processed += 1;
      const hasWeb = Boolean(finalLead.website && finalLead.website !== 'No Website');
      if (hasWeb) {
        this.currentJob.hasWebsite = (this.currentJob.hasWebsite || 0) + 1;
      } else {
        this.currentJob.noWebsite = (this.currentJob.noWebsite || 0) + 1;
      }

      if (finalLead.phone) {
        this.currentJob.hasPhone = (this.currentJob.hasPhone || 0) + 1;
      }

      // 7. Persist immediately to Chrome storage
      await this.storage.saveLead(finalLead);
      await this.storage.updateJob(this.currentJob);

      this.logger.info(`[${hasWeb ? '🌐 HAS WEBSITE' : '🔴 NO WEBSITE'}] "${finalLead.businessName}" | Website: ${finalLead.website || 'None'} | Phone: ${finalLead.phone || 'N/A'}`);

      this._broadcastLeadSaved(finalLead);
      this._broadcastProgress();
    }

    /**
     * Send message to background service worker to open place tab, extract details, and close tab
     */
    _extractViaBackgroundTab(mapsUrl, cardData, options = {}) {
      return new Promise((resolve) => {
        if (!this._isContextValid()) {
          resolve({ ok: false, lead: cardData, error: 'Context invalidated' });
          return;
        }
        try {
          chrome.runtime.sendMessage({
            target: 'SERVICE_WORKER',
            type: 'LEADFINDER_EXTRACT_TAB',
            payload: { mapsUrl, cardData, options }
          }, (response) => {
            if (chrome.runtime?.lastError) {
              resolve({ ok: false, lead: cardData });
            } else {
              resolve(response || { ok: false, lead: cardData });
            }
          });
        } catch {
          resolve({ ok: false, lead: cardData });
        }
      });
    }

    /**
     * Scroll search results feed to trigger next page / lazy loading
     */
    async _scrollResultsFeed() {
      const feed = this.detector.getResultsFeedContainer();
      if (!feed) {
        window.scrollBy({ top: 600, behavior: 'smooth' });
        return true;
      }

      const prevScrollTop = feed.scrollTop;
      const prevScrollHeight = feed.scrollHeight;

      feed.scrollBy({ top: 800, behavior: 'smooth' });
      await this._sleep(350);

      return feed.scrollTop > prevScrollTop || feed.scrollHeight > prevScrollHeight;
    }

    async _sleep(ms) {
      if (this.pauseRequested) {
        await new Promise(resolve => {
          this._pauseResolver = resolve;
        });
      }
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    _broadcastProgress() {
      if (this._isContextValid()) {
        try {
          chrome.runtime.sendMessage({
            type: 'LEADFINDER_PROGRESS',
            payload: {
              status: this.status,
              job: this.currentJob
            }
          }, () => {
            if (chrome.runtime?.lastError) { /* ignore */ }
          });
        } catch {
          // Context invalidated - ignore
        }
      }
    }

    _broadcastLeadSaved(lead) {
      if (this._isContextValid()) {
        try {
          chrome.runtime.sendMessage({
            type: 'LEADFINDER_LEAD_SAVED',
            payload: {
              lead: lead,
              job: this.currentJob
            }
          }, () => {
            if (chrome.runtime?.lastError) { /* ignore */ }
          });
        } catch {
          // Context invalidated - ignore
        }
      }
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.MapsExtractor = MapsExtractor;
  if (!root.LeadFinder.extractor) {
    root.LeadFinder.extractor = new MapsExtractor();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
