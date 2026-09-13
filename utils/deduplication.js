/**
 * LeadFinder AI - Deduplication Engine
 * Identifies duplicate businesses across extraction runs using composite keys.
 */

(function (root) {
  class Deduplicator {
    constructor() {
      // Sets of seen keys
      this.placeKeys = new Set();
      this.namePhoneKeys = new Set();
      this.nameAddressKeys = new Set();
      this.nameOnlyKeys = new Set();
    }

    /**
     * Clear all stored deduplication keys
     */
    reset() {
      this.placeKeys.clear();
      this.namePhoneKeys.clear();
      this.nameAddressKeys.clear();
      this.nameOnlyKeys.clear();
    }

    /**
     * Seed existing leads into deduplicator
     */
    seed(leads = []) {
      leads.forEach(lead => this.register(lead));
    }

    /**
     * Generate fingerprints for a lead item
     */
    generateKeys(lead) {
      const norm = (root.LeadFinder && root.LeadFinder.Normalization) || {
        canonicalBusinessName: s => (s || '').toLowerCase().trim(),
        canonicalPhone: s => (s || '').replace(/\D/g, ''),
        canonicalAddress: s => (s || '').toLowerCase().trim(),
        normalizeMapsUrl: s => s || ''
      };

      const keys = {
        placeKey: null,
        namePhoneKey: null,
        nameAddressKey: null,
        nameOnlyKey: null
      };

      const cName = norm.canonicalBusinessName(lead.businessName);
      const cPhone = norm.canonicalPhone(lead.phone);
      const cAddress = norm.canonicalAddress(lead.address);
      const cMapsUrl = norm.normalizeMapsUrl(lead.mapsUrl);

      // 1. Google Maps Place Key (Feature ID / CID / Coordinates)
      if (lead.placeId) {
        keys.placeKey = `place_id:${lead.placeId}`;
      } else if (cMapsUrl) {
        const fidMatch = cMapsUrl.match(/fid:([^/]+)/) || cMapsUrl.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/) || cMapsUrl.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/);
        if (fidMatch && fidMatch[1]) {
          keys.placeKey = `fid:${fidMatch[1]}`;
        } else if (cMapsUrl.includes('@')) {
          keys.placeKey = `maps_url:${cMapsUrl}`;
        }
      }

      // 2. Name + Phone Key (very strong identifier)
      if (cName && cPhone && cPhone.length >= 7) {
        keys.namePhoneKey = `np:${cName}|${cPhone}`;
      }

      // 3. Name + Address Key (strong identifier within city)
      if (cName && cAddress && cAddress.length >= 6) {
        keys.nameAddressKey = `na:${cName}|${cAddress}`;
      }

      return keys;
    }

    /**
     * Check if a lead is already known/seen
     */
    isDuplicate(lead) {
      const keys = this.generateKeys(lead);

      // Primary check: Maps Place key
      if (keys.placeKey && this.placeKeys.has(keys.placeKey)) {
        return true;
      }

      // Secondary check: Name + Phone
      if (keys.namePhoneKey && this.namePhoneKeys.has(keys.namePhoneKey)) {
        return true;
      }

      // Tertiary check: Name + Address
      if (keys.nameAddressKey && this.nameAddressKeys.has(keys.nameAddressKey)) {
        return true;
      }

      return false;
    }

    /**
     * Register a lead to mark it as seen
     */
    register(lead) {
      const keys = this.generateKeys(lead);

      if (keys.placeKey) {
        this.placeKeys.add(keys.placeKey);
      }
      if (keys.namePhoneKey) {
        this.namePhoneKeys.add(keys.namePhoneKey);
      }
      if (keys.nameAddressKey) {
        this.nameAddressKeys.add(keys.nameAddressKey);
      }
      if (keys.nameOnlyKey) {
        this.nameOnlyKeys.add(keys.nameOnlyKey);
      }
    }

    /**
     * Get unique signature ID for a lead
     */
    getUniqueId(lead) {
      const keys = this.generateKeys(lead);
      if (keys.placeKey) return keys.placeKey;
      if (keys.namePhoneKey) return keys.namePhoneKey;
      if (keys.nameAddressKey) return keys.nameAddressKey;
      return `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.Deduplicator = Deduplicator;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
