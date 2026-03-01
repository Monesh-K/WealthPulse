/**
 * WealthPulse — Market Data Service
 * Live prices: MF (by scheme name), Indian stocks (by ISIN/ticker), US stocks (by symbol), gold, forex
 * Granular refresh functions for cron scheduling
 */

// ─── Cache ────────────────────────────────────────
const cache = new Map();
const CACHE_SHORT = 5 * 60 * 1000;   // 5 min for live prices
const CACHE_LONG = 60 * 60 * 1000;   // 1 hour for search/mapping results
const MF_SCHEME_MAP = new Map();      // name → schemeCode persistent lookup

function getCached(key, ttl = CACHE_SHORT) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < ttl) return entry.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, time: Date.now() }); }

// ─── Helpers ──────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, headers = {}) {
  const defaultHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
  const res = await fetch(url, { headers: { ...defaultHeaders, ...headers } });
  return res.json();
}

// ─── Mutual Fund NAV ──────────────────────────────
async function fetchMFNav(schemeCode) {
  if (!schemeCode) return null;
  const cacheKey = `mf_${schemeCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJSON(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (data.data && data.data[0]) {
      const nav = Number(data.data[0].nav);
      setCache(cacheKey, nav);
      return nav;
    }
  } catch (e) { console.warn(`[Market] MF NAV fetch failed for ${schemeCode}:`, e.message); }
  return null;
}

async function searchMF(query) {
  if (!query) return [];
  const cacheKey = `mf_search_${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey, CACHE_LONG);
  if (cached) return cached;

  try {
    const data = await fetchJSON(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    const results = Array.isArray(data) ? data : [];
    setCache(cacheKey, results);
    return results;
  } catch (e) { console.warn(`[Market] MF search failed for "${query}":`, e.message); }
  return [];
}

async function resolveMFSchemeCode(schemeName) {
  if (!schemeName) return null;
  const key = schemeName.toLowerCase().trim();

  if (MF_SCHEME_MAP.has(key)) return MF_SCHEME_MAP.get(key);

  // Try progressively shorter search terms for better results
  const searchTerms = [
    schemeName.replace(/direct\s*(plan\s*)?(growth|dividend)/i, '').replace(/\s+/g, ' ').trim(),
    schemeName.split(/\s+/).slice(0, 4).join(' '),
    schemeName.split(/\s+/).slice(0, 3).join(' '),
  ];

  let allResults = [];
  for (const term of searchTerms) {
    if (!term || term.length < 3) continue;
    const results = await searchMF(term);
    allResults.push(...results);
    if (results.length > 0) break;
    await delay(200);
  }

  if (!allResults.length) return null;

  // De-duplicate results
  const seen = new Set();
  allResults = allResults.filter(r => {
    const k = r.schemeCode;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const nameLower = schemeName.toLowerCase();
  let best = null;
  let bestScore = -1;

  for (const r of allResults) {
    const rName = (r.schemeName || '').toLowerCase();
    let score = 0;

    if (rName === nameLower) { score = 1000; }
    else if (rName.includes(nameLower) || nameLower.includes(rName.replace(/\s*-\s*/g, ' ').trim())) { score = 500; }
    else {
      const words = nameLower.split(/\s+/);
      const rWords = rName.split(/\s+/);
      for (const w of words) {
        if (w.length >= 3 && rWords.some(rw => rw.includes(w))) score += 10;
      }
    }

    if (nameLower.includes('direct') && rName.includes('direct')) score += 50;
    if (nameLower.includes('regular') && rName.includes('regular')) score += 50;
    if (nameLower.includes('growth') && rName.includes('growth')) score += 50;
    if (nameLower.includes('dividend') && rName.includes('dividend')) score += 50;
    if (nameLower.includes('idcw') && rName.includes('idcw')) score += 50;
    if (nameLower.includes('direct') && !rName.includes('direct')) score -= 30;
    if (!nameLower.includes('direct') && rName.includes('direct')) score -= 30;

    if (score > bestScore) { bestScore = score; best = r; }
  }

  if (best && bestScore >= 20) {
    const code = String(best.schemeCode);
    MF_SCHEME_MAP.set(key, code);
    console.log(`[Market] MF resolved: "${schemeName}" → ${code} (${best.schemeName}) [score: ${bestScore}]`);
    return code;
  }
  console.warn(`[Market] MF could not resolve: "${schemeName}" (best score: ${bestScore})`);
  return null;
}

// ─── Indian Stock Price ───────────────────────────
const ISIN_TICKER_MAP = {
  'INE263A01024': 'BEL.NS',
  'INE067A01029': 'CGPOWER.NS',
  'INF109KC19V3': 'ICICIFMCG.NS',
  'INE154A01025': 'ITC.NS',
  'INE522D01027': 'MANAPPURAM.NS',
  'INE987B01026': 'NATCOPHARM.NS',
  'INE095N01031': 'NBCC.NS',
  'INE1TAE01010': 'TATAMOTORS.NS',
  'INE081A01020': 'TATASTEEL.NS',
  'INF277KA1976': 'TATAGOLD.NS',
  'INE009A01021': 'INFY.NS',
  'INE002A01018': 'RELIANCE.NS',
  'INE040A01034': 'HDFCBANK.NS',
  'INE090A01021': 'ICICIBANK.NS',
  'INE467B01029': 'TATAELXSI.NS',
  'INE397D01024': 'BHARTIARTL.NS',
  'INE030A01027': 'HINDUNILVR.NS',
  'INE585B01010': 'MARUTI.NS',
  'INE669E01016': 'HCLTECH.NS',
  'INE176B01034': 'AXISBANK.NS',
  'INE062A01020': 'SBIN.NS',
};

async function resolveISINToTicker(isin) {
  if (!isin) return null;
  if (ISIN_TICKER_MAP[isin]) return ISIN_TICKER_MAP[isin];

  try {
    const data = await fetchJSON(`https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=5&newsCount=0`);
    if (data.quotes && data.quotes.length > 0) {
      const nsQuote = data.quotes.find(q => q.symbol?.endsWith('.NS'));
      const ticker = nsQuote?.symbol || data.quotes[0].symbol;
      if (ticker) {
        ISIN_TICKER_MAP[isin] = ticker;
        console.log(`[Market] ISIN resolved: ${isin} → ${ticker}`);
        return ticker;
      }
    }
  } catch (e) { console.warn(`[Market] ISIN resolve failed for ${isin}:`, e.message); }
  return null;
}

async function fetchStockPrice(ticker) {
  if (!ticker) return null;
  const cacheKey = `stock_${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let symbol = ticker;
  if (/^IN[EF]\w+/.test(ticker)) {
    symbol = await resolveISINToTicker(ticker);
    if (!symbol) return null;
  }

  const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;

  try {
    const data = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`);
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) { setCache(cacheKey, price); return price; }
  } catch (e) { console.warn(`[Market] Yahoo India fetch failed for ${yahooSymbol}:`, e.message); }

  if (!symbol.includes('.')) {
    try {
      const data = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.BO?interval=1d&range=1d`);
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price) { setCache(cacheKey, price); return price; }
    } catch (e) { /* ignore BSE fallback failure */ }
  }

  return null;
}

// ─── US Stock Price ───────────────────────────────
async function fetchUSStockPrice(symbol) {
  if (!symbol) return null;
  const cacheKey = `us_stock_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) { setCache(cacheKey, price); return price; }
  } catch (e) { console.warn(`[Market] Yahoo US fetch failed for ${symbol}:`, e.message); }
  return null;
}

