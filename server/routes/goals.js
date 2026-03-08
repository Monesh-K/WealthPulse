const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const goals = db.prepare('SELECT * FROM goals ORDER BY target_year ASC').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    // Enrich each goal with linkedAssetValue from goal_assets join table
    const data = goals.map(g => {
      const linkedAssets = db.prepare(`
        SELECT a.current_value, a.currency FROM goal_assets ga
        JOIN assets a ON ga.asset_id = a.id
        WHERE ga.goal_id = ?
      `).all(g.id);

      const linkedAssetValue = linkedAssets.reduce((s, a) => {
        const val = a.current_value || 0;
        return s + (a.currency === 'USD' ? val * fxRate : val);
      }, 0);

      return { ...g, linkedAssetValue, linkedAssetCount: linkedAssets.length };
    });

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

// ─── Goal-Asset Linking ──────────────────────────
// Get linked assets for a goal
router.get('/:id/assets', (req, res) => {
  try {
    const goal = db.prepare('SELECT id FROM goals WHERE id = ?').get(req.params.id);
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' });

    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const assets = db.prepare(`
      SELECT a.* FROM goal_assets ga
      JOIN assets a ON ga.asset_id = a.id
      WHERE ga.goal_id = ?
      ORDER BY a.current_value DESC
    `).all(req.params.id);

    const data = assets.map(a => {
      const val = a.currency === 'USD' ? (a.current_value || 0) * fxRate : (a.current_value || 0);
      return { ...a, current_value_inr: val };
    });

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Link assets to a goal (replace all links)
router.post('/:id/link-assets', (req, res) => {
  try {
    const goal = db.prepare('SELECT id FROM goals WHERE id = ?').get(req.params.id);
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' });

    const { assetIds } = req.body;
    if (!Array.isArray(assetIds)) return res.status(400).json({ success: false, error: 'assetIds must be an array' });

    const txn = db.transaction(() => {
      // Remove existing links
      db.prepare('DELETE FROM goal_assets WHERE goal_id = ?').run(req.params.id);
      // Insert new links
      const insert = db.prepare('INSERT INTO goal_assets (goal_id, asset_id) VALUES (?, ?)');
      for (const assetId of assetIds) {
        insert.run(req.params.id, assetId);
      }
    });
    txn();

    res.json({ success: true, linked: assetIds.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
