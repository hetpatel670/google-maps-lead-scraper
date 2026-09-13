/**
 * LeadFinder AI - Global Location Expansion Matrix & AI Intelligence Engine
 * Handles worldwide query parsing, automated regional query expansion (USA, UK, Canada, Australia, Europe, Global)
 * and Gemini Multimodal / Text AI for smart multi-city lead strategies, nearby city discovery, and related niches.
 */

(function (root) {
  // Top Metropolitan Cities by Country
  const US_TOP_CITIES = [
    'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
    'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'Austin, TX',
    'San Jose, CA', 'Fort Worth, TX', 'Jacksonville, FL', 'Columbus, OH', 'Charlotte, NC',
    'Indianapolis, IN', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
    'Boston, MA', 'Nashville, TN', 'El Paso, TX', 'Detroit, MI', 'Portland, OR',
    'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD', 'Milwaukee, WI',
    'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA', 'Mesa, AZ',
    'Kansas City, MO', 'Atlanta, GA', 'Omaha, NE', 'Colorado Springs, CO', 'Raleigh, NC',
    'Miami, FL', 'Long Beach, CA', 'Virginia Beach, VA', 'Oakland, CA', 'Minneapolis, MN',
    'Tampa, FL', 'Tulsa, OK', 'Arlington, TX', 'New Orleans, LA', 'Wichita, KS'
  ];

  const UK_TOP_CITIES = [
    'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow',
    'Liverpool', 'Newcastle', 'Sheffield', 'Bristol', 'Edinburgh',
    'Leicester', 'Belfast', 'Cardiff', 'Nottingham', 'Southampton'
  ];

  const AU_TOP_CITIES = [
    'Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA',
    'Gold Coast, QLD', 'Newcastle, NSW', 'Canberra, ACT', 'Sunshine Coast, QLD', 'Wollongong, NSW',
    'Geelong, VIC', 'Hobart, TAS', 'Townsville, QLD', 'Cairns, QLD', 'Darwin, NT',
    'Toowoomba, QLD', 'Ballarat, VIC', 'Bendigo, VIC', 'Albury, NSW', 'Wagga Wagga, NSW'
  ];

  const CA_TOP_CITIES = [
    'Toronto, ON', 'Montreal, QC', 'Vancouver, BC', 'Calgary, AB', 'Edmonton, AB',
    'Ottawa, ON', 'Winnipeg, MB', 'Quebec City, QC', 'Hamilton, ON', 'Halifax, NS',
    'London, ON', 'Victoria, BC', 'Windsor, ON', 'Saskatoon, SK', 'Regina, SK'
  ];

  const US_STATE_CITIES = {
    california: ['Los Angeles, CA', 'San Francisco, CA', 'San Diego, CA', 'San Jose, CA', 'Sacramento, CA', 'Fresno, CA', 'Long Beach, CA', 'Oakland, CA'],
    texas: ['Houston, TX', 'Dallas, TX', 'Austin, TX', 'San Antonio, TX', 'Fort Worth, TX', 'El Paso, TX', 'Arlington, TX', 'Corpus Christi, TX'],
    florida: ['Miami, FL', 'Orlando, FL', 'Tampa, FL', 'Jacksonville, FL', 'St. Petersburg, FL', 'Fort Lauderdale, FL', 'Tallahassee, FL', 'Cape Coral, FL'],
    'new york': ['New York, NY', 'Buffalo, NY', 'Rochester, NY', 'Yonkers, NY', 'Syracuse, NY', 'Albany, NY', 'White Plains, NY'],
    illinois: ['Chicago, IL', 'Aurora, IL', 'Naperville, IL', 'Joliet, IL', 'Rockford, IL', 'Springfield, IL', 'Peoria, IL'],
    pennsylvania: ['Philadelphia, PA', 'Pittsburgh, PA', 'Allentown, PA', 'Reading, PA', 'Erie, PA', 'Scranton, PA', 'Lancaster, PA'],
    ohio: ['Columbus, OH', 'Cleveland, OH', 'Cincinnati, OH', 'Toledo, OH', 'Akron, OH', 'Dayton, OH', 'Canton, OH'],
    georgia: ['Atlanta, GA', 'Augusta, GA', 'Columbus, GA', 'Macon, GA', 'Savannah, GA', 'Athens, GA'],
    'north carolina': ['Charlotte, NC', 'Raleigh, NC', 'Greensboro, NC', 'Durham, NC', 'Winston-Salem, NC', 'Fayetteville, NC', 'Wilmington, NC'],
    michigan: ['Detroit, MI', 'Grand Rapids, MI', 'Warren, MI', 'Sterling Heights, MI', 'Ann Arbor, MI', 'Lansing, MI']
  };

  class LocationMatrix {
    constructor() {
      this.usCities = US_TOP_CITIES;
      this.ukCities = UK_TOP_CITIES;
      this.auCities = AU_TOP_CITIES;
      this.caCities = CA_TOP_CITIES;
    }

    /**
     * Parse raw user search prompt into structured extraction parameters with separate niche and location
     */
    parseUserPrompt(rawInput, defaultTarget) {
      const defTarget = defaultTarget || 100;
      if (!rawInput || typeof rawInput !== 'string') {
        return {
          target: defTarget,
          niche: 'business',
          location: '',
          region: '',
          isMultiLocation: false,
          subQueries: ['business']
        };
      }

      let input = rawInput.trim();
      let targetCount = defTarget;

      // 1. Extract target quantity if explicitly present (e.g. "1000 dentists in usa", "scrape 500 plumbers")
      const countMatch = input.match(/\b(\d{2,5})\b/);
      if (countMatch && countMatch[1]) {
        targetCount = parseInt(countMatch[1], 10);
        input = input.replace(/\b\d{2,5}\b/g, '').trim();
      }

      // 2. Strip generic lead generation verbs
      input = input.replace(/^(?:scrape|find|get|extract|search for|lookup)\s+/i, '').replace(/\s+/g, ' ').trim();

      // 3. Check for explicit "niche in location" syntax
      let niche = input;
      let location = '';

      const inMatch = input.match(/^(.+?)\s+in\s+([a-zA-Z0-9\s,.-]+)$/i);
      if (inMatch) {
        niche = inMatch[1].trim();
        location = inMatch[2].trim();
      } else {
        // Known cities list for suffix matching (e.g. "haulage company Wagga Wagga", "dentist Melbourne")
        const allKnownCities = [
          'wagga wagga', 'wagga', 'albury', 'griffith', 'goulburn', 'canberra', 'dubbo', 'bathurst', 'orange',
          'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'gold coast', 'newcastle', 'sunshine coast',
          'wollongong', 'geelong', 'hobart', 'townsville', 'cairns', 'darwin', 'toowoomba', 'ballarat', 'bendigo',
          'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego',
          'dallas', 'austin', 'san jose', 'fort worth', 'jacksonville', 'columbus', 'charlotte', 'indianapolis',
          'san francisco', 'seattle', 'denver', 'washington', 'boston', 'nashville', 'el paso', 'detroit',
          'portland', 'las vegas', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson',
          'fresno', 'sacramento', 'mesa', 'kansas city', 'atlanta', 'omaha', 'colorado springs', 'raleigh',
          'miami', 'long beach', 'virginia beach', 'oakland', 'minneapolis', 'tampa', 'tulsa', 'arlington',
          'new orleans', 'wichita', 'london', 'birmingham', 'manchester', 'leeds', 'glasgow', 'liverpool',
          'toronto', 'montreal', 'vancouver', 'calgary', 'edmonton', 'ottawa', 'paris', 'berlin', 'mumbai', 'tokyo'
        ];

        const inputLower = input.toLowerCase();
        for (const cityCand of allKnownCities) {
          const idx = inputLower.lastIndexOf(cityCand);
          if (idx > 0) {
            niche = input.slice(0, idx).trim();
            location = input.slice(idx).trim();
            break;
          }
        }
      }

      // Check if location is a broad nationwide container (e.g. "usa", "uk", "australia", "canada", "california")
      const isBroad = this.isBroadRegion(location);

      let subQueries = [];
      if (isBroad && location) {
        subQueries = this.generateSubQueries(niche, location, targetCount);
      } else {
        // Specific query (e.g. "haulage company Wagga Wagga", "dentists in London", "plumbers in Miami")
        subQueries = [input];
      }

      return {
        target: targetCount,
        niche: niche || input,
        location: location || '',
        region: location || '',
        isMultiLocation: isBroad && subQueries.length > 1,
        subQueries: subQueries
      };
    }

    /**
     * Check if a region identifier represents a broad nationwide or whole-state territory
     */
    isBroadRegion(region) {
      if (!region || typeof region !== 'string') return false;
      const r = region.toLowerCase().trim();
      const broadKeywords = [
        'usa', 'us', 'united states', 'united states of america', 'america', 'nationwide', 'all usa',
        'uk', 'united kingdom', 'england', 'britain', 'great britain', 'all uk',
        'australia', 'au', 'all australia',
        'canada', 'ca', 'all canada'
      ];
      if (broadKeywords.includes(r)) return true;
      if (US_STATE_CITIES[r]) return true;
      return false;
    }

    /**
     * Generate multi-city sub-queries for broad nationwide campaigns
     */
    generateSubQueries(niche, region, targetCount) {
      const cleanNiche = niche || 'business';
      const r = (region || 'usa').toLowerCase().trim();
      const count = targetCount || 1000;

      let cityList = US_TOP_CITIES;

      if (['uk', 'united kingdom', 'england', 'britain', 'great britain', 'all uk'].includes(r)) {
        cityList = UK_TOP_CITIES;
      } else if (['australia', 'au', 'all australia'].includes(r)) {
        cityList = AU_TOP_CITIES;
      } else if (['canada', 'ca', 'all canada'].includes(r)) {
        cityList = CA_TOP_CITIES;
      } else if (US_STATE_CITIES[r]) {
        cityList = US_STATE_CITIES[r];
      }

      const ESTIMATED_PER_CITY = 35;
      const citiesNeeded = Math.min(cityList.length, Math.max(1, Math.ceil(count / ESTIMATED_PER_CITY)));
      const selectedCities = cityList.slice(0, citiesNeeded);

      return selectedCities.map(city => `${cleanNiche} in ${city}`);
    }

    /**
     * Parse prompt with Gemini AI for worldwide geographic & niche precision
     */
    async generateWithGeminiAI(promptText, apiKey, defaultTarget = 1000) {
      if (!apiKey || !promptText) return null;

      try {
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        const systemInstruction = `You are a Global B2B Lead Generation Strategist. Parse the user's Google Maps scraping request.
Identify the exact commercial niche, the location/city, the country, and whether the user specified a specific city (e.g. Wagga Wagga, Melbourne, Austin) or wants a broad nationwide campaign (e.g. "in USA", "in Australia", "nationwide").

CRITICAL RULES:
1. If the user provided a specific city/town anywhere in the world (e.g. "Wagga Wagga", "London", "Toronto", "Paris", "Berlin", "Mumbai"), DO NOT convert it into US cities. Set "isBroadNationwide": false, and return subQueries with only that city.
2. If the user asked for a broad nationwide search (e.g. "scrape 1000 dentists in usa" or "plumbers in australia"), set "isBroadNationwide": true and return top cities for that country.
3. Return strict JSON format.

JSON Schema:
{
  "target": 1000,
  "niche": "haulage company",
  "location": "Wagga Wagga",
  "country": "Australia",
  "isBroadNationwide": false,
  "subQueries": ["haulage company in Wagga Wagga"]
}`;

        const requestBody = {
          contents: [{
            parts: [{
              text: `${systemInstruction}\n\nUser Request: "${promptText}" (Default target: ${defaultTarget})`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (root.LeadFinder && root.LeadFinder.logger) {
            root.LeadFinder.logger.warn(`Gemini API responded with HTTP status ${res.status}`);
          }
          return null;
        }

        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) return null;

        let parsed = null;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          // Attempt markdown json block extraction
          const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            parsed = JSON.parse(match[1]);
          }
        }

        if (parsed && parsed.subQueries && parsed.subQueries.length > 0) {
          return {
            target: parsed.target || defaultTarget,
            niche: parsed.niche || promptText,
            location: parsed.location || '',
            country: parsed.country || 'Global',
            isMultiLocation: Boolean(parsed.isBroadNationwide && parsed.subQueries.length > 1),
            subQueries: parsed.subQueries
          };
        }
      } catch (err) {
        if (root.LeadFinder && root.LeadFinder.logger) {
          root.LeadFinder.logger.warn('Gemini query parse fallback:', err.message || err);
        }
      }
      return null;
    }

    /**
     * Get 5 AI-powered nearby city suggestions when target lead count is not met
     */
    async getNearbyCitySuggestions(currentCity, country, niche, apiKey) {
      if (apiKey && currentCity) {
        try {
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
          const prompt = `Given the city/location "${currentCity}" in ${country || 'the world'}, list 5 realistic nearby cities or commercial towns within 50-180 km that would have local "${niche || 'businesses'}".
Return strict JSON format:
{
  "nearbyCities": ["City 1", "City 2", "City 3", "City 4", "City 5"]
}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (raw) {
              let parsed = null;
              try {
                parsed = JSON.parse(raw);
              } catch {
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) parsed = JSON.parse(match[1]);
              }
              if (parsed && parsed.nearbyCities && Array.isArray(parsed.nearbyCities) && parsed.nearbyCities.length > 0) {
                return parsed.nearbyCities.slice(0, 5);
              }
            }
          }
        } catch (e) {
          if (root.LeadFinder && root.LeadFinder.logger) {
            root.LeadFinder.logger.warn('Gemini nearby city suggestion fallback', e.message || e);
          }
        }
      }

      // Heuristic Fallback
      const cLower = (currentCity || '').toLowerCase();
      if (cLower.includes('wagga')) {
        return ['Albury, NSW', 'Griffith, NSW', 'Goulburn, NSW', 'Canberra, ACT', 'Dubbo, NSW'];
      }
      if (cLower.includes('sydney')) {
        return ['Wollongong, NSW', 'Newcastle, NSW', 'Central Coast, NSW', 'Parramatta, NSW', 'Penrith, NSW'];
      }
      if (cLower.includes('melbourne')) {
        return ['Geelong, VIC', 'Ballarat, VIC', 'Bendigo, VIC', 'Frankston, VIC', 'Shepparton, VIC'];
      }
      if (cLower.includes('brisbane')) {
        return ['Gold Coast, QLD', 'Sunshine Coast, QLD', 'Toowoomba, QLD', 'Ipswich, QLD', 'Logan, QLD'];
      }
      if (cLower.includes('london')) {
        return ['Reading', 'Watford', 'Croydon', 'Guildford', 'St Albans'];
      }
      if (cLower.includes('new york') || cLower.includes('ny')) {
        return ['Jersey City, NJ', 'Yonkers, NY', 'Newark, NJ', 'Stamford, CT', 'White Plains, NY'];
      }
      if (cLower.includes('los angeles') || cLower.includes('la')) {
        return ['Long Beach, CA', 'Anaheim, CA', 'Pasadena, CA', 'Glendale, CA', 'Santa Ana, CA'];
      }

      return ['Metro Area', 'North District', 'South Region', 'East Zone', 'West Zone'];
    }

    /**
     * Get 5 AI-powered related commercial niche suggestions when user chooses to keep city
     */
    async getRelatedNicheSuggestions(currentNiche, apiKey) {
      if (apiKey && currentNiche) {
        try {
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
          const prompt = `Given the B2B commercial business niche "${currentNiche}", list 5 closely related commercial business sub-categories that can be searched on Google Maps to find more potential leads.
Return strict JSON format:
{
  "relatedNiches": ["Niche 1", "Niche 2", "Niche 3", "Niche 4", "Niche 5"]
}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (raw) {
              let parsed = null;
              try {
                parsed = JSON.parse(raw);
              } catch {
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) parsed = JSON.parse(match[1]);
              }
              if (parsed && parsed.relatedNiches && Array.isArray(parsed.relatedNiches) && parsed.relatedNiches.length > 0) {
                return parsed.relatedNiches.slice(0, 5);
              }
            }
          }
        } catch (e) {
          if (root.LeadFinder && root.LeadFinder.logger) {
            root.LeadFinder.logger.warn('Gemini related niche suggestion fallback', e.message || e);
          }
        }
      }

      // Heuristic Fallback
      const nLower = (currentNiche || '').toLowerCase();
      if (nLower.includes('haulage') || nLower.includes('truck') || nLower.includes('transport')) {
        return ['Freight Logistics', 'Road Transport Services', 'Trucking Companies', 'Courier & Delivery', 'Warehousing Services'];
      }
      if (nLower.includes('dentist') || nLower.includes('dental')) {
        return ['Orthodontists', 'Dental Clinics', 'Cosmetic Dentistry', 'Emergency Dentist', 'Periodontists'];
      }
      if (nLower.includes('plumb')) {
        return ['Emergency Plumbers', 'Drain Cleaning Services', 'Commercial Plumbing', 'HVAC & Heating', 'Gas Fitters'];
      }
      if (nLower.includes('roof')) {
        return ['Roof Repairs', 'Commercial Roofing', 'Gutter Cleaning', 'Roof Restoration', 'Siding Contractors'];
      }
      if (nLower.includes('lawyer') || nLower.includes('attorney')) {
        return ['Personal Injury Lawyers', 'Family Law Attorneys', 'Corporate Law Firms', 'Criminal Defense Lawyers', 'Real Estate Lawyers'];
      }

      return ['Commercial Services', 'Contractors', 'Consultants', 'Suppliers', 'Specialists'];
    }

    /**
     * Generate 1-sentence sales pitch hook
     */
    async generatePitchHook(lead, apiKey) {
      const businessName = lead.businessName || 'this business';
      const website = lead.website;
      const address = lead.address || '';
      const category = lead.category || 'local business';
      const hasWebsite = Boolean(website && website !== 'No Website');

      if (!hasWebsite) {
        return `Pitch building the first official modern website for ${businessName} to capture local Google search traffic.`;
      }

      if (!apiKey) {
        return `Pitch local SEO & customer acquisition marketing to ${businessName}.`;
      }

      try {
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Write a concise 1-sentence sales pitch hook for Business: ${businessName}, Category: ${category}, Website: ${hasWebsite ? website : 'NO WEBSITE'}, Location: ${address}`
              }]
            }],
            generationConfig: { maxOutputTokens: 60, temperature: 0.7 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const hook = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (hook) return hook;
        }
      } catch (e) {
        if (root.LeadFinder && root.LeadFinder.logger) {
          root.LeadFinder.logger.warn('Gemini pitch hook fallback', e.message || e);
        }
      }

      return `Pitch local SEO & digital growth to ${businessName}.`;
    }
  }

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.LocationMatrix = LocationMatrix;
  root.LeadFinder.locationMatrix = new LocationMatrix();
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);