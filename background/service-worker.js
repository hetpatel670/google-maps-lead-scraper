/**
 * LeadFinder AI - Background Service Worker (Manifest V3)
 * Coordinates Google Maps extraction, non-active background tab detail parsing,
 * website screenshot capture, and Gemini Multimodal Vision AI auditing.
 */

// Load utility modules
try {
  importScripts(
    '../utils/logger.js',
    '../utils/normalization.js',
    '../utils/deduplication.js',
    '../utils/location-matrix.js',
    '../storage/storage-manager.js'
  );
} catch (e) {
  console.warn('[LeadFinder] Service worker importScripts:', e);
}

// Enable Side Panel to open automatically when user clicks extension icon in toolbar
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('SidePanel setPanelBehavior error:', error));

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[LeadFinder AI] Extension installed/updated:', details.reason);
});

// Notify Side Panel when user navigates or performs a new search on Google Maps
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.url && (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com'))) {
      chrome.runtime.sendMessage({
        type: 'LEADFINDER_TAB_NAVIGATED',
        payload: { tabId, url: tab.url }
      }).catch(() => {});
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com'))) {
      chrome.runtime.sendMessage({
        type: 'LEADFINDER_TAB_NAVIGATED',
        payload: { tabId: activeInfo.tabId, url: tab.url }
      }).catch(() => {});
    }
  } catch {}
});

