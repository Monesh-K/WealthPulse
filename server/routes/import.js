const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../models/database');
const { refreshUSStockPrices } = require('../services/marketService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─────────────────────────────────────────────────
// Utility: generate unique ID
// ─────────────────────────────────────────────────
function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─────────────────────────────────────────────────
// Utility: parse flexible date formats
//   Handles: DD/MM/YYYY HH:MM:SS, YYYY-MM-DD, DD-MM-YYYY, Excel serial numbers
// ─────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return new Date().toISOString().split('T')[0];

  // Excel serial number
  if (typeof raw === 'number') {
    const d = new Date((raw - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }

  const s = String(raw).trim();

  // DD/MM/YYYY HH:MM:SS  or  DD/MM/YYYY
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (already ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Fallback: let JS parse
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];

  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────
// Utility: detect file format from columns
// ─────────────────────────────────────────────────
function detectFormat(rows, rawRows) {
  // Check for Money Manager (Expense_Manager.csv) format
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  const colSet = new Set(cols.map(c => c.toLowerCase().trim()));

  if (colSet.has('income/expense') && colSet.has('category') && (colSet.has('inr') || colSet.has('amount'))) {
    return 'money-manager';
  }

  // Check for INDMoney US Stocks format (header row has "Stock Symbol", "Avg. Price ($)")
  if (rawRows) {
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (Array.isArray(row) && row.some(c => String(c).includes('Stock Symbol')) && row.some(c => String(c).includes('Avg. Price'))) {
        return 'indmoney-us';
      }
    }
  }

  // Check for Groww Mutual Funds format (header row has "Scheme Name", "AMC", "Folio No.")
  if (rawRows) {
    for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
      const row = rawRows[i];
      if (Array.isArray(row) && row.some(c => String(c).includes('Scheme Name')) && row.some(c => String(c).includes('Folio No.'))) {
        return 'groww-mf';
      }
    }
  }

  // Check for Groww Stocks format (header row has "Stock Name", "ISIN", "Average buy price")
  if (rawRows) {
    for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
      const row = rawRows[i];
      if (Array.isArray(row) && row.some(c => String(c).includes('Stock Name')) && row.some(c => String(c).includes('ISIN'))) {
        return 'groww-stocks';
      }
    }
  }

  // Generic asset format
  if (colSet.has('name') || colSet.has('asset name') || colSet.has('scheme name') || colSet.has('stock name')) {
    return 'generic-assets';
  }

  // Generic transaction format
  if ((colSet.has('type') || colSet.has('income/expense')) && (colSet.has('amount') || colSet.has('inr'))) {
    return 'generic-transactions';
  }

  return 'unknown';
}

// ─────────────────────────────────────────────────
// Map Money Manager categories → WealthPulse transaction categories
// ─────────────────────────────────────────────────
const EXPENSE_CATEGORY_MAP = {
  '🍜 food': 'Food',
  'food': 'Food',
  '💄 beauty': 'Shopping',
  'beauty': 'Shopping',
  '💹investment': 'Investment',
  'investment': 'Investment',
  '🪑 household': 'Bills',
  'household': 'Bills',
  '📱recharge': 'Bills',
  'recharge': 'Bills',
  'entertainment': 'Entertainment',
  '🧘🏼 health': 'Health',
  'health': 'Health',
  '🚖 transport': 'Transport',
  'transport': 'Transport',
  'loan': 'EMI',
  'insurance': 'Insurance',
  'room': 'Rent',
  'rent': 'Rent',
  'bank charges': 'Bills',
  'other': 'Other',
  'gold': 'Investment',
  'gift': 'Other',
  '🏧cashout': 'Other',
  'cashout': 'Other',
  'modified bal.': 'Other',
};

const INCOME_CATEGORY_MAP = {
  '💰 salary': 'Salary',
  'salary': 'Salary',
  '🏅 dividend': 'Investments',
  'dividend': 'Investments',
  '💵 gift/reward': 'Gift',
  'gift/reward': 'Gift',
  'gift': 'Gift',
  'other': 'Other',
};

function mapTransactionCategory(rawCategory, type) {
  const key = (rawCategory || '').toLowerCase().trim();
  if (type === 'income') {
    return INCOME_CATEGORY_MAP[key] || 'Other';
  }
  return EXPENSE_CATEGORY_MAP[key] || 'Other';
}

