const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM liabilities ORDER BY outstanding DESC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, type, outstanding, rate, emi, tenure, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO liabilities (id, name, type, outstanding, rate, emi, tenure, notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, name, type || 'Other', outstanding || 0, rate || 0, emi || 0, tenure || 0, notes || '');
    res.json({ success: true, data: db.prepare('SELECT * FROM liabilities WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, type, outstanding, rate, emi, tenure, notes } = req.body;
    db.prepare(`UPDATE liabilities SET name=?, type=?, outstanding=?, rate=?, emi=?, tenure=?, notes=?, updated_at=date('now') WHERE id=?`)
      .run(name, type, outstanding || 0, rate || 0, emi || 0, tenure || 0, notes || '', req.params.id);
    res.json({ success: true, data: db.prepare('SELECT * FROM liabilities WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM liabilities WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