// Main Message Routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Security: Ensure message originates from extension's own execution context
  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'Unauthorized sender context' });
    return false;
  }

  // 1. FAST BACKGROUND TAB LEAD DETAIL EXTRACTION
  if (message.target === 'SERVICE_WORKER' && message.type === 'LEADFINDER_EXTRACT_TAB') {
    (async () => {
      const { mapsUrl, cardData, options } = message.payload || {};
      if (!mapsUrl || (!mapsUrl.includes('google.com/maps') && !mapsUrl.includes('maps.google.com'))) {
        sendResponse({ ok: true, lead: cardData });
        return;
      }

      try {
        const extractedLead = await extractBusinessInNewTab(mapsUrl, cardData);

        // Generate AI / Fast pitch hook
        if (self.LeadFinder && self.LeadFinder.locationMatrix) {
          extractedLead.pitchHook = await self.LeadFinder.locationMatrix.generatePitchHook(
            extractedLead,
            options?.apiKey || ''
          );
        }

        sendResponse({ ok: true, lead: extractedLead });
      } catch (err) {
        if (self.LeadFinder && self.LeadFinder.logger) {
          self.LeadFinder.logger.warn('Extraction tab error', err);
        }
        sendResponse({ ok: true, lead: cardData });
      }
    })();
    return true; // Async reply
  }

  // 2. NAVIGATE TAB TO NEXT MULTI-LOCATION SEARCH
  if (message.target === 'SERVICE_WORKER' && message.type === 'LEADFINDER_NAVIGATE_TAB') {
    (async () => {
      const { tabId, targetUrl } = message.payload || {};
      if (!targetUrl || (!targetUrl.includes('google.com/maps') && !targetUrl.includes('maps.google.com'))) {
        sendResponse({ ok: false, error: 'Invalid or non-Google Maps target URL' });
        return;
      }

      try {
        let activeTabId = tabId || sender.tab?.id;
        if (!activeTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          activeTabId = activeTab?.id;
        }

        if (!activeTabId) {
          sendResponse({ ok: false, error: 'No active Google Maps tab found' });
          return;
        }

        await chrome.tabs.update(activeTabId, { url: targetUrl });
        
        // Wait for tab to complete loading
        const onUpdatedListener = (updatedTabId, info) => {
          if (updatedTabId === activeTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
            setTimeout(() => {
              sendResponse({ ok: true, navigated: true });
            }, 1200); // Allow Google Maps feed to settle
          }
        };

        chrome.tabs.onUpdated.addListener(onUpdatedListener);

        // Safety timeout (8s max)
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          sendResponse({ ok: true, timeout: true });
        }, 8000);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. FORWARD MESSAGE TO CONTENT SCRIPT IN ACTIVE TAB
  if (message.target === 'CONTENT_SCRIPT') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          sendResponse({ ok: false, error: 'No active Google Maps tab found' });
          return;
        }

        if (!activeTab.url || (!activeTab.url.includes('google.com/maps') && !activeTab.url.includes('maps.google.com'))) {
          sendResponse({ ok: false, isNotMaps: true, error: 'Current active tab is not Google Maps' });
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, message.data, (response) => {
          if (chrome.runtime?.lastError) {
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
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
              chrome.tabs.sendMessage(activeTab.id, message.data, (retryResponse) => {
                sendResponse(retryResponse || { ok: true, injected: true });
              });
            }).catch(injectErr => {
              sendResponse({ ok: false, error: injectErr.message });
            });
          } else {
            sendResponse(response);
          }
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

/**
 * Fast Business Detail Extractor via Non-Active Background Tab
 */
async function extractBusinessInNewTab(mapsUrl, fallbackCardData = {}) {
  let createdTab = null;

  try {
    createdTab = await chrome.tabs.create({
      url: mapsUrl,
      active: false
    });

    const tabId = createdTab.id;
    const detailData = await pollAndExtractFromTab(tabId);

    if (detailData && detailData.businessName) {
      const hasWeb = Boolean(detailData.website && detailData.website !== 'No Website');
      return {
        ...fallbackCardData,
        ...detailData,
        businessName: detailData.businessName || fallbackCardData.businessName,
        phone: detailData.phone || fallbackCardData.phone || '',
        address: detailData.address || fallbackCardData.address || '',
        website: hasWeb ? detailData.website : (fallbackCardData.website || null),
        websiteStatus: hasWeb ? 'HAS_WEBSITE' : (fallbackCardData.website ? 'HAS_WEBSITE' : 'NO_WEBSITE'),
        rating: detailData.rating !== null ? detailData.rating : fallbackCardData.rating,
        reviewCount: detailData.reviewCount !== null ? detailData.reviewCount : fallbackCardData.reviewCount
      };
    }

    return fallbackCardData;
  } catch (err) {
    if (self.LeadFinder && self.LeadFinder.logger) {
      self.LeadFinder.logger.warn('Error during background tab extraction:', err);
    }
    return fallbackCardData;
  } finally {
    if (createdTab && createdTab.id) {
      try { await chrome.tabs.remove(createdTab.id); } catch {}
    }
  }
}

/**
 * Poll DOM inside Google Maps Background Tab
 */
async function pollAndExtractFromTab(tabId) {
  const MAX_ATTEMPTS = 12; // ~2.4s max
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, 200));

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: injectedFastParser
      });

      if (results && results[0] && results[0].result) {
        const res = results[0].result;
        if (res.businessName && (res.hasDetails || attempt >= 4)) {
          return res;
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Fast Pure DOM Parser Injected into Google Maps Tab
 */
function injectedFastParser() {
  try {
    let businessName = '';
    const nameSelectors = ['h1.DUwDvf', 'h1.fontHeadlineLarge', 'div[role="main"] h1', '.DUwDvf', 'h1'];
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        businessName = el.textContent.trim();
        break;
      }
    }

    if (!businessName) {
      return { businessName: '', hasDetails: false };
    }

    let category = '';
    const catEl = document.querySelector('button.DkEaL, button[jsaction*="category"], span.DkEaL, .fontBodyMedium button');
    if (catEl && catEl.textContent.trim()) {
      category = catEl.textContent.trim();
    }

    let rating = null;
    let reviewCount = null;
    const ratingEl = document.querySelector('span.MW4etd, div.F7nice span[aria-hidden="true"], span.fontDisplayLarge');
    if (ratingEl) {
      const r = parseFloat(ratingEl.textContent.trim().replace(',', '.'));
      if (!isNaN(r)) rating = r;
    }
    const reviewEl = document.querySelector('span.UY7F9, div.F7nice span:not([aria-hidden="true"])');
    if (reviewEl) {
      const count = reviewEl.textContent.replace(/[^\d]/g, '');
      if (count) reviewCount = parseInt(count, 10);
    }

    let phone = '';
    const phoneBtn = document.querySelector('button[data-item-id^="phone:"], button[data-item-id*="phone"], button[aria-label*="Phone:" i], button[aria-label*="Téléphone" i], button[aria-label*="Teléfono" i]');
    if (phoneBtn) {
      const text = phoneBtn.querySelector('div.Io6YTe, span.fontBodyMedium, span')?.textContent || phoneBtn.textContent;
      if (text && text.trim() && text.match(/\d/)) {
        phone = text.trim();
      } else {
        const rawItemId = phoneBtn.getAttribute('data-item-id') || '';
        if (rawItemId.startsWith('phone:tel:')) {
          phone = rawItemId.replace('phone:tel:', '').trim();
        }
      }
    }
    if (!phone) {
      const infoRows = Array.from(document.querySelectorAll('div.Io6YTe, span.LrzXr'));
      const phoneRegex = /^(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}$/;
      for (const row of infoRows) {
        const text = (row.textContent || '').trim();
        if (text.includes('+') && text.length < 10) continue; // Skip Plus Codes
        if (text.match(/^(open|closed|mon|tue|wed|thu|fri|sat|sun|located|vic|nsw|qld|wa|sa|tas|act|nt|ny|ca|tx|fl)/i)) continue;
        if (text.length >= 8 && text.length <= 25 && phoneRegex.test(text.replace(/\s+/g, ' '))) {
          phone = text;
          break;
        }
      }
    }

    let address = '';
    const addressBtn = document.querySelector('button[data-item-id="address"], button[data-item-id*="address"], button[aria-label*="Address:" i], button[aria-label*="Adresse" i], button[aria-label*="Dirección" i]');
    if (addressBtn) {
      const text = addressBtn.querySelector('div.Io6YTe')?.textContent || addressBtn.textContent;
      if (text && text.trim()) address = text.trim();
    }
    if (!address) {
      const firstInfoRow = document.querySelector('div.RgiJu div.Io6YTe, button.CsEnBe div.Io6YTe');
      if (firstInfoRow && firstInfoRow.textContent.trim()) {
        const text = firstInfoRow.textContent.trim();
        if (!text.match(/\.(com|org|net|io|gov)/i) && !text.match(/^(\+\d|\(\d{3}\))/)) {
          address = text;
        }
      }
    }

    // Comprehensive Website Extraction Strategies with Strict Claim/Google Filtering
    let website = null;

    function isPureBusinessWebsite(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return false;
      const u = rawUrl.trim().toLowerCase();
      if (!u.startsWith('http://') && !u.startsWith('https://')) return false;

      // Reject all Google administrative, claim, and internal URLs
      if (
        u.includes('business.google.com') ||
        u.includes('google.com/business') ||
        u.includes('google.com/maps') ||
        u.includes('maps.google.com') ||
        u.includes('google.com/search') ||
        u.includes('google.com/url') ||
        u.includes('google.com/local') ||
        u.includes('google.com/intl') ||
        u.includes('accounts.google.com') ||
        u.includes('support.google.com') ||
        u.includes('gstatic.com') ||
        u.includes('goo.gl') ||
        u.includes('googleusercontent.com') ||
        u.includes('business.site') ||
        u.includes('claimbz') ||
        u.includes('getstarted') ||
        u.includes('/create?fp=') ||
        u.includes('service=ome') ||
        u.includes('google.')
      ) {
        return false;
      }

      // Reject social media and directory platforms
      if (
        u.includes('facebook.com') ||
        u.includes('fb.me') ||
        u.includes('instagram.com') ||
        u.includes('twitter.com') ||
        u.includes('x.com') ||
        u.includes('linkedin.com') ||
        u.includes('yelp.com') ||
        u.includes('yellowpages.com') ||
        u.includes('tripadvisor.com') ||
        u.includes('mapquest.com')
      ) {
        return false;
      }

      return true;
    }

    const authoritySelectors = [
      'a[data-item-id="authority"]',
      'div[data-item-id="authority"] a',
      'button[data-item-id="authority"]',
      'a[data-tooltip*="website" i]',
      'a[data-tooltip*="site web" i]',
      'a[aria-label*="website" i]',
      'a[aria-label*="site web" i]',
      'a[aria-label*="sitio web" i]',
      'a[data-item-id*="authority"]',
      '[data-value="Website"] a',
      'a[data-value="Website"]'
    ];

    for (const sel of authoritySelectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Ignore "Claim this business" or edit actions
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const text = (el.textContent || '').toLowerCase();
        if (aria.includes('claim') || aria.includes('own this') || text.includes('claim') || text.includes('own this')) {
          continue;
        }

        let href = el.getAttribute('href') || el.dataset.url || el.getAttribute('data-href') || el.getAttribute('data-attribution-url');
        if (href && href !== '#' && !href.startsWith('javascript:')) {
          if (href.includes('google.com/url') || href.includes('/url?q=')) {
            try {
              const p = new URL(href, 'https://www.google.com');
              href = p.searchParams.get('q') || p.searchParams.get('url') || href;
            } catch {}
          }
          if (isPureBusinessWebsite(href)) {
            website = href;
            break;
          }
        }
      }
    }

    // Strategy 2: Check any external link in place panel
    if (!website) {
      const links = Array.from(document.querySelectorAll('a[href^="http://"], a[href^="https://"]'));
      for (const link of links) {
        const href = link.href || '';
        if (!isPureBusinessWebsite(href)) continue;

        const aria = (link.getAttribute('aria-label') || '').toLowerCase();
        const text = (link.textContent || '').trim().toLowerCase();

        // Ignore claim / manage links
        if (aria.includes('claim') || aria.includes('own this') || text.includes('claim') || text.includes('own this')) {
          continue;
        }

        if (aria.includes('website') || aria.includes('site') || text.includes('website') || text.includes('.com') || text.includes('.org') || text.includes('.net') || text.includes('.co')) {
          website = href;
          break;
        }
      }
    }

    // Strategy 3: Check info text rows for domain names
    if (!website) {
      const infoRows = Array.from(document.querySelectorAll('div.Io6YTe, div.rogA2c, span.LrzXr'));
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/;
      for (const row of infoRows) {
        const text = (row.textContent || '').trim();
        if (domainRegex.test(text) && !text.includes('google.') && !text.includes('@') && !text.includes('claim')) {
          const candidate = 'https://' + text;
          if (isPureBusinessWebsite(candidate)) {
            website = candidate;
            break;
          }
        }
      }
    }

    const websiteStatus = website ? 'HAS_WEBSITE' : 'NO_WEBSITE';
    const hasDetails = Boolean(phone || address || website || document.querySelector('[data-item-id]'));

    return {
      businessName,
      category,
      phone,
      address,
      website,
      websiteStatus,
      rating,
      reviewCount,
      hasDetails
    };
  } catch (err) {
    return { businessName: '', hasDetails: false, error: err.message };
  }
}

