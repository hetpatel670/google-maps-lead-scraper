/**
 * LeadFinder AI - Normalization Utilities
 * Handles text, phone, URL, address, and business name normalization for robust extraction and deduplication.
 */

(function (root) {
  const Normalization = {
    /**
     * Normalize generic whitespace and trim
     */
    cleanText(str) {
      if (!str || typeof str !== 'string') return '';
      return str
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
        .replace(/\s+/g, ' ')                  // Collapse multiple spaces/newlines into one
        .trim();
    },

    /**
     * Normalize business name for display and comparison
     */
    normalizeBusinessName(name) {
      if (!name) return '';
      let cleaned = this.cleanText(name);
      return cleaned;
    },

    /**
     * Compute a canonical key from business name for deduplication
     * Strips legal suffixes (LLC, Inc, Ltd, etc.), punctuation, and lowercases.
     */
    canonicalBusinessName(name) {
      if (!name) return '';
      let cleaned = this.normalizeBusinessName(name).toLowerCase();
      // Remove common legal entity suffixes
      cleaned = cleaned.replace(/\b(llc|inc|corp|corporation|ltd|limited|co|company|pc|pllc|group|services|llp|gmbh)\b/gi, '');
      // Remove punctuation and special symbols
      cleaned = cleaned.replace(/[^\w\s]/gi, '');
      // Collapse whitespace
      return cleaned.replace(/\s+/g, ' ').trim();
    },

    /**
     * Normalize phone numbers for display, preserving human formatting
     */
    normalizePhone(phone) {
      if (!phone) return '';
      let cleaned = this.cleanText(phone);
      // Strip 'phone:tel:' or 'tel:' prefix if present
      cleaned = cleaned.replace(/^phone:tel:/i, '').replace(/^tel:/i, '').trim();
      return cleaned;
    },

    /**
     * Canonical phone key for deduplication (only numbers, last 10 digits if available)
     */
    canonicalPhone(phone) {
      if (!phone) return '';
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        return digitsOnly.slice(-10); // Standardize on last 10 digits
      }
      return digitsOnly;
    },

    /**
     * Normalize address string
     */
    normalizeAddress(address) {
      if (!address) return '';
      let cleaned = this.cleanText(address);
      // Remove country codes or duplicate spacing
      cleaned = cleaned.replace(/^·\s*/, ''); // Remove bullet prefixes sometimes in Google Maps
      return cleaned;
    },

    /**
     * Canonical address key for deduplication
     */
    canonicalAddress(address) {
      if (!address) return '';
      let cleaned = this.normalizeAddress(address).toLowerCase();
      // Abbreviate common road types
      cleaned = cleaned
        .replace(/\bstreet\b/g, 'st')
        .replace(/\bavenue\b/g, 'ave')
        .replace(/\bboulevard\b/g, 'blvd')
        .replace(/\broad\b/g, 'rd')
        .replace(/\bdrive\b/g, 'dr')
        .replace(/\blane\b/g, 'ln')
        .replace(/\bsuite\b/g, 'ste')
        .replace(/\bbuilding\b/g, 'bldg')
        .replace(/\bapartment\b/g, 'apt')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned;
    },

    /**
     * Normalize Google Maps URL
     * Preserves place identifier, coordinates, or unique feature tokens.
     */
    normalizeMapsUrl(url) {
      if (!url) return '';
      try {
        const parsed = new URL(url, 'https://www.google.com');
        // If there's a feature ID in data params, keep origin + path + data
        const featureIdMatch = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/) || url.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/);
        if (featureIdMatch && featureIdMatch[1]) {
          return `https://www.google.com/maps/place/fid:${featureIdMatch[1]}`;
        }
        // Extract place path with coordinates if available
        const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        const match = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
        if (match && match[1]) {
          const coordPart = coordMatch ? `@${coordMatch[1]},${coordMatch[2]}` : '';
          return `https://www.google.com/maps/place/${match[1]}/${coordPart}`;
        }
        return parsed.origin + parsed.pathname;
      } catch {
        return url.split('?')[0];
      }
    },

    /**
     * Clean and normalize a website URL
     */
    normalizeWebsiteUrl(url) {
      if (!url) return '';
      let cleaned = url.trim();

      // Handle google redirect wrapper URLs (e.g., https://www.google.com/url?q=https://example.com)
      if (cleaned.includes('google.com/url') || cleaned.includes('/url?q=')) {
        try {
          const parsed = new URL(cleaned, 'https://www.google.com');
          const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
          if (target) cleaned = target;
        } catch {}
      }

      // Add https protocol if missing
      if (!cleaned.match(/^https?:\/\//i)) {
        cleaned = 'https://' + cleaned;
      }

      try {
        const parsed = new URL(cleaned);
        // Strip common tracking queries
        const searchParams = new URLSearchParams(parsed.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(p => searchParams.delete(p));
        
        parsed.search = searchParams.toString();
        // Remove trailing slash if path is just /
        let res = parsed.toString();
        if (res.endsWith('/') && parsed.pathname === '/') {
          res = res.slice(0, -1);
        }
        return res;
      } catch {
        return cleaned;
      }
    },

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
      if (!url) return '';
      try {
        let target = url;
        if (!target.match(/^https?:\/\//i)) target = 'https://' + target;
        const parsed = new URL(target);
        return parsed.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return '';
      }
    },

    /**
     * Strictly validates whether a URL is a genuine official business website.
     * Rejects Google internal/claim links, administrative URLs, and non-official websites.
     */
    isValidBusinessWebsite(url) {
      if (!url || typeof url !== 'string') return false;
      const cleaned = url.trim();
      if (!cleaned || cleaned === '#' || cleaned === 'No Website' || cleaned.startsWith('javascript:')) {
        return false;
      }

      const lower = cleaned.toLowerCase();

      // Explicit Google internal / claim / administrative filters
      if (
        lower.includes('business.google.com') ||
        lower.includes('google.com/business') ||
        lower.includes('google.com/maps') ||
        lower.includes('maps.google.com') ||
        lower.includes('google.com/search') ||
        lower.includes('google.com/url') ||
        lower.includes('google.com/local') ||
        lower.includes('google.com/intl') ||
        lower.includes('accounts.google.com') ||
        lower.includes('support.google.com') ||
        lower.includes('gstatic.com') ||
        lower.includes('goo.gl') ||
        lower.includes('googleusercontent.com') ||
        lower.includes('business.site') ||
        lower.includes('claimbz') ||
        lower.includes('getstarted') ||
        lower.includes('/create?fp=') ||
        lower.includes('service=ome')
      ) {
        return false;
      }

      const domain = this.extractDomain(cleaned);
      if (!domain) return false;

      // Reject all Google domain variants worldwide (google.com, google.co.uk, google.com.au, google.in, etc.)
      if (/^([a-z0-9-]+\.)?google\.[a-z]{2,}(\.[a-z]{2})?$/i.test(domain) || domain === 'google' || domain.includes('google.')) {
        return false;
      }

      // Reject Social Media Profiles & General Directories (these are not official standalone websites)
      const nonWebDomains = [
        'facebook.com', 'fb.me', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
        'linkedin.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com',
        'yelp.com', 'yellowpages.com', 'tripadvisor.com', 'mapquest.com', 'bbb.org'
      ];
      for (const d of nonWebDomains) {
        if (domain === d || domain.endsWith('.' + d)) {
          return false;
        }
      }

      const parts = domain.split('.');
      if (parts.length < 2 || parts[parts.length - 1].length < 2) {
        return false;
      }

      return true;
    }
  };

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.Normalization = Normalization;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