// ─────────────────────────────────────────────────
// AUTO-DETECT import: Detects file format and routes accordingly
// ─────────────────────────────────────────────────
router.post('/auto', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    const format = detectFormat(rows, rawRows);

    switch (format) {
      case 'money-manager':
        return importMoneyManager(rows, res);
      case 'groww-mf':
        return importGrowwMutualFunds(rawRows, res);
      case 'groww-stocks':
        return importGrowwStocks(rawRows, res);
      case 'indmoney-us':
        return importINDMoneyUS(rawRows, res);
      case 'generic-assets':
        return importGenericAssets(rows, res);
      case 'generic-transactions':
        return importGenericTransactions(rows, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Could not detect file format. Supported formats: Money Manager export, Groww Mutual Funds, Groww Stocks, INDMoney US Stocks, or generic CSV with name/amount columns.',
          detectedColumns: rows.length > 0 ? Object.keys(rows[0]) : [],
        });
    }
  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────
// MONEY MANAGER (Expense_Manager.csv) → Transactions
// ─────────────────────────────────────────────────
function importMoneyManager(rows, res) {
  const insert = db.prepare('INSERT INTO transactions (id, type, amount, description, category, subcategory, date) VALUES (?,?,?,?,?,?,?)');
  const findDupe = db.prepare('SELECT id FROM transactions WHERE date = ? AND amount = ? AND category = ? AND description = ?');

  let imported = 0, skipped = 0, transferSkipped = 0;

  const txn = db.transaction(() => {
    for (const r of rows) {
      const rawType = (r['Income/Expense'] || '').trim();

      // Skip transfers (inter-account movements, not real income/expense)
      if (rawType === 'Transfer-Out' || rawType === 'Transfer-In') {
        transferSkipped++;
        continue;
      }

      const type = rawType === 'Income' ? 'income' : 'expense';
      const amount = Math.abs(Number(r['INR'] || r['Amount'] || 0));
      if (!amount || amount === 0) { skipped++; continue; }

      const rawCategory = (r['Category'] || '').trim();
      const rawSubcategory = (r['Subcategory'] || '').trim();
      const note = (r['Note'] || '').trim();
      const description = (r['Description'] || '').trim();
      const date = parseDate(r['Date']);

      // Build a meaningful description from note + description (no longer embed subcategory here)
      const descParts = [];
      if (note) descParts.push(note);
      if (description) descParts.push(description);
      const finalDesc = descParts.join(' — ') || '';

      const category = mapTransactionCategory(rawCategory, type);
      // Store the original subcategory from Money Manager
      const subcategory = rawSubcategory || '';

      // Duplicate check: same date + amount + category + description
      const existing = findDupe.get(date, amount, category, finalDesc);
      if (existing) { skipped++; continue; }

      insert.run(uid('txn_'), type, amount, finalDesc, category, subcategory, date);
      imported++;
    }
  });
  txn();

  res.json({
    success: true,
    format: 'Money Manager',
    importType: 'transactions',
    imported,
    skipped,
    transferSkipped,
    total: rows.length,
  });
}