/**
 * Fast Website Quality & Vision AI Auditor
 */
async function auditLeadWebsite(lead, options = {}) {
  if (!lead) return lead;

  const websiteUrl = lead.website;
  const businessName = lead.businessName || 'Business';

  // If no website or verified NO_WEBSITE
  if (!websiteUrl || lead.websiteStatus === 'NO_WEBSITE') {
    return {
      ...lead,
      visualStatus: 'NO_WEBSITE',
      visualScore: 0,
      visualFlaws: ['No website listed on Google profile'],
      pitchHook: `Build a brand-new, modern mobile-responsive website for ${businessName} to capture local search traffic.`,
      isHttps: false,
      hasMobileViewport: false,
      copyrightYear: null
    };
  }

  // If Vision AI is requested and API key provided, capture screenshot
  let screenshotDataUrl = null;
  if (options.enableVision && options.apiKey && websiteUrl) {
    try {
      screenshotDataUrl = await captureWebsiteScreenshot(websiteUrl);
    } catch (e) {
      console.warn('[LeadFinder] Screenshot capture fallback:', e);
    }
  }

  // Get WebsiteAuditor instance
  const auditorInstance = getAuditorInstance();
  let auditResult = null;

  if (auditorInstance) {
    try {
      auditResult = await auditorInstance.auditWebsite(websiteUrl, businessName, {
        apiKey: options.apiKey,
        enableVision: Boolean(options.enableVision && screenshotDataUrl),
        screenshotDataUrl: screenshotDataUrl
      });
    } catch (err) {
      console.warn('[LeadFinder] Auditor error:', err);
    }
  }

  // If auditor did not return result, calculate fast fallback
  if (!auditResult) {
    const isHttps = websiteUrl.startsWith('https://');
    auditResult = {
      visualStatus: isHttps ? 'MODERN' : 'OUTDATED',
      visualScore: isHttps ? 75 : 45,
      visualFlaws: isHttps ? ['Site is live with SSL'] : ['Missing SSL Certificate ("Not Secure")'],
      pitchHook: isHttps ? `${businessName} has a live website.` : `Pitch modern secure redesign for ${businessName}.`,
      isHttps: isHttps,
      hasMobileViewport: true,
      copyrightYear: null
    };
  }

  return {
    ...lead,
    visualStatus: auditResult.visualStatus || 'UNKNOWN',
    visualScore: auditResult.visualScore !== undefined ? auditResult.visualScore : 50,
    visualFlaws: auditResult.visualFlaws || [],
    pitchHook: auditResult.pitchHook || '',
    isHttps: auditResult.isHttps,
    hasMobileViewport: auditResult.hasMobileViewport,
    copyrightYear: auditResult.copyrightYear,
    screenshotDataUrl: screenshotDataUrl || null,
    auditMethod: auditResult.auditMethod
  };
}

/**
 * Capture Website Screenshot via Background Tab (Fast ~800ms)
 */
async function captureWebsiteScreenshot(url) {
  let tab = null;
  try {
    let target = url.trim();
    if (!target.match(/^https?:\/\//i)) target = 'https://' + target;

    tab = await chrome.tabs.create({ url: target, active: false });
    const tabId = tab.id;

    await new Promise(r => setTimeout(r, 700));

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 60
    });

    return dataUrl;
  } catch (err) {
    return null;
  } finally {
    if (tab && tab.id) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}
