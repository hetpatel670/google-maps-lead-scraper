/**
 * LeadFinder AI - Result Parser
 * Extracts structured business information from the Google Maps detail pane
 * with multi-strategy selector fallbacks and AI extraction abstraction.
 */

(function (root) {
  class ResultParser {
    constructor() {
      this.websiteDetector = (root.LeadFinder && root.LeadFinder.WebsiteDetector) 
        ? new root.LeadFinder.WebsiteDetector() 
        : null;
      this.norm = root.LeadFinder?.Normalization;
    }

    /**
     * Primary extraction method: parses the currently active Google Maps detail panel
     * @param {Element|Document} container - The business detail pane DOM element (default: document)
     * @param {string} searchQuery - Active search context
     * @returns {Object} Structured lead object
     */
    parseBusinessDetail(container = document, searchQuery = '') {
      const logger = root.LeadFinder?.logger;
      const norm = this.norm || {
        cleanText: s => (s || '').trim(),
        normalizeBusinessName: s => (s || '').trim(),
        normalizePhone: s => (s || '').trim(),
        normalizeAddress: s => (s || '').trim(),
        normalizeMapsUrl: s => s || ''
      };

      // 1. Business Name
      const businessName = this._extractBusinessName(container);

      // 2. Category
      const category = this._extractCategory(container);

      // 3. Rating and Review Count
      const { rating, reviewCount } = this._extractRatingAndReviews(container);

      // 4. Phone Number
      const phone = this._extractPhone(container);

      // 5. Address
      const address = this._extractAddress(container);

      // 6. Google Maps URL & Place ID
      const { mapsUrl, placeId } = this._extractMapsUrlAndPlaceId(container);

      // 7. Website Status & URL Detection
      let websiteStatus = root.LeadFinder?.WEBSITE_STATUS?.UNKNOWN || 'UNKNOWN';
      let website = null;
      let detectionReason = '';

      if (this.websiteDetector) {
        const detection = this.websiteDetector.detectWebsite(container);
        websiteStatus = detection.status;
        website = detection.url;
        detectionReason = detection.reason;
      }

      // Calculate confidence score (0.0 to 1.0)
      const confidence = this._calculateConfidence({
        businessName,
        category,
        phone,
        address,
        websiteStatus
      });

      const extractedAt = new Date().toISOString();

      const lead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
        businessName: norm.normalizeBusinessName(businessName),
        category: norm.cleanText(category),
        phone: norm.normalizePhone(phone),
        address: norm.normalizeAddress(address),
        website: website,
        websiteStatus: websiteStatus,
        rating: rating,
        reviewCount: reviewCount,
        mapsUrl: norm.normalizeMapsUrl(mapsUrl),
        placeId: placeId,
        searchQuery: searchQuery || '',
        extractedAt: extractedAt,
        confidence: confidence,
        detectionReason: detectionReason
      };

      return lead;
    }

    /**
     * AI Integration Abstraction Interface (as specified in Section 18)
     * For plugging in an LLM or backend enrichment model when needed.
     */
    async extractBusinessData(pageData) {
      // Deterministic parsing first
      const deterministicResult = this.parseBusinessDetail(pageData.container || document, pageData.searchQuery);

      if (deterministicResult.confidence >= 0.8 && deterministicResult.businessName) {
        return deterministicResult;
      }

      // Future Extension: Call LLM parser endpoint if confidence is lower than threshold
      // For MVP, deterministic parser provides reliable fallback
      return deterministicResult;
    }

    // --- SELECTOR STRATEGIES ---

    _extractBusinessName(container) {
      const selectors = [
        'h1.DUwDvf',
        'h1.fontHeadlineLarge',
        'div[role="main"] h1',
        'h1[tabindex="-1"]',
        '.DUwDvf',
        'div.TIHn2 h1',
        'h2.qrShPb',
        'div[aria-label][role="main"] h1'
      ];

      for (const sel of selectors) {
        const el = container.querySelector(sel);
        if (el && el.textContent.trim()) {
          return el.textContent.trim();
        }
      }

      // Fallback: Check title or header elements
      const headerTitle = container.querySelector('[role="heading"][aria-level="1"]');
      if (headerTitle && headerTitle.textContent.trim()) {
        return headerTitle.textContent.trim();
      }

      return '';
    }

    _extractCategory(container) {
      const selectors = [
        'button.DkEaL',
        'button[jsaction*="category"]',
        'span.DkEaL',
        'div.fontBodyMedium button',
        'button[jsaction*="pane.rating.category"]',
        'span.fontBodyMedium'
      ];

      for (const sel of selectors) {
        const el = container.querySelector(sel);
        if (el && el.textContent.trim()) {
          const text = el.textContent.trim();
          // Filter out rating text if mistakenly caught
          if (!text.match(/^\d+(\.\d+)?$/) && !text.includes('stars') && !text.includes('reviews')) {
            return text;
          }
        }
      }

      return '';
    }

    _extractRatingAndReviews(container) {
      let rating = null;
      let reviewCount = null;

      // Rating selectors
      const ratingSelectors = [
        'span.MW4etd',
        'div.F7nice span[aria-hidden="true"]',
        'span.fontDisplayLarge',
        'span.ceNzKf'
      ];

      for (const sel of ratingSelectors) {
        const el = container.querySelector(sel);
        if (el && el.textContent.trim()) {
          const val = parseFloat(el.textContent.trim().replace(',', '.'));
          if (!isNaN(val) && val >= 1 && val <= 5) {
            rating = val;
            break;
          }
        }
      }

      // Review count selectors
      const reviewSelectors = [
        'span.UY7F9',
        'div.F7nice span:not([aria-hidden="true"])',
        'span[aria-label*="review" i]',
        'span[aria-label*="avis" i]',
        'span[aria-label*="reseñas" i]'
      ];

      for (const sel of reviewSelectors) {
        const el = container.querySelector(sel);
        if (el && el.textContent.trim()) {
          const text = el.textContent.trim();
          const cleanCount = text.replace(/[^\d]/g, '');
          if (cleanCount) {
            reviewCount = parseInt(cleanCount, 10);
            break;
          }
        }
      }

      // Fallback: Search for aria-label on rating container (e.g., "4.8 stars 152 reviews")
      if (rating === null || reviewCount === null) {
        const ratingContainer = container.querySelector('div.F7nice, div.fontBodyMedium [aria-label*="star" i]');
        if (ratingContainer) {
          const aria = ratingContainer.getAttribute('aria-label') || '';
          const starMatch = aria.match(/([\d.,]+)\s*star/i);
          if (starMatch && rating === null) {
            rating = parseFloat(starMatch[1].replace(',', '.'));
          }
          const reviewMatch = aria.match(/([\d.,\s]+)\s*review/i);
          if (reviewMatch && reviewCount === null) {
            reviewCount = parseInt(reviewMatch[1].replace(/[^\d]/g, ''), 10);
          }
        }
      }

      return { rating, reviewCount };
    }

    _extractPhone(container) {
      // 1. Direct phone data-item-id
      const phoneBtn = container.querySelector('button[data-item-id^="phone:"], button[data-item-id*="phone"], button[aria-label*="Phone:" i], button[aria-label*="Téléphone" i], button[aria-label*="Teléfono" i]');
      if (phoneBtn) {
        const text = phoneBtn.querySelector('div.Io6YTe, span.fontBodyMedium, span')?.textContent || phoneBtn.textContent;
        if (text && text.trim() && text.match(/\d/)) {
          return text.trim();
        }
        const rawItemId = phoneBtn.getAttribute('data-item-id') || '';
        if (rawItemId.startsWith('phone:tel:')) {
          return rawItemId.replace('phone:tel:', '').trim();
        }
      }

      // 2. Scan all info rows for phone pattern
      const rows = Array.from(container.querySelectorAll('div.Io6YTe, span.LrzXr'));
      const phoneRegex = /^(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}$/;
      for (const row of rows) {
        const text = (row.textContent || '').trim();
        if (text.includes('+') && text.length < 10) continue; // Skip Plus Codes
        if (text.match(/^(open|closed|mon|tue|wed|thu|fri|sat|sun|located|vic|nsw|qld|wa|sa|tas|act|nt|ny|ca|tx|fl)/i)) continue;
        if (text.length >= 8 && text.length <= 25 && phoneRegex.test(text.replace(/\s+/g, ' '))) {
          return text;
        }
      }

      return '';
    }

    _extractAddress(container) {
      // 1. Direct address data-item-id
      const addressBtn = container.querySelector('button[data-item-id="address"], button[data-item-id*="address"], button[aria-label*="Address:" i], button[aria-label*="Adresse" i], button[aria-label*="Dirección" i]');
      if (addressBtn) {
        const text = addressBtn.querySelector('div.Io6YTe')?.textContent || addressBtn.textContent;
        if (text && text.trim()) {
          return text.trim();
        }
      }

      // 2. Look for pin icon row / first info item
      const firstInfoRow = container.querySelector('div.RgiJu div.Io6YTe, button.CsEnBe div.Io6YTe');
      if (firstInfoRow && firstInfoRow.textContent.trim()) {
        const text = firstInfoRow.textContent.trim();
        // Ensure it's not phone or website
        if (!text.match(/\.(com|org|net|io|gov)/i) && !text.match(/^(\+\d|\(\d{3}\))/)) {
          return text;
        }
      }

      return '';
    }

    _extractMapsUrlAndPlaceId(container) {
      let mapsUrl = window.location.href;
      let placeId = null;

      // Extract place ID from current URL (ChIJ...)
      const urlMatch = mapsUrl.match(/!1s([^!]+)/) || mapsUrl.match(/place\/[^/]+\/([^/@]+)/);
      if (urlMatch && urlMatch[1]) {
        placeId = urlMatch[1];
      }

      // Or check share button or data attributes
      const shareBtn = container.querySelector('button[data-item-id="share"], button[aria-label*="Share" i]');
      if (shareBtn) {
        const link = shareBtn.getAttribute('data-href') || shareBtn.dataset.url;
        if (link) mapsUrl = link;
      }

      return { mapsUrl, placeId };
    }

    _calculateConfidence({ businessName, category, phone, address, websiteStatus }) {
      let score = 0;
      if (businessName) score += 0.4;
      if (category) score += 0.15;
      if (address) score += 0.15;
      if (phone) score += 0.15;
      if (websiteStatus && websiteStatus !== 'UNKNOWN') score += 0.15;
      return Math.round(score * 100) / 100;
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.ResultParser = ResultParser;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
