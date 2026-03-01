const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    const alloc = db.prepare('SELECT * FROM target_allocation').all();
    const targetAllocation = {};
    alloc.forEach(a => { targetAllocation[a.category] = a.percentage; });

    // Reconstruct salaryStructure from stored JSON
    let salaryStructure = {};
    if (settings.salaryStructure) {
      try { salaryStructure = JSON.parse(settings.salaryStructure); } catch { salaryStructure = {}; }
    }

    // Reconstruct epfNpsConfig from stored JSON
    let epfNpsConfig = {};
    if (settings.epfNpsConfig) {
      try { epfNpsConfig = JSON.parse(settings.epfNpsConfig); } catch { epfNpsConfig = {}; }
    }

    res.json({ success: true, data: { ...settings, targetAllocation, salaryStructure, epfNpsConfig } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/', (req, res) => {
  try {
    const { name, currency, targetAllocation, salaryStructure, epfNpsConfig, monthly_ctc, basic_salary, epf_pct, nps_pct, nps_equity_pct, nps_debt_pct } = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    if (name !== undefined) upsert.run('name', name);
    if (currency !== undefined) upsert.run('currency', currency);
    if (monthly_ctc !== undefined) upsert.run('monthly_ctc', String(monthly_ctc));
    if (basic_salary !== undefined) upsert.run('basic_salary', String(basic_salary));
    if (epf_pct !== undefined) upsert.run('epf_pct', String(epf_pct));
    if (nps_pct !== undefined) upsert.run('nps_pct', String(nps_pct));
    if (nps_equity_pct !== undefined) upsert.run('nps_equity_pct', String(nps_equity_pct));
    if (nps_debt_pct !== undefined) upsert.run('nps_debt_pct', String(nps_debt_pct));

    // Store salary structure as JSON
    if (salaryStructure !== undefined) {
      upsert.run('salaryStructure', JSON.stringify(salaryStructure));
    }

    // Store EPF/NPS config as JSON
    if (epfNpsConfig !== undefined) {
      upsert.run('epfNpsConfig', JSON.stringify(epfNpsConfig));
    }

    if (targetAllocation) {
      const allocUpsert = db.prepare('INSERT OR REPLACE INTO target_allocation (category, percentage) VALUES (?, ?)');
      const txn = db.transaction(() => {
        Object.entries(targetAllocation).forEach(([cat, pct]) => allocUpsert.run(cat, pct));
      });
      txn();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Export all data as JSON
router.get('/export', (req, res) => {
  try {
    const data = {
      assets: db.prepare('SELECT * FROM assets').all(),
      liabilities: db.prepare('SELECT * FROM liabilities').all(),
      goals: db.prepare('SELECT * FROM goals').all(),
      transactions: db.prepare('SELECT * FROM transactions').all(),
      snapshots: db.prepare('SELECT * FROM snapshots').all(),
      essentials: db.prepare('SELECT * FROM essentials WHERE id = 1').get(),
      settings: db.prepare('SELECT * FROM settings').all(),
      targetAllocation: db.prepare('SELECT * FROM target_allocation').all(),
      exportedAt: new Date().toISOString()
    };
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Import/restore from JSON backup
router.post('/import', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ success: false, error: 'No data provided' });

    const txn = db.transaction(() => {
      if (data.assets) {
        db.prepare('DELETE FROM assets').run();
        const stmt = db.prepare(`INSERT INTO assets (id,name,category,subtype,invested_value,current_value,units,ticker,notes,currency,fx_rate,interest_rate,tenure_months,maturity_value,bank_name,fund_house,monthly_contribution,asset_class,fund_type,sip_amount,sip_date,purchase_date,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        data.assets.forEach(a => stmt.run(a.id, a.name, a.category, a.subtype, a.invested_value, a.current_value, a.units, a.ticker, a.notes, a.currency || 'INR', a.fx_rate || 1, a.interest_rate || 0, a.tenure_months || 0, a.maturity_value || 0, a.bank_name || '', a.fund_house || '', a.monthly_contribution || 0, a.asset_class || '', a.fund_type || '', a.sip_amount || 0, a.sip_date || 0, a.purchase_date || '', a.updated_at, a.created_at));
      }
      if (data.liabilities) {
        db.prepare('DELETE FROM liabilities').run();
        const stmt = db.prepare('INSERT INTO liabilities (id,name,type,outstanding,rate,emi,tenure,notes) VALUES (?,?,?,?,?,?,?,?)');
        data.liabilities.forEach(l => stmt.run(l.id, l.name, l.type, l.outstanding, l.rate, l.emi, l.tenure, l.notes));
      }
      if (data.goals) {
        db.prepare('DELETE FROM goals').run();
        const stmt = db.prepare('INSERT INTO goals (id,name,target_amount,current_value,target_year,inflation,linked_asset,notes) VALUES (?,?,?,?,?,?,?,?)');
        data.goals.forEach(g => stmt.run(g.id, g.name, g.target_amount, g.current_value, g.target_year, g.inflation, g.linked_asset, g.notes));
      }
      if (data.transactions) {
        db.prepare('DELETE FROM transactions').run();
        const stmt = db.prepare('INSERT INTO transactions (id,type,amount,description,category,subcategory,date,bank_account) VALUES (?,?,?,?,?,?,?,?)');
        data.transactions.forEach(t => stmt.run(t.id, t.type, t.amount, t.description, t.category, t.subcategory || '', t.date, t.bank_account || ''));
      }
      if (data.snapshots) {
        db.prepare('DELETE FROM snapshots').run();
        const stmt = db.prepare('INSERT INTO snapshots (date,assets,liabilities,net_worth,allocation) VALUES (?,?,?,?,?)');
        data.snapshots.forEach(s => stmt.run(s.date, s.assets, s.liabilities, s.net_worth, s.allocation));
      }
    });
    txn();
    res.json({ success: true, message: 'Data restored successfully' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
