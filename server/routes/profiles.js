const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Get all profiles
router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get profile summary — total assets, liabilities, net worth per profile
router.get('/summary', (req, res) => {
  try {
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC').all();
    const fxRow = db.prepare("SELECT value FROM settings WHERE key = 'usd_inr'").get();
    const fxRate = fxRow ? Number(fxRow.value) : 85;

    const summary = profiles.map(profile => {
      // Assets for this profile (profile_id match, or NULL for default)
      let assets;
      if (profile.is_default) {
        assets = db.prepare('SELECT * FROM assets WHERE profile_id IS NULL OR profile_id = ?').all(profile.id);
      } else {
        assets = db.prepare('SELECT * FROM assets WHERE profile_id = ?').all(profile.id);
      }

      let liabilities;
      if (profile.is_default) {
        liabilities = db.prepare('SELECT * FROM liabilities WHERE profile_id IS NULL OR profile_id = ?').all(profile.id);
      } else {
        liabilities = db.prepare('SELECT * FROM liabilities WHERE profile_id = ?').all(profile.id);
      }

      const totalAssets = assets.reduce((s, a) => {
        const val = a.current_value || 0;
        return s + (a.currency === 'USD' ? val * fxRate : val);
      }, 0);
      const totalLiabilities = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);

      return {
        ...profile,
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        assetCount: assets.length,
        liabilityCount: liabilities.length,
      };
    });

    // Also add an "Unassigned" bucket for assets/liabilities with NULL profile_id
    // (only if there are non-default profiles)
    res.json({ success: true, data: summary });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Create profile
router.post('/', (req, res) => {
  try {
    const { name, relationship, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Name is required' });

    const result = db.prepare('INSERT INTO profiles (name, relationship, color) VALUES (?, ?, ?)')
      .run(name.trim(), relationship || 'Other', color || '#6366f1');

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: profile });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Update profile
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Profile not found' });

    const { name, relationship, color } = req.body;
    db.prepare('UPDATE profiles SET name = ?, relationship = ?, color = ? WHERE id = ?')
      .run(name || existing.name, relationship || existing.relationship, color || existing.color, req.params.id);

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: profile });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Delete profile — disassociate assets/liabilities/goals by setting profile_id=NULL
router.delete('/:id', (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    if (profile.is_default) return res.status(400).json({ success: false, error: 'Cannot delete default profile' });

    const txn = db.transaction(() => {
      db.prepare('UPDATE assets SET profile_id = NULL WHERE profile_id = ?').run(req.params.id);
      db.prepare('UPDATE liabilities SET profile_id = NULL WHERE profile_id = ?').run(req.params.id);
      db.prepare('UPDATE goals SET profile_id = NULL WHERE profile_id = ?').run(req.params.id);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
    });
    txn();

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
