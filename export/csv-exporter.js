/**
 * LeadFinder AI - CSV Exporter
 * Generates RFC-4180 compliant CSV files with UTF-8 BOM encoding for seamless
 * compatibility with Microsoft Excel, Google Sheets, and LibreOffice.
 */

(function (root) {
  class CsvExporter {
    constructor() {
      this.headers = [
        'Business Name',
        'Website',
        'Website Status',
        'Phone',
        'Rating',
        'Reviews',
        'Category',
        'Address',
        'Outreach Pitch Hook',
        'Google Maps URL',
        'Search Query',
        'Extracted At'
      ];
    }

    /**
     * Escape single cell value according to RFC 4180 and sanitize against CSV Formula Injection (CWE-1236)
     */
    escapeValue(val) {
      if (val === null || val === undefined) return '';
      let str = String(val);

      // Sanitize CSV Formula Injection / DDE Injection (starts with =, +, -, @, \t, \r, |, %)
      if (/^[=+\-@\t\r|%]/.test(str)) {
        str = `'${str}`;
      }

      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    /**
     * Map a lead item to CSV row
     */
    leadToRow(lead) {
      const hasWebsite = Boolean(lead.website && lead.website !== 'No Website');
      const websiteStatus = hasWebsite ? 'HAS_WEBSITE' : 'NO_WEBSITE';

      return [
        this.escapeValue(lead.businessName),
        this.escapeValue(lead.website || ''),
        this.escapeValue(lead.websiteStatus || websiteStatus),
        this.escapeValue(lead.phone ? `'${lead.phone}` : ''), // Prefix with single quote so Excel preserves phone formatting
        this.escapeValue(lead.rating !== null && lead.rating !== undefined ? lead.rating : ''),
        this.escapeValue(lead.reviewCount !== null && lead.reviewCount !== undefined ? lead.reviewCount : ''),
        this.escapeValue(lead.category || ''),
        this.escapeValue(lead.address || ''),
        this.escapeValue(lead.pitchHook || ''),
        this.escapeValue(lead.mapsUrl || ''),
        this.escapeValue(lead.searchQuery || ''),
        this.escapeValue(lead.extractedAt || '')
      ].join(',');
    }

    /**
     * Generate complete CSV text content
     */
    generateCsv(leads = []) {
      const headerRow = this.headers.map(h => `"${h}"`).join(',');
      const dataRows = leads.map(lead => this.leadToRow(lead));
      // Prepend UTF-8 BOM (\uFEFF) for Excel unicode compatibility
      return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
    }

    /**
     * Generate standardized filename with BizGuides branding
     */
    generateFileName(searchQuery = '', filterType = 'leads') {
      const dateStr = new Date().toISOString().slice(0, 10);
      const cleanQuery = (searchQuery || 'google-maps')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'leads';
      
      const cleanFilter = (filterType || 'all')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

      return `bizguides-${cleanQuery}-${cleanFilter}-${dateStr}.csv`;
    }

    /**
     * Trigger browser download of CSV file
     */
    downloadCsv(leads = [], searchQuery = '', filterType = 'leads') {
      const csvContent = this.generateCsv(leads);
      const filename = this.generateFileName(searchQuery, filterType);

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      return filename;
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.CsvExporter = CsvExporter;
  root.LeadFinder.csvExporter = new CsvExporter();
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
