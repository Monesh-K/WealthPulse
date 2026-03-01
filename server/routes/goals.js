const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM goals ORDER BY target_year ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, target_amount, current_value, target_year, inflation, linked_asset, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Auto-link: if linked_asset is specified, find matching asset current value
    let cv = current_value || 0;
    if (linked_asset) {
      const match = db.prepare('SELECT * FROM assets WHERE LOWER(name) LIKE ?').get(`%${linked_asset.toLowerCase()}%`);
      if (match) cv = match.current_value || match.invested_value || cv;
    }

    db.prepare('INSERT INTO goals (id, name, target_amount, current_value, target_year, inflation, linked_asset, notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, name, target_amount || 0, cv, target_year || 2030, inflation || 6, linked_asset || '', notes || '');
    res.json({ success: true, data: db.prepare('SELECT * FROM goals WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, target_amount, current_value, target_year, inflation, linked_asset, notes } = req.body;
    let cv = current_value;
    if (linked_asset) {
      const match = db.prepare('SELECT * FROM assets WHERE LOWER(name) LIKE ?').get(`%${linked_asset.toLowerCase()}%`);
      if (match) cv = match.current_value || match.invested_value || cv;
    }
    db.prepare('UPDATE goals SET name=?, target_amount=?, current_value=?, target_year=?, inflation=?, linked_asset=?, notes=? WHERE id=?')
      .run(name, target_amount || 0, cv || 0, target_year || 2030, inflation || 6, linked_asset || '', notes || '', req.params.id);
    res.json({ success: true, data: db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
