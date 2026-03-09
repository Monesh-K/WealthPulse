const express = require('express');
const router = express.Router();
const db = require('../models/database');

// ─── Helper: get INR value for an asset ───
function inrValue(asset, field = 'current_value', fxRate = 85) {
  const val = asset[field] || 0;
  if (asset.currency === 'USD') {
    return val * fxRate;
  }
  return val;
}

// ─── Helper: enrich asset with INR values ───
function enrichAsset(a, fxRate = 85) {
  if (a.currency === 'USD') {
    a.fx_rate = fxRate;
    a.invested_value_inr = a.invested_value * fxRate;
    a.current_value_inr = a.current_value * fxRate;
  } else {
    a.invested_value_inr = a.invested_value;
    a.current_value_inr = a.current_value;
  }
  // Auto-calculate FD current value based on compound interest
  if (isFD(a) && a.invested_value > 0 && a.interest_rate > 0 && a.purchase_date) {
    const fdCalc = calcFDValue(a);
    a.current_value = fdCalc.currentValue;
    a.current_value_inr = a.currency === 'USD' ? a.current_value * (a.fx_rate || 1) : a.current_value;
    a.maturity_value = fdCalc.maturityValue;
    a.fd_days_elapsed = fdCalc.daysElapsed;
    a.fd_days_total = (a.tenure_months || 0) * 30;
    a.fd_maturity_date = fdCalc.maturityDate;
    a.fd_interest_earned = fdCalc.currentValue - a.invested_value;
  }
  // Round units to 2 decimals for display
  a.units_display = a.units ? Number(a.units.toFixed(2)) : 0;
  // Daily change percentage
  if (a.previous_value && a.previous_value > 0 && a.current_value > 0) {
    a.day_change_pct = ((a.current_value - a.previous_value) / a.previous_value) * 100;
  } else {
    a.day_change_pct = 0;
  }
  return a;
}

// ─── Helper: check if asset is a Fixed Deposit (bank FD/RD only, NOT retirement assets) ───
function isFD(a) {
  // Retirement category assets (EPF, NPS, PPF) are NOT fixed deposits
  if ((a.category || '').toLowerCase() === 'retirement') return false;
  const sub = (a.subtype || '').toLowerCase();
  const name = (a.name || '').toLowerCase();
  // Exclude EPF/NPS/PPF subtypes explicitly
  if (sub.includes('epf') || sub.includes('nps') || sub.includes('ppf')) return false;
  return sub.includes('fd') || sub.includes('fixed deposit') || sub.includes('recurring deposit') ||
         sub.includes(' rd') || sub.startsWith('rd') ||
         name.includes('fixed deposit') ||
         (name.includes('fd') && a.interest_rate > 0 && a.tenure_months > 0);
}

// ─── Helper: calculate FD current and maturity value (quarterly compounding) ───
function calcFDValue(a) {
  const principal = a.invested_value || 0;
  const annualRate = a.interest_rate / 100;
  const tenureMonths = a.tenure_months || 12;
  const purchaseDate = new Date(a.purchase_date);
  const now = new Date();
  const maturityDate = new Date(purchaseDate);
  maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

  // Quarterly compounding (n=4)
  const n = 4;
  const totalYears = tenureMonths / 12;
  const maturityValue = principal * Math.pow(1 + annualRate / n, n * totalYears);

  // Current value: compound interest for elapsed time
  const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.max(1, Math.floor((maturityDate - purchaseDate) / (1000 * 60 * 60 * 24)));
  const elapsedYears = Math.min(daysElapsed / 365.25, totalYears);

  let currentValue;
  if (now >= maturityDate) {
    currentValue = maturityValue; // FD matured
  } else {
    currentValue = principal * Math.pow(1 + annualRate / n, n * elapsedYears);
  }

  return {
    currentValue: Math.round(currentValue * 100) / 100,
    maturityValue: Math.round(maturityValue * 100) / 100,
    daysElapsed,
    totalDays,
    maturityDate: maturityDate.toISOString().split('T')[0],
  };
}

