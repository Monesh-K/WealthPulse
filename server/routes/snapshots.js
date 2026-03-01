const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM snapshots ORDER BY date ASC').all();
    res.json({ success: true, data });
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

module.exports = router;
