/**
 * LeadFinder AI - Website Detection Engine
 * Determines whether a Google Maps business profile has a legitimate, official website.
 * Classifications: 'WEBSITE_FOUND' | 'NO_WEBSITE' | 'UNKNOWN'
 */

(function (root) {
  const STATUS = {
    WEBSITE_FOUND: 'WEBSITE_FOUND',
    NO_WEBSITE: 'NO_WEBSITE',
    UNKNOWN: 'UNKNOWN'
  };

  // Blacklist of third-party directories, social networks, search engines, and aggregators
  const EXCLUDED_DOMAINS = [
    // Google properties
    'google.com',
    'google.co',
    'maps.google.com',
    'goo.gl',
    'googleusercontent.com',
    'gstatic.com',

    // Social Media Platforms
    'facebook.com',
    'fb.me',
    'fb.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
    'pinterest.com',
    'threads.net',
    'snapchat.com',
    'whatsapp.com',
    'wa.me',

    // General Directories & Review Sites
    'yelp.com',
    'tripadvisor.com',
    'yellowpages.com',
    'yellowbook.com',
    'mapquest.com',
    'bbb.org',
    'foursquare.com',
    'superpages.com',
    'angi.com',
    'angieslist.com',
    'homeadvisor.com',
    'manta.com',
    'chamberofcommerce.com',
    'citysearch.com',
    'trustpilot.com',

    // Healthcare & Professional Directories
    'zocdoc.com',
    'healthgrades.com',
    'vitals.com',
    'findatopdoc.com',
    'ratemds.com',
    'webmd.com',
    'psychologytoday.com',
    'avvo.com',
    'justia.com',
    'lawyers.com',

    // Food & Delivery Aggregators
    'opentable.com',
    'resy.com',
    'doordash.com',
    'grubhub.com',
    'ubereats.com',
    'postmates.com',
    'seamless.com',
    'menufy.com',
    'chownow.com',
    'slice.com',
    'toasttab.com' // Often used purely for online ordering rather than primary website
  ];

  class WebsiteDetector {
    constructor() {
      this.excludedDomains = new Set(EXCLUDED_DOMAINS);
    }

    /**
     * Test if a given domain or URL belongs to the excluded/directory blacklist
     */
    isExcludedDomain(url) {
      if (!url) return true;
      const norm = root.LeadFinder?.Normalization;
      if (norm && typeof norm.isValidBusinessWebsite === 'function') {
        if (!norm.isValidBusinessWebsite(url)) {
          return true;
        }
      }

      const domain = norm ? norm.extractDomain(url) : this._extractDomainFallback(url);
      if (!domain) return true;

      // Direct match or subdomain match
      for (const excluded of this.excludedDomains) {
        if (domain === excluded || domain.endsWith('.' + excluded)) {
          return true;
        }
      }
      return false;
    }

    _extractDomainFallback(url) {
      try {
        let u = url.trim();
        if (!u.match(/^https?:\/\//i)) u = 'https://' + u;
        const parsed = new URL(u);
        return parsed.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return '';
      }
    }

    /**
     * Inspect a Google Maps place detail pane and determine website presence
     * @param {Element|Document} detailContainer - The DOM element containing the business details
     * @returns {{ status: string, url: string|null, reason: string, isDirectory: boolean }}
     */
    detectWebsite(detailContainer) {
      if (!detailContainer) {
        return {
          status: STATUS.UNKNOWN,
          url: null,
          reason: 'Detail container element not found or closed',
          isDirectory: false
        };
      }

      const norm = root.LeadFinder?.Normalization;
      let rawCandidateUrl = null;
      let detectionStrategy = '';

      // --- STRATEGY 1: Direct Authority Button / Link ---
      const authoritySelectors = [
        'a[data-item-id="authority"]',
        'button[data-item-id="authority"]',
        'a[data-tooltip*="website" i]',
        'a[data-tooltip*="Website" i]',
        'a[aria-label*="website" i]',
        'a[aria-label*="Website" i]',
        'a[aria-label*="site web" i]',
        'a[aria-label*="sitio web" i]',
        'a[data-item-id*="authority"]',
        '[data-value="Website"] a',
        'a[data-value="Website"]'
      ];

      for (const selector of authoritySelectors) {
        const el = detailContainer.querySelector(selector);
        if (el) {
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const text = (el.textContent || '').toLowerCase();
          if (aria.includes('claim') || aria.includes('own this') || text.includes('claim') || text.includes('own this')) {
            continue;
          }

          const href = el.getAttribute('href') || el.dataset.url || el.getAttribute('data-href');
          if (href && href !== '#' && !href.startsWith('javascript:')) {
            if (!this.isExcludedDomain(href)) {
              rawCandidateUrl = href;
              detectionStrategy = `Authority Selector: ${selector}`;
              break;
            }
          }
        }
      }

      // --- STRATEGY 2: Globe Icon / Action Row Search ---
      if (!rawCandidateUrl) {
        // Look for action buttons containing the website globe icon SVG path
        // Google Maps uses specific SVG or class for Website action button
        const actionLinks = Array.from(detailContainer.querySelectorAll('a[href^="http"], a[href^="https"], a[data-url]'));
        for (const link of actionLinks) {
          const text = (link.textContent || '').trim().toLowerCase();
          const aria = (link.getAttribute('aria-label') || '').toLowerCase();
          const href = link.getAttribute('href') || link.dataset.url || '';

          // Skip maps internal URLs and photos/reviews
          if (href.includes('/maps/') || href.includes('google.com/maps') || href.includes('search?q=')) {
            continue;
          }

          // Check for explicit "website" keyword in text or aria-label
          if (aria.includes('website') || aria.includes('site web') || text.includes('website') || text.includes('.com') || text.includes('.org') || text.includes('.net') || text.includes('.io')) {
            rawCandidateUrl = href;
            detectionStrategy = 'Action Link text/aria analysis';
            break;
          }

          // Check if parent or sibling has website indicator
          const parentItem = link.closest('[data-item-id]');
          if (parentItem && parentItem.getAttribute('data-item-id')?.includes('authority')) {
            rawCandidateUrl = href;
            detectionStrategy = 'Parent authority attribute';
            break;
          }
        }
      }

      // --- STRATEGY 3: Detail Info Rows / List Items ---
      if (!rawCandidateUrl) {
        const infoButtons = Array.from(detailContainer.querySelectorAll('button[data-item-id], a[data-item-id], div.Io6YTe, div.RgiJu'));
        for (const item of infoButtons) {
          const itemId = item.getAttribute('data-item-id') || '';
          if (itemId === 'authority' || itemId.includes('website')) {
            const link = item.closest('a') || item.querySelector('a');
            if (link && link.href) {
              rawCandidateUrl = link.href;
              detectionStrategy = 'Info row itemId';
              break;
            }
          }
        }
      }

      // --- EVALUATE CANDIDATE URL ---
      if (rawCandidateUrl) {
        const cleanedUrl = norm ? norm.normalizeWebsiteUrl(rawCandidateUrl) : rawCandidateUrl;

        // Check if candidate is an excluded directory or social media
        if (this.isExcludedDomain(cleanedUrl)) {
          return {
            status: STATUS.NO_WEBSITE,
            url: null,
            candidateUrl: cleanedUrl,
            reason: `Filtered out directory/social link (${cleanedUrl})`,
            isDirectory: true
          };
        }

        return {
          status: STATUS.WEBSITE_FOUND,
          url: cleanedUrl,
          reason: `Valid official website identified via ${detectionStrategy}`,
          isDirectory: false
        };
      }

      // --- NEGATIVE VERIFICATION: Check if Profile Loaded Properly ---
      // We must make sure the business detail view is genuinely open (contains name, address or phone or hours)
      const hasTitle = Boolean(
        detailContainer.querySelector('h1') ||
        detailContainer.querySelector('.DUwDvf') ||
        detailContainer.querySelector('[role="main"] h1')
      );

      const hasActionPanel = Boolean(
        detailContainer.querySelector('[data-item-id]') ||
        detailContainer.querySelector('button[data-tooltip]') ||
        detailContainer.querySelector('.m6QErb')
      );

      if (hasTitle && hasActionPanel) {
        // Detail panel rendered reliably, but has no website link
        return {
          status: STATUS.NO_WEBSITE,
          url: null,
          reason: 'Business profile confirmed with no website link listed',
          isDirectory: false
        };
      }

      // If neither website nor full profile markers could be confirmed
      return {
        status: STATUS.UNKNOWN,
        url: null,
        reason: 'Detail pane not fully populated or ambiguous layout',
        isDirectory: false
      };
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.WebsiteDetector = WebsiteDetector;
  root.LeadFinder.WEBSITE_STATUS = STATUS;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