// ─────────────────────────────────────────────────
// GROWW MUTUAL FUNDS → Assets
// File structure: Header rows, then "Scheme Name" row at ~row 18, data from row 20+
// ─────────────────────────────────────────────────
function importGrowwMutualFunds(rawRows, res) {
  // Find the header row (contains "Scheme Name")
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some(c => String(c).trim() === 'Scheme Name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return res.status(400).json({ success: false, error: 'Could not find "Scheme Name" header in Mutual Funds file' });
  }

  const headers = rawRows[headerIdx].map(h => String(h).trim());

  // Also extract portfolio summary if available
  let totalInvested = 0, portfolioValue = 0;
  for (let i = 0; i < headerIdx; i++) {
    if (rawRows[i] && String(rawRows[i][0]).includes('Total Investments')) {
      const summaryRow = rawRows[i + 1];
      if (summaryRow) {
        totalInvested = Number(summaryRow[0]) || 0;
        portfolioValue = Number(summaryRow[1]) || 0;
      }
    }
  }

  const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes, fund_house, currency, asset_class, fund_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'Mutual Fund', ?)`);
  const findByNameAndFolio = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND notes LIKE ?');
  const updateAsset = db.prepare(`UPDATE assets SET invested_value = ?, current_value = ?, units = ?, fund_house = ?, updated_at = date('now') WHERE id = ?`);

  let imported = 0, updated = 0, skipped = 0;

  const colIdx = (name) => headers.indexOf(name);
  const schemeIdx = colIdx('Scheme Name');
  const amcIdx = colIdx('AMC');
  const catIdx = colIdx('Category');
  const subcatIdx = colIdx('Sub-category');
  const folioIdx = colIdx('Folio No.');
  const sourceIdx = colIdx('Source');
  const unitsIdx = colIdx('Units');
  const investedIdx = colIdx('Invested Value');
  const currentIdx = colIdx('Current Value');
  const returnsIdx = colIdx('Returns');
  const xirrIdx = colIdx('XIRR');

  const txn = db.transaction(() => {
    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const schemeName = String(row[schemeIdx] || '').trim();
      if (!schemeName) continue;

      const amc = String(row[amcIdx] || '').trim();
      const mfCategory = String(row[catIdx] || '').trim();
      const subcategory = String(row[subcatIdx] || '').trim();
      const folio = String(row[folioIdx] || '').trim();
      const source = String(row[sourceIdx] || '').trim();
      const units = Number(row[unitsIdx]) || 0;
      const invested = Number(row[investedIdx]) || 0;
      const current = Number(row[currentIdx]) || 0;
      const returns = row[returnsIdx];
      const xirr = String(row[xirrIdx] || '').trim();

      if (!invested && !current && !units) { skipped++; continue; }

      // Map MF category to WealthPulse asset category
      let wealthCategory = 'Equity';
      let fundType = 'Equity';
      const catLower = mfCategory.toLowerCase();
      const subLower = subcategory.toLowerCase();
      if (catLower.includes('commodit') || catLower.includes('gold') || catLower.includes('silver')) {
        wealthCategory = 'Gold';
        fundType = 'Commodity';
      } else if (subLower.includes('liquid') || subLower.includes('money market') || subLower.includes('overnight') || subLower.includes('ultra short')) {
        wealthCategory = 'Debt';
        fundType = 'Liquid';
      } else if (subLower.includes('arbitrage')) {
        wealthCategory = 'Equity';
        fundType = 'Arbitrage';
      } else if (catLower.includes('debt') || subLower.includes('gilt') || subLower.includes('bond') || subLower.includes('credit') || subLower.includes('short duration') || subLower.includes('medium duration') || subLower.includes('long duration') || subLower.includes('banking') || subLower.includes('corporate')) {
        wealthCategory = 'Debt';
        fundType = 'Debt';
      } else if (catLower.includes('hybrid') || subLower.includes('hybrid') || subLower.includes('balanced') || subLower.includes('multi asset') || subLower.includes('conservative hybrid') || subLower.includes('regular savings')) {
        wealthCategory = 'Debt';
        fundType = 'Hybrid';
      }

      const subtype = subcategory ? `Mutual Fund — ${subcategory}` : 'Mutual Fund';
      const notes = `Folio: ${folio} | Source: ${source}${xirr ? ' | XIRR: ' + xirr : ''}`;

      // Check if this exact fund + folio already exists
      const existing = findByNameAndFolio.get(schemeName, `%Folio: ${folio}%`);
      if (existing) {
        updateAsset.run(invested, current, units, amc, existing.id);
        updated++;
      } else {
        insert.run(uid('mf_'), schemeName, wealthCategory, subtype, invested, current, units, '', notes, amc, fundType);
        imported++;
      }
    }
  });
  txn();

  res.json({
    success: true,
    format: 'Groww Mutual Funds',
    importType: 'assets',
    imported,
    updated,
    skipped,
    total: rawRows.length - headerIdx - 1,
    portfolioSummary: totalInvested > 0 ? { totalInvested, portfolioValue, pnl: portfolioValue - totalInvested } : null,
  });
}

// ─────────────────────────────────────────────────
// GROWW STOCKS HOLDINGS → Assets
// File structure: Name row, summary rows, then "Stock Name" header, data rows
// ─────────────────────────────────────────────────
function importGrowwStocks(rawRows, res) {
  // Find the header row (contains "Stock Name")
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some(c => String(c).trim() === 'Stock Name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return res.status(400).json({ success: false, error: 'Could not find "Stock Name" header in Stocks file' });
  }

  const headers = rawRows[headerIdx].map(h => String(h).trim());

  // Extract portfolio summary
  let totalInvested = 0, closingValue = 0;
  for (let i = 0; i < headerIdx; i++) {
    if (rawRows[i] && String(rawRows[i][0]).trim() === 'Invested Value') {
      totalInvested = Number(rawRows[i][1]) || 0;
    }
    if (rawRows[i] && String(rawRows[i][0]).trim() === 'Closing Value') {
      closingValue = Number(rawRows[i][1]) || 0;
    }
  }

  const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes, currency, asset_class)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?)`);
  const findByISIN = db.prepare('SELECT * FROM assets WHERE ticker = ?');
  const findByName = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
  const updateAsset = db.prepare(`UPDATE assets SET invested_value = ?, current_value = ?, units = ?, updated_at = date('now') WHERE id = ?`);

  let imported = 0, updated = 0, skipped = 0;

  const colIdx = (name) => headers.indexOf(name);
  const nameIdx = colIdx('Stock Name');
  const isinIdx = colIdx('ISIN');
  const qtyIdx = colIdx('Quantity');
  const avgPriceIdx = colIdx('Average buy price');
  const buyValueIdx = colIdx('Buy value');
  const closePriceIdx = colIdx('Closing price');
  const closeValueIdx = colIdx('Closing value');
  const pnlIdx = colIdx('Unrealised P&L');

  const txn = db.transaction(() => {
    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const stockName = String(row[nameIdx] || '').trim();
      if (!stockName) continue;

      const isin = String(row[isinIdx] || '').trim();
      const qty = Number(row[qtyIdx]) || 0;
      const avgPrice = Number(row[avgPriceIdx]) || 0;
      const buyValue = Number(row[buyValueIdx]) || 0;
      const closePrice = Number(row[closePriceIdx]) || 0;
      const closeValue = Number(row[closeValueIdx]) || 0;
      const pnl = Number(row[pnlIdx]) || 0;

      if (!buyValue && !closeValue && !qty) { skipped++; continue; }

      // Determine category: ETFs and fund-like names → different handling
      let subtype = 'Stock';
      let category = 'Equity';
      const nameLower = stockName.toLowerCase();
      if (nameLower.includes('etf') || nameLower.includes('gold') || nameLower.includes('tatagold')) {
        subtype = 'ETF';
        if (nameLower.includes('gold')) category = 'Gold';
      }
      if (nameLower.includes('fmcg') || nameLower.includes('nifty') || nameLower.includes('index')) {
        subtype = 'ETF';
      }

      const notes = `ISIN: ${isin} | Avg Price: ₹${avgPrice.toFixed(2)} | Close Price: ₹${closePrice.toFixed(2)} | P&L: ₹${pnl.toFixed(2)}`;

      // Check for existing by ISIN first, then by name
      let existing = isin ? findByISIN.get(isin) : null;
      if (!existing) existing = findByName.get(stockName);

      if (existing) {
        updateAsset.run(buyValue, closeValue, qty, existing.id);
        updated++;
      } else {
        insert.run(uid('stk_'), stockName, category, subtype, buyValue, closeValue, qty, isin, notes, subtype === 'ETF' ? 'ETF' : 'Stock');
        imported++;
      }
    }
  });
  txn();

  res.json({
    success: true,
    format: 'Groww Stocks',
    importType: 'assets',
    imported,
    updated,
    skipped,
    total: rawRows.length - headerIdx - 1,
    portfolioSummary: totalInvested > 0 ? { totalInvested, closingValue, pnl: closingValue - totalInvested } : null,
  });
}

