/**
 * LeadFinder AI - Google Maps Detector & Automation Controller
 * Detects search context, executes in-page searches, controls navigation,
 * and extracts structured business data directly from Google Maps DOM.
 */

(function (root) {
  class MapsDetector {
    constructor() {
      this.lastDetectedQuery = '';
    }

    /**
     * Detect current search query from URL, search input, or heading
     */
    detectSearchQuery() {
      // Strategy 1: URL search query path /maps/search/dentists+in+New+York/
      try {
        const pathname = decodeURIComponent(window.location.pathname);
        const searchMatch = pathname.match(/\/maps\/search\/([^/@]+)/);
        if (searchMatch && searchMatch[1]) {
          const query = searchMatch[1].replace(/\+/g, ' ').trim();
          if (query && query !== 'search') {
            this.lastDetectedQuery = query;
            return query;
          }
        }
      } catch {}

      // Strategy 2: URL search params (e.g. ?q=dentists+in+New+York)
      try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q') || params.get('query');
        if (q && q.trim()) {
          this.lastDetectedQuery = q.trim();
          return q.trim();
        }
      } catch {}

      // Strategy 3: Search input field value
      const searchInput = document.querySelector('#searchboxinput, input.searchboxinput, input[aria-label*="Search Google Maps" i]');
      if (searchInput && searchInput.value && searchInput.value.trim()) {
        this.lastDetectedQuery = searchInput.value.trim();
        return searchInput.value.trim();
      }

      // Strategy 4: Results heading / aria-label
      const feedEl = document.querySelector('div[role="feed"], div[aria-label*="Results for" i]');
      if (feedEl) {
        const aria = feedEl.getAttribute('aria-label') || '';
        const match = aria.match(/Results for\s+([^"]+)/i);
        if (match && match[1]) {
          this.lastDetectedQuery = match[1].trim();
          return match[1].trim();
        }
      }

      return this.lastDetectedQuery || '';
    }

    /**
     * Execute a search directly in Google Maps UI
     */
    async executeSearch(query) {
      if (!query || !query.trim()) return false;
      const cleanQuery = query.trim();

      // If detail pane is currently open, close it first
      this.closeDetailPane();
      await this._sleep(300);

      const searchInput = document.querySelector('#searchboxinput, input.searchboxinput, input[aria-label*="Search Google Maps" i], input[name="q"]');
      const searchButton = document.querySelector('#searchbox-searchbutton, button#searchbox-searchbutton, button[aria-label="Search"], button[data-tooltip="Search"]');

      if (searchInput) {
        searchInput.focus();
        searchInput.value = cleanQuery;
        
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Press Enter or click search button
        searchInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));

        if (searchButton) {
          searchButton.click();
        }

        this.lastDetectedQuery = cleanQuery;
        return true;
      }

      // Fallback: update URL directly
      window.location.href = `https://www.google.com/maps/search/${encodeURIComponent(cleanQuery)}/`;
      return true;
    }

    /**
     * Clear the search input or leave current search
     */
    clearSearch() {
      const clearBtn = document.querySelector('#searchbox-clearbutton, button[aria-label="Clear search"], button.searchbox-clear-button');
      if (clearBtn && clearBtn.offsetParent !== null) {
        clearBtn.click();
        return true;
      }

      const searchInput = document.querySelector('#searchboxinput, input.searchboxinput');
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    }

    /**
     * Close detail view if open
     */
    closeDetailPane() {
      const backBtn = this.getBackButton();
      if (backBtn) {
        backBtn.click();
        return true;
      }
      return false;
    }

    /**
     * Wait for search results feed or cards to appear
     */
    async waitForFeed(timeoutMs = 6000) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        if (this.isResultsFeedVisible()) {
          return true;
        }
        await this._sleep(250);
      }
      return false;
    }

    /**
     * Find the scrollable search results feed element
     */
    getResultsFeedContainer() {
      // 1. Explicit feed role
      const feedRole = document.querySelector('div[role="feed"]');
      if (feedRole) return feedRole;

      // 2. Aria-label results containers (excluding detail panes)
      const feedSelectors = [
        'div[aria-label*="Results for" i]',
        'div[aria-label*="Résultats pour" i]',
        'div[aria-label*="Resultados de" i]',
        'div.m6QErb.DxyBCb:not(.W2btAe)',
        'div.section-layout.section-scrollbox',
        'div.m6QErb[role="feed"]'
      ];

      for (const sel of feedSelectors) {
        const el = document.querySelector(sel);
        if (el && !el.classList.contains('W2btAe')) return el;
      }

      // 3. Find parent of result cards
      const articles = document.querySelectorAll('div.Nv2PK, a.hfpxzc');
      if (articles.length > 0) {
        let parent = articles[0].parentElement;
        while (parent && parent !== document.body) {
          const cardCount = parent.querySelectorAll('div.Nv2PK, a.hfpxzc').length;
          if (cardCount >= 2) {
            return parent;
          }
          parent = parent.parentElement;
        }
        return articles[0].parentElement;
      }

      return null;
    }

    /**
     * Check if search results feed is currently visible in DOM
     */
    isResultsFeedVisible() {
      const feed = this.getResultsFeedContainer();
      if (!feed) {
        return document.querySelectorAll('div.Nv2PK, a.hfpxzc').length > 0;
      }
      const cards = feed.querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc');
      return cards.length > 0;
    }

    /**
     * Check if business detail view is currently open
     */
    isDetailPaneOpen() {
      const backBtn = this.getBackButton();
      if (backBtn) return true;

      const detailTitle = document.querySelector('h1.DUwDvf, div.TIHn2, div.m6QErb.W2btAe');
      return Boolean(detailTitle);
    }

    /**
     * Find back button to return to search results feed
     */
    getBackButton() {
      const selectors = [
        'button[aria-label="Back"]',
        'button[aria-label*="Back to results" i]',
        'button[aria-label*="Back to search results" i]',
        'button[aria-label*="Back to results list" i]',
        'button[aria-label="Retour"]',
        'button[aria-label="Volver"]',
        'button[jsaction*="pane.back"]',
        'button[jsaction*="pane.wf.back"]',
        'button.h3y1w',
        'button[data-tooltip*="Back" i]',
        'button.VfPpkd-icon-button[aria-label*="Back" i]',
        'button[data-item-id="back"]',
        'button[aria-label="Close"]'
      ];

      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          return btn;
        }
      }

      return null;
    }

    /**
     * Get all currently visible business cards inside the results feed
     */
    getResultItems() {
      const feed = this.getResultsFeedContainer();
      const rootEl = feed || document;

      const rawCards = Array.from(rootEl.querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc'));
      const uniqueItems = [];
      const seenNodes = new Set();

      for (let i = 0; i < rawCards.length; i++) {
        const node = rawCards[i];
        const cardContainer = node.closest('div.Nv2PK') || node.closest('div[role="article"]') || node;

        if (seenNodes.has(cardContainer)) continue;
        seenNodes.add(cardContainer);

        const clickable = cardContainer.querySelector('a.hfpxzc') || 
                          cardContainer.querySelector('a[href*="/maps/place/"]') || 
                          cardContainer.querySelector('.qBF1Pd') || 
                          cardContainer;

        const anchor = cardContainer.querySelector('a.hfpxzc, a[href*="/maps/place/"]');
        const mapsUrl = anchor ? anchor.href : '';

        // Extract title
        const name = this._getCardTitle(cardContainer);
        if (!name) continue;

        // Extract direct website if button present on card
        const directWebsiteEl = cardContainer.querySelector('a[data-value="Website"], a.lcr4fd, a[aria-label*="website" i]');
        let directWebsite = null;
        if (directWebsiteEl && directWebsiteEl.href) {
          const norm = root.LeadFinder?.Normalization;
          const href = directWebsiteEl.href;
          if (norm && typeof norm.isValidBusinessWebsite === 'function') {
            if (norm.isValidBusinessWebsite(href)) directWebsite = href;
          } else if (!href.includes('google.') && !href.includes('claim')) {
            directWebsite = href;
          }
        }

        // Extract card metadata (category, address snippet, phone snippet)
        const cardMeta = this.extractCardDirectData(cardContainer);

        let signature = '';
        if (mapsUrl && mapsUrl.includes('/place/')) {
          const match = mapsUrl.match(/\/place\/([^/@]+)/);
          signature = match ? `place:${decodeURIComponent(match[1]).toLowerCase()}` : `url:${mapsUrl.toLowerCase()}`;
        } else if (name) {
          const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanAddr = (cardMeta.address || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
          signature = `name:${cleanName}_${cleanAddr}`;
        } else {
          signature = `card_${i}`;
        }

        uniqueItems.push({
          index: i,
          container: cardContainer,
          clickable: clickable,
          name: name,
          mapsUrl: mapsUrl,
          directWebsite: directWebsite || cardMeta.website,
          category: cardMeta.category,
          phone: cardMeta.phone,
          address: cardMeta.address,
          rating: cardMeta.rating,
          reviewCount: cardMeta.reviewCount,
          signature: signature
        });
      }

      return uniqueItems;
    }

    _getCardTitle(card) {
      if (!card) return '';

      // Tier 1: Dedicated title class
      const qbf = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
      if (qbf && qbf.textContent.trim()) {
        return qbf.textContent.trim();
      }

      // Tier 2: Anchor aria-label
      const anchor = card.querySelector('a.hfpxzc, a[href*="/maps/place/"]');
      if (anchor && anchor.getAttribute('aria-label') && anchor.getAttribute('aria-label').trim()) {
        return anchor.getAttribute('aria-label').trim();
      }

      // Tier 3: Role heading or headline element
      const heading = card.querySelector('[role="heading"], h1, h2, h3, div.fontTitleMedium, div.fontHeadlineMedium');
      if (heading && heading.textContent.trim()) {
        return heading.textContent.trim();
      }

      // Tier 4: aria-label on card itself
      const cardAria = card.getAttribute('aria-label');
      if (cardAria && cardAria.trim()) {
        return cardAria.trim();
      }

      return '';
    }

    /**
     * Extract rich data directly from the card DOM container
     */
    extractCardDirectData(card) {
      let rating = null;
      let reviewCount = null;
      let category = '';
      let address = '';
      let phone = '';
      let website = null;

      // 1. Rating & Reviews
      const ratingEl = card.querySelector('span.MW4etd');
      if (ratingEl) {
        const r = parseFloat(ratingEl.textContent.trim().replace(',', '.'));
        if (!isNaN(r)) rating = r;
      }
      const reviewEl = card.querySelector('span.UY7F9');
      if (reviewEl) {
        const count = reviewEl.textContent.replace(/[^\d]/g, '');
        if (count) reviewCount = parseInt(count, 10);
      }

      // 2. Website Link
      const webEl = card.querySelector('a[data-value="Website"], a.lcr4fd, a[aria-label*="website" i]');
      if (webEl && webEl.href) {
        const norm = root.LeadFinder?.Normalization;
        const href = webEl.href;
        if (norm && typeof norm.isValidBusinessWebsite === 'function') {
          if (norm.isValidBusinessWebsite(href)) website = href;
        } else if (!href.includes('google.') && !href.includes('claim')) {
          website = href;
        }
      }

      // 3. Text lines inside W4Efsd (contains category, address, phone)
      const lines = Array.from(card.querySelectorAll('div.W4Efsd'));
      const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/;

      for (const line of lines) {
        const text = line.textContent.trim();
        if (!text) continue;

        // Check for phone
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch && !phone) {
          phone = phoneMatch[0].trim();
        }

        // Split by bullet / separator
        const parts = text.split(/·|•/).map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
          if (part.match(phoneRegex)) continue;
          if (part.match(/^(open|closed|closes|opens)/i)) continue;
          if (part.match(/^\d+(\.\d+)?\s*(\(\d+\))?$/)) continue; // rating numbers

          // If looks like a category (short text, no digits)
          if (!category && part.length < 35 && !part.match(/\d{2,}/)) {
            category = part;
          } else if (!address && part.length > 5 && (part.match(/\d/) || part.match(/st|ave|rd|blvd|dr|lane|way|ct|hwy|suite|ste/i))) {
            address = part;
          }
        }
      }

      return { rating, reviewCount, category, address, phone, website };
    }

    /**
     * Detect if Google Maps has presented a CAPTCHA or blocking restriction
     */
    detectAccessRestriction() {
      const captchaSelectors = [
        'form#captcha-form',
        'div.g-recaptcha',
        'iframe[src*="recaptcha"]',
        'iframe[src*="google.com/recaptcha"]',
        'div#recaptcha',
        'div.captcha-mid'
      ];

      for (const sel of captchaSelectors) {
        if (document.querySelector(sel)) {
          return {
            isRestricted: true,
            type: 'CAPTCHA',
            message: 'Google Maps presented a security verification prompt (CAPTCHA).'
          };
        }
      }

      const bodyText = document.body?.innerText?.toLowerCase() || '';
      if (bodyText.includes('unusual traffic from your computer network') || bodyText.includes('our systems have detected unusual traffic')) {
        return {
          isRestricted: true,
          type: 'UNUSUAL_TRAFFIC',
          message: 'Google detected unusual traffic. Please verify in the main window.'
        };
      }

      return { isRestricted: false };
    }

    /**
     * Check if "You've reached the end of the list" indicator is displayed
     */
    isEndOfResults() {
      const feed = this.getResultsFeedContainer();
      if (!feed) return false;

      const endSelectors = [
        'span.HlvSq',
        'div.PbZDve',
        'div.m6QErb.tLjsW',
        'p.fontBodyMedium'
      ];

      for (const sel of endSelectors) {
        const els = feed.querySelectorAll(sel);
        for (const el of els) {
          const text = (el.textContent || '').toLowerCase();
          if (
            text.includes("you've reached the end") ||
            text.includes("reached the end of the list") ||
            text.includes("no more results") ||
            text.includes("vous avez atteint la fin") ||
            text.includes("has llegado al final")
          ) {
            return true;
          }
        }
      }

      return false;
    }

    _sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.MapsDetector = MapsDetector;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