// ─── Gold & Forex ─────────────────────────────────
async function fetchGoldPrice() {
  const cacheKey = 'gold_inr';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJSON('https://api.metals.dev/v1/latest?api_key=demo&currency=INR&unit=gram');
    if (data?.metals?.gold) {
      const price = data.metals.gold;
      setCache(cacheKey, price);
      return price;
    }
  } catch (e) { console.warn('[Market] Gold price fetch failed:', e.message); }

  try {
    const fxRate = await fetchForexRate();
    const approxPrice = 70 * fxRate;
    setCache(cacheKey, Math.round(approxPrice));
    return Math.round(approxPrice);
  } catch { return null; }
}

async function fetchForexRate() {
  const cacheKey = 'usd_inr';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJSON('https://api.exchangerate-api.com/v4/latest/USD');
    const rate = data?.rates?.INR;
    if (rate) { setCache(cacheKey, rate); return rate; }
  } catch (e) { console.warn('[Market] Forex fetch failed:', e.message); }
  return 83;
}

// ─────────────────────────────────────────────────
// GRANULAR REFRESH FUNCTIONS (for cron jobs)
// ─────────────────────────────────────────────────

async function refreshMFPrices(db) {
  const assets = db.prepare("SELECT * FROM assets WHERE subtype LIKE '%Mutual Fund%'").all();
  let updated = 0;

  for (const asset of assets) {
    try {
      let schemeCode = asset.ticker && /^\d+$/.test(asset.ticker) ? asset.ticker : null;

      if (!schemeCode) {
        schemeCode = await resolveMFSchemeCode(asset.name);
        if (schemeCode) {
          db.prepare('UPDATE assets SET ticker = ? WHERE id = ?').run(schemeCode, asset.id);
        }
      }

      if (schemeCode && asset.units > 0) {
        const nav = await fetchMFNav(schemeCode);
        if (nav) {
          const newValue = Math.round(nav * asset.units * 100) / 100;
          db.prepare(`UPDATE assets SET current_value = ?, updated_at = date('now') WHERE id = ?`)
            .run(newValue, asset.id);
          updated++;
        }
      }
      await delay(300);
    } catch (e) {
      console.warn(`[Market] MF refresh failed for ${asset.name}:`, e.message);
    }
  }

  saveLastRefreshTime(db, 'mf');
  console.log(`[Market] MF refresh: ${updated}/${assets.length} updated`);
  return updated;
}