// ─── Helper: Newton-Raphson XIRR calculation ───
function calculateXIRR(cashflows, guess = 0.1, maxIter = 1000, tol = 1e-7) {
  if (!cashflows || cashflows.length < 2) return 0;

  const days = cashflows.map(cf => (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24));

  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let j = 0; j < cashflows.length; j++) {
      const t = days[j] / 365.0;
      const denom = Math.pow(1 + rate, t);
      if (!isFinite(denom) || denom === 0) break;
      npv += cashflows[j].amount / denom;
      dnpv -= t * cashflows[j].amount / (denom * (1 + rate));
    }

    if (Math.abs(dnpv) < 1e-15) break;
    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tol) return newRate;
    if (!isFinite(newRate) || newRate < -0.99) {
      // Reset with different guess if we diverge
      rate = guess / 2;
      continue;
    }
    rate = newRate;
  }
  return rate;
}

// Get all assets (with pagination)
router.get('/', (req, res) => {
  try {
    const { category, subtype, asset_class, fund_type, search, page, pageSize } = req.query;
    let sql = 'SELECT * FROM assets';
    let countSql = 'SELECT COUNT(*) as total FROM assets';
    const params = [];
    const conditions = [];

    if (category) { conditions.push('category = ?'); params.push(category); }
    if (subtype) { conditions.push('subtype = ?'); params.push(subtype); }
    if (asset_class) { conditions.push('asset_class = ?'); params.push(asset_class); }
    if (fund_type) { conditions.push('fund_type = ?'); params.push(fund_type); }
    if (search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(ticker) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    if (conditions.length) {
      const where = ' WHERE ' + conditions.join(' AND ');
      sql += where;
      countSql += where;
    }
    sql += ' ORDER BY current_value DESC';

    // Count
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow?.total || 0;

    // Pagination
    const pg = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(1000, Math.max(1, parseInt(pageSize) || 50));
    const offset = (pg - 1) * ps;
    sql += ` LIMIT ${ps} OFFSET ${offset}`;

    // Fetch FX rate once
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const assets = db.prepare(sql).all(...params).map(a => enrichAsset(a, fxRate));

    res.json({ success: true, data: assets, total, page: pg, pageSize: ps, totalPages: Math.ceil(total / ps) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get all asset names (for dropdowns like goals)
router.get('/names', (req, res) => {
  try {
    const assets = db.prepare('SELECT id, name, category, asset_class, current_value, currency FROM assets ORDER BY name ASC').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const data = assets.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      asset_class: a.asset_class,
      current_value_inr: a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || 0),
    }));
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get asset allocation summary
router.get('/allocation', (req, res) => {
  try {
    const { category, asset_class, fund_type, search } = req.query;
    let sql = 'SELECT * FROM assets';
    const params = [];
    const conditions = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (asset_class) { conditions.push('asset_class = ?'); params.push(asset_class); }
    if (fund_type) { conditions.push('fund_type = ?'); params.push(fund_type); }
    if (search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(ticker) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    const assets = db.prepare(sql).all(...params);
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const byCategory = {};
    const byAssetClass = {};
    const byFundType = {};
    let totalValue = 0;
    let totalInvested = 0;
    let emergencyFundValue = 0;
    let retirementCorpusValue = 0;
    let retirementCorpusInvested = 0;
    let emergencyFundInvested = 0;

    assets.forEach(a => {
      // Enrich with FD auto-calculation
      if (isFD(a) && a.invested_value > 0 && a.interest_rate > 0 && a.purchase_date) {
        const fdCalc = calcFDValue(a);
        a.current_value = fdCalc.currentValue;
      }
      const val = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || a.invested_value || 0);
      const inv = a.currency === 'USD' ? (a.invested_value || 0) * fxRate : (a.invested_value || 0);
      const cat = a.category || 'Other';
      const cls = a.asset_class || 'Other';
      const ft = a.fund_type || '';

      byCategory[cat] = (byCategory[cat] || 0) + val;
      byAssetClass[cls] = (byAssetClass[cls] || 0) + val;
      if (ft) byFundType[ft] = (byFundType[ft] || 0) + val;
      totalValue += val;
      totalInvested += inv;

      // Emergency fund: assets explicitly tagged OR auto-classified (Cash + Arbitrage + Liquid + FD)
      // Exclude Retirement assets (EPF/NPS/PPF are not emergency funds)
      const ftLower = (a.fund_type || '').toLowerCase();
      const isTaggedEmergency = a.is_emergency_fund === 1;
      if (isTaggedEmergency || (cat !== 'Retirement' && (cat === 'Cash' || ftLower === 'arbitrage' || ftLower === 'liquid' || isFD(a)))) {
        emergencyFundValue += val;
        emergencyFundInvested += inv;
      }
      // Retirement corpus tracking
      if (cat === 'Retirement') {
        retirementCorpusValue += val;
        retirementCorpusInvested += inv;
      }
    });

    const retirementCorpus = retirementCorpusValue;

    res.json({
      success: true,
      data: {
        byCategory,
        byAssetClass,
        byFundType,
        totalValue,
        totalInvested,
        emergencyFundValue,
        emergencyFundInvested,
        retirementCorpus,
        retirementCorpusInvested,
        isFiltered: conditions.length > 0,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Merge duplicate assets (combine by name)
router.post('/merge-duplicates', (req, res) => {
  try {
    const dupes = db.prepare(`
      SELECT LOWER(TRIM(name)) as lname, COUNT(*) as cnt FROM assets
      GROUP BY LOWER(TRIM(name)) HAVING cnt > 1
    `).all();

    if (!dupes.length) return res.json({ success: true, merged: 0, message: 'No duplicates found' });

    let merged = 0;
    const txn = db.transaction(() => {
      for (const { lname } of dupes) {
        const rows = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = ? ORDER BY created_at ASC').all(lname);
        if (rows.length < 2) continue;

        const primary = rows[0];
        let totalInvested = primary.invested_value || 0;
        let totalCurrent = primary.current_value || 0;
        let totalUnits = primary.units || 0;
        const allNotes = [primary.notes || ''];

        for (let i = 1; i < rows.length; i++) {
          totalInvested += rows[i].invested_value || 0;
          totalCurrent += rows[i].current_value || 0;
          totalUnits += rows[i].units || 0;
          if (rows[i].notes) allNotes.push(rows[i].notes);
          db.prepare('DELETE FROM assets WHERE id = ?').run(rows[i].id);
        }

        db.prepare(`UPDATE assets SET invested_value = ?, current_value = ?, units = ?,
          notes = ?, updated_at = date('now') WHERE id = ?`)
          .run(totalInvested, totalCurrent, totalUnits, allNotes.join(' | '), primary.id);

        merged += rows.length - 1;
      }
    });
    txn();

    res.json({ success: true, merged, message: `Merged ${merged} duplicate assets` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get distinct asset classes and fund types (for filter dropdowns)
router.get('/filters', (req, res) => {
  try {
    const assetClasses = db.prepare("SELECT DISTINCT asset_class FROM assets WHERE asset_class != '' AND asset_class IS NOT NULL ORDER BY asset_class").all().map(r => r.asset_class);
    const fundTypes = db.prepare("SELECT DISTINCT fund_type FROM assets WHERE fund_type != '' AND fund_type IS NOT NULL ORDER BY fund_type").all().map(r => r.fund_type);
    const categories = db.prepare("SELECT DISTINCT category FROM assets ORDER BY category").all().map(r => r.category);
    res.json({ success: true, data: { assetClasses, fundTypes, categories } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Capital Gains Tax Report ─────────────────────
router.get('/tax-report', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const now = new Date();

    const results = [];
    let totalSTCG = 0;
    let totalLTCG = 0;

    for (const a of assets) {
      const invested = a.currency === 'USD' ? (a.invested_value || 0) * fxRate : (a.invested_value || 0);
      const current = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || 0);
      const gain = current - invested;

      // Calculate holding period in months
      let holdingMonths = 0;
      if (a.purchase_date) {
        const purchaseDate = new Date(a.purchase_date);
        holdingMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
      }

      // Determine STCG vs LTCG based on category
      const cat = (a.category || '').toLowerCase();
      let ltcgThreshold;
      if (cat === 'equity' || cat === 'international') {
        ltcgThreshold = 12; // Equity: >12 months = LTCG
      } else if (cat === 'gold' || cat === 'real estate') {
        ltcgThreshold = 24; // Gold/RE: >24 months (post-2023 budget)
      } else {
        ltcgThreshold = 36; // Debt/Other: >36 months
      }

      const gainType = holdingMonths > ltcgThreshold ? 'LTCG' : 'STCG';

      // Tax rates (Indian tax regime)
      let taxRate;
      if (gainType === 'LTCG') {
        if (cat === 'equity') taxRate = 10; // LTCG on equity: 10% above 1L
        else taxRate = 20; // LTCG on debt/gold/RE: 20% with indexation
      } else {
        if (cat === 'equity') taxRate = 15; // STCG on equity: 15%
        else taxRate = 30; // STCG on debt: as per slab (assume 30%)
      }

      if (gain > 0) {
        if (gainType === 'STCG') totalSTCG += gain;
        else totalLTCG += gain;
      }

      results.push({
        id: a.id,
        name: a.name,
        category: a.category,
        invested,
        current,
        gain,
        holdingMonths,
        type: gainType,
        taxRate,
        estimatedTax: gain > 0 ? Math.round(gain * taxRate / 100) : 0,
        purchase_date: a.purchase_date || '',
      });
    }

    const estimatedTax = results.reduce((s, r) => s + (r.estimatedTax || 0), 0);

    res.json({
      success: true,
      data: results,
      summary: {
        totalSTCG,
        totalLTCG,
        estimatedTax,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Portfolio XIRR ──────────────────────────────
router.get('/portfolio-xirr', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const now = new Date();

    const allCashflows = [];

    for (const a of assets) {
      const txns = db.prepare('SELECT * FROM asset_transactions WHERE asset_id = ? ORDER BY date ASC').all(a.id);

      if (txns.length > 0) {
        for (const t of txns) {
          let amt = t.amount || 0;
          if (a.currency === 'USD') amt *= fxRate;
          if (t.type === 'buy') {
            allCashflows.push({ date: new Date(t.date), amount: -amt });
          } else if (t.type === 'sell' || t.type === 'dividend') {
            allCashflows.push({ date: new Date(t.date), amount: amt });
          }
        }
      } else {
        // Use purchase_date + invested_value as buy, current_value as current
        const invested = a.currency === 'USD' ? (a.invested_value || 0) * fxRate : (a.invested_value || 0);
        if (invested > 0) {
          const pDate = a.purchase_date ? new Date(a.purchase_date) : new Date(a.created_at || now);
          allCashflows.push({ date: pDate, amount: -invested });
        }
      }
      // Add current value as final positive cashflow
      const currentVal = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || 0);
      if (currentVal > 0) {
        allCashflows.push({ date: now, amount: currentVal });
      }
    }

    if (allCashflows.length < 2) {
      return res.json({ success: true, data: { xirr: 0, message: 'Not enough data to calculate XIRR' } });
    }

    allCashflows.sort((a, b) => a.date - b.date);
    const xirr = calculateXIRR(allCashflows);

    res.json({
      success: true,
      data: {
        xirr: Math.round(xirr * 10000) / 100, // as percentage
        cashflowCount: allCashflows.length,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── SIP Calendar ────────────────────────────────
router.get('/sip-calendar', (req, res) => {
  try {
    const sipAssets = db.prepare('SELECT id, name, category, sip_amount, sip_date, ticker, monthly_contribution FROM assets WHERE sip_amount > 0 OR monthly_contribution > 0 ORDER BY sip_date ASC').all();

    // Group by sip_date (day of month)
    const byDate = {};
    sipAssets.forEach(a => {
      const day = a.sip_date || 1;
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push({
        id: a.id,
        name: a.name,
        category: a.category,
        sip_amount: a.sip_amount || a.monthly_contribution || 0,
        sip_date: day,
        ticker: a.ticker,
      });
    });

    // Include liabilities with EMI for complete monthly outflow
    const emiLiabilities = db.prepare('SELECT id, name, type, emi, outstanding FROM liabilities WHERE emi > 0 ORDER BY emi DESC').all();

    const totalSIP = sipAssets.reduce((s, a) => s + (a.sip_amount || a.monthly_contribution || 0), 0);
    const totalEMI = emiLiabilities.reduce((s, l) => s + (l.emi || 0), 0);

    res.json({
      success: true,
      data: {
        sipsByDate: byDate,
        sipAssets,
        emiLiabilities,
        totalSIP,
        totalEMI,
        totalMonthlyOutflow: totalSIP + totalEMI,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Delete asset transaction (before /:id routes) ─────
router.delete('/transactions/:txnId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM asset_transactions WHERE id = ?').run(req.params.txnId);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Transaction not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get all assets tagged as emergency fund (before /:id routes)
router.get('/emergency-fund/linked', (req, res) => {
  try {
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const assets = db.prepare('SELECT * FROM assets WHERE is_emergency_fund = 1 ORDER BY current_value DESC').all()
      .map(a => enrichAsset(a, fxRate));
    res.json({ success: true, data: assets });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get single asset
router.get('/:id', (req, res) => {
  try {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    res.json({ success: true, data: enrichAsset(asset, fxRate) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Create asset
router.post('/', (req, res) => {
  try {
    const { id, name, category, subtype, invested_value, current_value, units, ticker, notes,
            currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution,
            asset_class, fund_type, purchase_date, retirement_subtype, nps_equity_pct, nps_debt_pct, is_emergency_fund } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Name is required' });
    if (name.length > 300) return res.status(400).json({ success: false, error: 'Name too long (max 300 chars)' });
    const numInvested = parseFloat(invested_value) || 0;
    const numCurrent = parseFloat(current_value) || numInvested;
    if (numInvested < 0 || numCurrent < 0) return res.status(400).json({ success: false, error: 'Values cannot be negative' });
    const validCurrencies = ['INR', 'USD'];
    const safeCurrency = validCurrencies.includes(currency) ? currency : 'INR';
    const assetId = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes,
      currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution, asset_class, fund_type, purchase_date, retirement_subtype, nps_equity_pct, nps_debt_pct, is_emergency_fund)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(assetId, name, category || 'Equity', subtype || '', invested_value || 0,
        current_value || invested_value || 0, units || 0, ticker || '', notes || '',
        currency || 'INR', interest_rate || 0, tenure_months || 0, bank_name || '',
        fund_house || '', monthly_contribution || 0, asset_class || '', fund_type || '', purchase_date || '',
        retirement_subtype || '', nps_equity_pct || 75, nps_debt_pct || 25, is_emergency_fund ? 1 : 0);
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    res.json({ success: true, data: enrichAsset(asset, fxRate) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Update asset
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Asset not found' });
    const { name, category, subtype, invested_value, current_value, units, ticker, notes,
            currency, interest_rate, tenure_months, bank_name, fund_house, monthly_contribution,
            asset_class, fund_type, purchase_date, retirement_subtype, nps_equity_pct, nps_debt_pct, is_emergency_fund } = req.body;
    db.prepare(`UPDATE assets SET name=?, category=?, subtype=?, invested_value=?, current_value=?,
      units=?, ticker=?, notes=?, currency=?, interest_rate=?, tenure_months=?, bank_name=?,
      fund_house=?, monthly_contribution=?, asset_class=?, fund_type=?, purchase_date=?,
      retirement_subtype=?, nps_equity_pct=?, nps_debt_pct=?, is_emergency_fund=?, updated_at=date('now') WHERE id=?`)
      .run(name || existing.name, category || existing.category, subtype ?? existing.subtype,
        invested_value ?? existing.invested_value, current_value ?? existing.current_value,
        units ?? existing.units, ticker ?? existing.ticker, notes ?? existing.notes,
        currency || existing.currency, interest_rate ?? existing.interest_rate,
        tenure_months ?? existing.tenure_months, bank_name ?? existing.bank_name,
        fund_house ?? existing.fund_house, monthly_contribution ?? existing.monthly_contribution,
        asset_class ?? existing.asset_class, fund_type ?? existing.fund_type,
        purchase_date ?? existing.purchase_date,
        retirement_subtype ?? existing.retirement_subtype,
        nps_equity_pct ?? existing.nps_equity_pct,
        nps_debt_pct ?? existing.nps_debt_pct,
        is_emergency_fund !== undefined ? (is_emergency_fund ? 1 : 0) : (existing.is_emergency_fund || 0),
        req.params.id);
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    res.json({ success: true, data: enrichAsset(asset, fxRate) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Delete asset
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Asset Transactions (buy/sell/dividend log) ────
// Get all transactions for an asset
router.get('/:id/transactions', (req, res) => {
  try {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const data = db.prepare('SELECT * FROM asset_transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC').all(req.params.id);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Add a transaction for an asset
router.post('/:id/transactions', (req, res) => {
  try {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const { date, type, units, price, amount, notes } = req.body;
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });
    if (!amount && amount !== 0) return res.status(400).json({ success: false, error: 'Amount is required' });

    const validTypes = ['buy', 'sell', 'dividend', 'switch'];
    const txnType = validTypes.includes(type) ? type : 'buy';

    const result = db.prepare(
      'INSERT INTO asset_transactions (asset_id, date, type, units, price, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, date, txnType, units || 0, price || 0, parseFloat(amount), notes || '');

    const txn = db.prepare('SELECT * FROM asset_transactions WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: txn });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── XIRR for a single asset ─────────────────────
router.get('/:id/xirr', (req, res) => {
  try {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const now = new Date();

    const txns = db.prepare('SELECT * FROM asset_transactions WHERE asset_id = ? ORDER BY date ASC').all(req.params.id);

    const cashflows = [];

    if (txns.length > 0) {
      for (const t of txns) {
        let amt = t.amount || 0;
        if (asset.currency === 'USD') amt *= fxRate;
        if (t.type === 'buy') {
          cashflows.push({ date: new Date(t.date), amount: -amt });
        } else if (t.type === 'sell' || t.type === 'dividend') {
          cashflows.push({ date: new Date(t.date), amount: amt });
        }
      }
    } else {
      // Use purchase_date + invested_value as buy
      const invested = asset.currency === 'USD' ? (asset.invested_value || 0) * fxRate : (asset.invested_value || 0);
      if (invested > 0) {
        const pDate = asset.purchase_date ? new Date(asset.purchase_date) : new Date(asset.created_at || now);
        cashflows.push({ date: pDate, amount: -invested });
      }
    }

    // Current value as final cashflow
    const currentVal = asset.currency === 'USD' ? (asset.current_value || 0) * fxRate : (asset.current_value || 0);
    if (currentVal > 0) {
      cashflows.push({ date: now, amount: currentVal });
    }

    if (cashflows.length < 2) {
      return res.json({ success: true, data: { xirr: 0, message: 'Not enough data to calculate XIRR' } });
    }

    cashflows.sort((a, b) => a.date - b.date);
    const xirr = calculateXIRR(cashflows);

    res.json({
      success: true,
      data: {
        xirr: Math.round(xirr * 10000) / 100, // as percentage
        cashflowCount: cashflows.length,
        assetName: asset.name,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Bulk upsert (for imports)
router.post('/bulk', (req, res) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets)) return res.status(400).json({ success: false, error: 'Expected array of assets' });

    const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const findByName = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
    const update = db.prepare(`UPDATE assets SET invested_value = invested_value + ?, current_value = current_value + ?,
      units = units + ?, updated_at = date('now') WHERE id = ?`);

    let imported = 0, consolidated = 0;
    const txn = db.transaction(() => {
      for (const a of assets) {
        if (!a.name) continue;
        const existing = findByName.get(a.name);
        if (existing) {
          update.run(a.invested_value || 0, a.current_value || a.invested_value || 0, a.units || 0, existing.id);
          consolidated++;
        } else {
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          insert.run(id, a.name.trim(), a.category || 'Equity', a.subtype || '',
            a.invested_value || 0, a.current_value || a.invested_value || 0,
            a.units || 0, a.ticker || '', a.notes || '');
          imported++;
        }
      }
    });
    txn();
    res.json({ success: true, imported, consolidated });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Bulk delete assets
router.post('/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, error: 'No asset IDs provided' });
    }
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM assets WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true, deleted: result.changes });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Toggle emergency fund flag for an asset
router.post('/:id/toggle-emergency-fund', (req, res) => {
  try {
    const asset = db.prepare('SELECT id, is_emergency_fund FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    const newVal = asset.is_emergency_fund ? 0 : 1;
    db.prepare('UPDATE assets SET is_emergency_fund = ?, updated_at = date(\'now\') WHERE id = ?').run(newVal, req.params.id);
    res.json({ success: true, is_emergency_fund: newVal });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
