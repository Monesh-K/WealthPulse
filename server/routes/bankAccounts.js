const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Get all bank accounts
router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM bank_accounts ORDER BY name ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Create bank account
router.post('/', (req, res) => {
  try {
    const { bank_name, account_type, account_number, balance, notes } = req.body;
    const name = bank_name || req.body.name;
    if (!name) return res.status(400).json({ success: false, error: 'Bank name required' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO bank_accounts (id, name, bank_name, account_type, account_number, balance, notes) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, name, account_type || 'Savings', account_number || '', balance || 0, notes || '');
    res.json({ success: true, data: db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Update bank account
router.put('/:id', (req, res) => {
  try {
    const { bank_name, account_type, account_number, balance, notes } = req.body;
    const name = bank_name || req.body.name;
    db.prepare('UPDATE bank_accounts SET name=?, bank_name=?, account_type=?, account_number=?, balance=?, notes=?, updated_at=date(\'now\') WHERE id=?')
      .run(name, name, account_type || 'Savings', account_number || '', balance || 0, notes || '', req.params.id);
    res.json({ success: true, data: db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Delete bank account
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get bank-wise income/expense summary
router.get('/summary', (req, res) => {
  try {
    const data = db.prepare(`
      SELECT bank_account, type, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE bank_account != '' AND bank_account IS NOT NULL
      GROUP BY bank_account, type
      ORDER BY bank_account
    `).all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