async function refreshIndianStockPrices(db) {
  const assets = db.prepare(`
    SELECT * FROM assets
    WHERE (subtype = 'Stock' OR subtype = 'ETF'
           OR (category = 'Equity' AND subtype NOT LIKE '%Mutual Fund%' AND ticker != '' AND ticker IS NOT NULL))
      AND category != 'International'
      AND currency != 'USD'
      AND units > 0
  `).all();

  let updated = 0;

  for (const asset of assets) {
    try {
      const ticker = asset.ticker;
      if (!ticker) continue;
      const price = await fetchStockPrice(ticker);
      if (price) {
        const newValue = Math.round(price * asset.units * 100) / 100;
        db.prepare(`UPDATE assets SET current_value = ?, updated_at = date('now') WHERE id = ?`)
          .run(newValue, asset.id);
        updated++;
      }
      await delay(300);
    } catch (e) {
      console.warn(`[Market] Indian stock refresh failed for ${asset.name}:`, e.message);
    }
  }

  saveLastRefreshTime(db, 'indian_stocks');
  console.log(`[Market] Indian stocks refresh: ${updated}/${assets.length} updated`);
  return updated;
}

async function refreshUSStockPrices(db) {
  const assets = db.prepare(`
    SELECT * FROM assets WHERE (category = 'International' OR currency = 'USD') AND units > 0
  `).all();

  const fxRate = await fetchForexRate();
  let updated = 0;

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('usd_inr', String(fxRate));

  for (const asset of assets) {
    try {
      const symbol = asset.ticker;
      if (!symbol) continue;
      const price = await fetchUSStockPrice(symbol);
      if (price) {
        const valueUSD = Math.round(price * asset.units * 100) / 100;
        db.prepare(`UPDATE assets SET current_value = ?, fx_rate = ?, updated_at = date('now') WHERE id = ?`)
          .run(valueUSD, fxRate, asset.id);
        updated++;
      }
      await delay(300);
    } catch (e) {
      console.warn(`[Market] US stock refresh failed for ${asset.name}:`, e.message);
    }
  }

  saveLastRefreshTime(db, 'us_stocks');
  console.log(`[Market] US stocks refresh: ${updated}/${assets.length} updated. USD/INR: ${fxRate}`);
  return updated;
}