// ─────────────────────────────────────────────────
// INDMONEY US STOCKS → Assets (International)
// File structure: Header rows, then "Stock Symbol" header row, data rows
// ─────────────────────────────────────────────────
function importINDMoneyUS(rawRows, res) {
  // Find the header row (contains "Stock Symbol")
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some(c => String(c).trim() === 'Stock Symbol')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return res.status(400).json({ success: false, error: 'Could not find "Stock Symbol" header in INDMoney file' });
  }

  const headers = rawRows[headerIdx].map(h => String(h).trim());

  // Extract holdings date
  let holdingsDate = '';
  for (let i = 0; i < headerIdx; i++) {
    if (rawRows[i] && String(rawRows[i][0]).trim() === 'Holdings as on') {
      holdingsDate = String(rawRows[i][1] || '').trim();
    }
  }

  const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes, currency, fx_rate, asset_class, purchase_date)
    VALUES (?, ?, 'International', 'US Stock', ?, ?, ?, ?, ?, 'USD', ?, 'Stock', ?)`);
  const findByTicker = db.prepare('SELECT * FROM assets WHERE ticker = ? AND category = ?');
  const updateAsset = db.prepare(`UPDATE assets SET invested_value = ?, current_value = ?, units = ?, fx_rate = ?, updated_at = date('now') WHERE id = ?`);

  let imported = 0, updated = 0, skipped = 0;

  // Get FX rate for INR → USD conversion (INDMoney Total Value is in INR)
  const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
  const fxRate = fxRow ? Number(fxRow.value) : 85;

  const colIdx = (name) => headers.findIndex(h => h.includes(name));
  const symbolIdx = colIdx('Stock Symbol');
  const sinceIdx = colIdx('Holding Since');
  const qtyIdx = colIdx('Quantity');
  const avgPriceIdx = colIdx('Avg. Price');
  const totalValIdx = colIdx('Total Value');

  // Detect if Total Value column is in USD or INR
  const totalValHeader = headers[totalValIdx] || '';
  const totalValIsUSD = totalValHeader.includes('$') || totalValHeader.toLowerCase().includes('usd');

  const txn = db.transaction(() => {
    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const symbol = String(row[symbolIdx] || '').trim();
      if (!symbol) continue;

      const qty = Number(row[qtyIdx]) || 0;
      const avgPrice = Number(row[avgPriceIdx]) || 0;
      const totalValue = Number(row[totalValIdx]) || 0;
      const holdingSince = String(row[sinceIdx] || '').trim();

      if (!qty && !totalValue) { skipped++; continue; }

      // Parse purchase date from "Holding Since" (e.g. "05 Feb 2026, 02:10 PM")
      let purchaseDate = '';
      if (holdingSince) {
        try {
          const d = new Date(holdingSince.replace(',', ''));
          if (!isNaN(d.getTime())) {
            purchaseDate = d.toISOString().split('T')[0];
          }
        } catch {}
      }

      // invested_value = qty * avg price (USD)
      const investedValue = qty * avgPrice;
      // current_value: store in USD (will be converted to INR by enrichAsset on read)
      // If it's in INR, convert to USD; if already in USD, use as-is.
      let currentValueUSD;
      if (totalValIsUSD) {
        currentValueUSD = totalValue;  // already USD
      } else {
        currentValueUSD = fxRate > 0 ? totalValue / fxRate : totalValue;  // INR → USD
      }
      // Use invested value as initial current_value; live prices will update it on refresh
      if (!currentValueUSD) currentValueUSD = investedValue;

      const notes = `Broker: INDMoney/Alpaca | Since: ${holdingSince}${holdingsDate ? ' | As on: ' + holdingsDate : ''}`;

      // Check for existing by ticker
      const existing = findByTicker.get(symbol, 'International');
      if (existing) {
        updateAsset.run(investedValue, currentValueUSD, qty, fxRate, existing.id);
        updated++;
      } else {
        insert.run(uid('us_'), symbol, investedValue, currentValueUSD, qty, symbol, notes, fxRate, purchaseDate);
        imported++;
      }
    }
  });
  txn();

  // Trigger async price refresh for US stocks after import
  refreshUSStockPrices(db).catch(e => console.warn('[Import] Post-import US stock refresh failed:', e.message));

  res.json({
    success: true,
    format: 'INDMoney US Stocks',
    importType: 'assets',
    imported,
    updated,
    skipped,
    total: rawRows.length - headerIdx - 1,
  });
}

// ─────────────────────────────────────────────────
// GENERIC ASSETS IMPORT (fallback for standard CSV)
// ─────────────────────────────────────────────────
function importGenericAssets(rows, res) {
  const insert = db.prepare(`INSERT INTO assets (id, name, category, subtype, invested_value, current_value, units, ticker, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const findByName = db.prepare('SELECT * FROM assets WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
  const update = db.prepare(`UPDATE assets SET invested_value = invested_value + ?, current_value = current_value + ?,
    units = units + ?, updated_at = date('now') WHERE id = ?`);

  let imported = 0, consolidated = 0;
  const txn = db.transaction(() => {
    for (const r of rows) {
      const name = (r.name || r.Name || r['Asset Name'] || r['Scheme Name'] || r['Stock Name'] || '').trim();
      if (!name) continue;
      const existing = findByName.get(name);
      const inv = Number(r.invested_value || r['Invested Value'] || r['Buy value'] || r.invested || 0);
      const cur = Number(r.current_value || r['Current Value'] || r['Closing value'] || r.current || inv);
      const units = Number(r.units || r.Units || r.Quantity || 0);
      if (existing) {
        update.run(inv, cur, units, existing.id);
        consolidated++;
      } else {
        insert.run(uid('ast_'), name, r.category || r.Category || 'Equity', r.subtype || r.Subtype || r['Sub-category'] || '',
          inv, cur, units, r.ticker || r.Ticker || r.ISIN || '', r.notes || r.Notes || '');
        imported++;
      }
    }
  });
  txn();
  res.json({ success: true, format: 'Generic CSV', importType: 'assets', imported, consolidated, total: rows.length });
}

// ─────────────────────────────────────────────────
// GENERIC TRANSACTIONS IMPORT (fallback for standard CSV)
// ─────────────────────────────────────────────────
function importGenericTransactions(rows, res) {
  const insert = db.prepare('INSERT INTO transactions (id, type, amount, description, category, subcategory, date) VALUES (?,?,?,?,?,?,?)');
  let count = 0;
  const txn = db.transaction(() => {
    for (const r of rows) {
      const amount = Math.abs(Number(r.amount || r.Amount || r.INR || 0));
      if (!amount) continue;
      const rawType = (r.type || r.Type || r['Income/Expense'] || 'expense').trim().toLowerCase();
      const type = rawType === 'income' ? 'income' : 'expense';
      insert.run(uid('txn_'), type, amount,
        r.description || r.Description || r.Note || '', r.category || r.Category || 'Other',
        r.subcategory || r.Subcategory || '',
        parseDate(r.date || r.Date));
      count++;
    }
  });
  txn();
  res.json({ success: true, format: 'Generic CSV', importType: 'transactions', imported: count, total: rows.length });
}

// ─────────────────────────────────────────────────
// Keep direct endpoints for backward compatibility
// ─────────────────────────────────────────────────
router.post('/assets', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    const format = detectFormat(rows, rawRows);
    if (format === 'groww-mf') return importGrowwMutualFunds(rawRows, res);
    if (format === 'groww-stocks') return importGrowwStocks(rawRows, res);
    if (format === 'indmoney-us') return importINDMoneyUS(rawRows, res);
    return importGenericAssets(rows, res);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/transactions', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const format = detectFormat(rows, null);
    if (format === 'money-manager') return importMoneyManager(rows, res);
    return importGenericTransactions(rows, res);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────
// PREVIEW: Return parsed data preview without importing
// ─────────────────────────────────────────────────
router.post('/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    const format = detectFormat(rows, rawRows);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    let preview = [];
    let summary = {};

    if (format === 'money-manager') {
      const incomeRows = rows.filter(r => r['Income/Expense'] === 'Income');
      const expenseRows = rows.filter(r => r['Income/Expense'] === 'Expense');
      const transferRows = rows.filter(r => (r['Income/Expense'] || '').includes('Transfer'));
      const totalIncome = incomeRows.reduce((s, r) => s + Math.abs(Number(r.INR || r.Amount || 0)), 0);
      const totalExpense = expenseRows.reduce((s, r) => s + Math.abs(Number(r.INR || r.Amount || 0)), 0);
      preview = rows.slice(0, 10).map(r => ({
        date: parseDate(r.Date),
        type: r['Income/Expense'],
        amount: Number(r.INR || r.Amount || 0),
        category: r.Category,
        subcategory: r.Subcategory,
        note: r.Note,
      }));
      summary = {
        totalRows: rows.length,
        incomeCount: incomeRows.length,
        expenseCount: expenseRows.length,
        transferCount: transferRows.length,
        totalIncome,
        totalExpense,
        dateRange: rows.length > 0 ? {
          from: parseDate(rows[rows.length - 1].Date),
          to: parseDate(rows[0].Date),
        } : null,
      };
    } else if (format === 'groww-mf' || format === 'groww-stocks' || format === 'indmoney-us') {
      // Find header row
      let headerIdx = -1;
      const searchTerms = { 'groww-mf': 'Scheme Name', 'groww-stocks': 'Stock Name', 'indmoney-us': 'Stock Symbol' };
      const searchTerm = searchTerms[format] || 'Name';
      for (let i = 0; i < rawRows.length; i++) {
        if (rawRows[i].some(c => String(c).trim().includes(searchTerm))) { headerIdx = i; break; }
      }
      if (headerIdx >= 0) {
        const headers = rawRows[headerIdx].map(h => String(h).trim());
        const dataRows = rawRows.slice(headerIdx + 1).filter(r => String(r[0] || '').trim());
        summary = { totalHoldings: dataRows.length, format };
        preview = dataRows.slice(0, 10).map(row => {
          const obj = {};
          headers.forEach((h, idx) => { if (h) obj[h] = row[idx]; });
          return obj;
        });
      }
    } else {
      preview = rows.slice(0, 10);
      summary = { totalRows: rows.length };
    }

    res.json({ success: true, format, columns, preview, summary, sheetName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
