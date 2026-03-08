const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM essentials WHERE id = 1').get();
    res.json({ success: true, data: data || {} });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/', (req, res) => {
  try {
    const fields = [
      'term_insurance', 'health_insurance', 'emergency_fund', 'dependents',
      'term_policy_id', 'term_provider', 'term_premium', 'term_expiry',
      'term_claim_number', 'term_nominee', 'term_notes',
      'health_policy_id', 'health_provider', 'health_premium', 'health_expiry',
      'health_claim_number', 'health_members', 'health_notes',
    ];

    // Build dynamic UPDATE
    const existing = db.prepare('SELECT * FROM essentials WHERE id = 1').get();
    if (!existing) {
      db.prepare('INSERT INTO essentials (id) VALUES (1)').run();
    }

    const setClauses = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        setClauses.push(`${f} = ?`);
        const numericFields = ['term_insurance', 'health_insurance', 'emergency_fund', 'dependents', 'term_premium', 'health_premium'];
        values.push(numericFields.includes(f) ? Number(req.body[f]) : req.body[f]);
      }
    });

    if (setClauses.length > 0) {
      setClauses.push('updated_at = date(\'now\')');
      db.prepare(`UPDATE essentials SET ${setClauses.join(', ')} WHERE id = 1`).run(...values);
    }

    const data = db.prepare('SELECT * FROM essentials WHERE id = 1').get();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
