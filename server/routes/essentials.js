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
    const { term_insurance, health_insurance, emergency_fund, dependents } = req.body;
    // Use INSERT OR REPLACE to handle both create and update
    db.prepare(`INSERT OR REPLACE INTO essentials (id, term_insurance, health_insurance, emergency_fund, dependents, updated_at)
      VALUES (1, ?, ?, ?, ?, date('now'))`)
      .run(
        term_insurance != null ? Number(term_insurance) : 0,
        health_insurance != null ? Number(health_insurance) : 0,
        emergency_fund != null ? Number(emergency_fund) : 0,
        dependents != null ? Number(dependents) : 0
      );
    const data = db.prepare('SELECT * FROM essentials WHERE id = 1').get();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
