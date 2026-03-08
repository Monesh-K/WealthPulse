const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM snapshots ORDER BY date ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Stacked Allocation History ──────────────────
router.get('/allocation-history', (req, res) => {
  try {
    const snapshots = db.prepare('SELECT id, date, allocation, assets, net_worth FROM snapshots ORDER BY date ASC').all();

    // Collect all unique categories across all snapshots
    const allCategories = new Set();
    const parsed = snapshots.map(s => {
      let allocation = {};
      try {
        allocation = JSON.parse(s.allocation || '{}');
      } catch { allocation = {}; }
      Object.keys(allocation).forEach(cat => allCategories.add(cat));
      return { date: s.date, allocation, totalAssets: s.assets, netWorth: s.net_worth };
    });

    const categories = Array.from(allCategories).sort();

    // Build time-series data: for each snapshot, fill in 0 for missing categories
    const series = parsed.map(s => {
      const row = { date: s.date, totalAssets: s.totalAssets, netWorth: s.netWorth };
      categories.forEach(cat => {
        row[cat] = s.allocation[cat] || 0;
      });
      return row;
    });

    res.json({ success: true, data: { series, categories } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets').all();
    const liabilities = db.prepare('SELECT * FROM liabilities').all();

    // Get FX rate for USD → INR conversion
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;
    const getINR = (a) => {
      const val = a.current_value || a.invested_value || 0;
      return a.currency === 'USD' ? val * fxRate : val;
    };

    const totalAssets = assets.reduce((s, a) => s + getINR(a), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);

    const cats = {};
    assets.forEach(a => {
      const cat = a.category || 'Other';
      cats[cat] = (cats[cat] || 0) + getINR(a);
    });

    const date = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO snapshots (date, assets, liabilities, net_worth, allocation) VALUES (?,?,?,?,?)')
      .run(date, totalAssets, totalLiabilities, totalAssets - totalLiabilities, JSON.stringify(cats));

    const snap = db.prepare('SELECT * FROM snapshots ORDER BY id DESC LIMIT 1').get();
    res.json({ success: true, data: snap });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM snapshots WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date. Use YYYY-MM-DD format.' });
    }
    const snap = db.prepare('SELECT id FROM snapshots WHERE id = ?').get(req.params.id);
    if (!snap) return res.status(404).json({ success: false, error: 'Snapshot not found' });
    db.prepare('UPDATE snapshots SET date = ? WHERE id = ?').run(date, req.params.id);
    const updated = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