async function refreshAllPrices(db) {
  const assets = db.prepare('SELECT * FROM assets').all();
  const fxRate = await fetchForexRate();
  let updated = 0;

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('usd_inr', String(fxRate));

  for (const asset of assets) {
    try {
      let newValue = null;

      if (asset.subtype && asset.subtype.includes('Mutual Fund')) {
        let schemeCode = asset.ticker && /^\d+$/.test(asset.ticker) ? asset.ticker : null;
        if (!schemeCode) {
          schemeCode = await resolveMFSchemeCode(asset.name);
          if (schemeCode) {
            db.prepare('UPDATE assets SET ticker = ? WHERE id = ?').run(schemeCode, asset.id);
          }
        }
        if (schemeCode && asset.units > 0) {
          const nav = await fetchMFNav(schemeCode);
          if (nav) { newValue = Math.round(nav * asset.units * 100) / 100; }
        }
      }
      else if (asset.category === 'International' || asset.currency === 'USD') {
        const symbol = asset.ticker;
        if (symbol && asset.units > 0) {
          const price = await fetchUSStockPrice(symbol);
          if (price) {
            const valueUSD = Math.round(price * asset.units * 100) / 100;
            db.prepare(`UPDATE assets SET fx_rate = ?, current_value = ?, updated_at = date('now') WHERE id = ?`)
              .run(fxRate, valueUSD, asset.id);
            updated++;
            await delay(300);
            continue;
          }
        }
      }
      else if (asset.subtype === 'Stock' || asset.subtype === 'ETF' ||
               (asset.category === 'Equity' && !asset.subtype?.includes('Mutual Fund') && asset.ticker)) {
        const ticker = asset.ticker;
        if (ticker && asset.units > 0) {
          const price = await fetchStockPrice(ticker);
          if (price) { newValue = Math.round(price * asset.units * 100) / 100; }
        }
      }
      else if (asset.subtype === 'Gold Physical' && asset.units > 0) {
        const goldPrice = await fetchGoldPrice();
        if (goldPrice) { newValue = Math.round(goldPrice * asset.units * 100) / 100; }
      }

      if (newValue !== null) {
        db.prepare(`UPDATE assets SET current_value = ?, updated_at = date('now') WHERE id = ?`)
          .run(newValue, asset.id);
        updated++;
      }

      await delay(300);
    } catch (e) {
      console.warn(`[Market] Failed to refresh ${asset.name}:`, e.message);
    }
  }

  // FD/RD pro-rata values
  const fdRd = db.prepare('SELECT * FROM assets WHERE interest_rate > 0 AND tenure_months > 0').all();
  for (const fd of fdRd) {
    if (fd.invested_value > 0) {
      const r = fd.interest_rate / 100;
      const n = 4;
      const t = fd.tenure_months / 12;
      const maturity = fd.invested_value * Math.pow(1 + r / n, n * t);
      const created = new Date(fd.created_at);
      const now = new Date();
      const elapsed = (now - created) / (1000 * 60 * 60 * 24 * 30);
      const fraction = Math.min(1, elapsed / fd.tenure_months);
      const currentVal = fd.invested_value + (maturity - fd.invested_value) * fraction;

      db.prepare(`UPDATE assets SET current_value = ?, maturity_value = ?, updated_at = date('now') WHERE id = ?`)
        .run(Math.round(currentVal), Math.round(maturity), fd.id);
      updated++;
    }
  }

  saveLastRefreshTime(db, 'full');
  console.log(`[Market] Full refresh: ${updated} assets updated. USD/INR: ${fxRate}`);
  return updated;
}

function saveLastRefreshTime(db, type) {
  const now = new Date().toISOString();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_market_refresh', now);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(`last_refresh_${type}`, now);
}

module.exports = {
  fetchMFNav, searchMF, resolveMFSchemeCode,
  fetchStockPrice, fetchUSStockPrice, resolveISINToTicker,
  fetchGoldPrice, fetchForexRate,
  refreshAllPrices,
  refreshMFPrices,
  refreshIndianStockPrices,
  refreshUSStockPrices,
};
