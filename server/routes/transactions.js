const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Get transactions with filtering, search, date range, and pagination
router.get('/', (req, res) => {
  try {
    const { type, month, year, category, subcategory, search, dateFrom, dateTo, bank_account, page, pageSize, limit } = req.query;
    let where = ' WHERE 1=1';
    const params = [];
    if (type) { where += ' AND type = ?'; params.push(type); }
    if (category) { where += ' AND category = ?'; params.push(category); }
    if (subcategory) { where += ' AND subcategory = ?'; params.push(subcategory); }
    if (bank_account) { where += ' AND bank_account = ?'; params.push(bank_account); }
    if (search) {
      where += ' AND (LOWER(description) LIKE ? OR LOWER(category) LIKE ? OR LOWER(subcategory) LIKE ?)';
      const s = `%${search.toLowerCase()}%`;
      params.push(s, s, s);
    }
    if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom); }
    if (dateTo) { where += ' AND date <= ?'; params.push(dateTo); }
    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-31`;
      where += ' AND date BETWEEN ? AND ?';
      params.push(start, end);
    } else if (year) {
      where += ' AND date LIKE ?';
      params.push(`${year}%`);
    }

    // Get total count for pagination
    const total = db.prepare('SELECT COUNT(*) as count FROM transactions' + where).get(...params).count;

    // Build aliased WHERE for the JOIN query
    const aliasedWhere = where
      .replace(/\btype\b/g, 't.type')
      .replace(/\bcategory\b/g, 't.category')
      .replace(/\bsubcategory\b/g, 't.subcategory')
      .replace(/\bdate\b/g, 't.date')
      .replace(/\bdescription\b/g, 't.description')
      .replace(/\bbank_account\b/g, 't.bank_account')
      .replace(/\bamount\b/g, 't.amount');

    let sql = `SELECT t.*, COALESCE(NULLIF(b.bank_name,''), b.name) AS bank_name, b.account_type AS bank_account_type
               FROM transactions t
               LEFT JOIN bank_accounts b ON t.bank_account = b.id` + aliasedWhere + ' ORDER BY t.date DESC, t.created_at DESC';

    // Pagination: page + pageSize take priority over limit
    const pg = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(200, Math.max(1, parseInt(pageSize) || parseInt(limit) || 30));
    const offset = (pg - 1) * ps;
    sql += ' LIMIT ? OFFSET ?';

    const data = db.prepare(sql).all(...params, ps, offset);
    const totalPages = Math.ceil(total / ps);

    res.json({
      success: true,
      data,
      pagination: { page: pg, pageSize: ps, total, totalPages },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Monthly summary
router.get('/summary', (req, res) => {
  try {
    const { months = 12 } = req.query;
    const safeMonths = Math.max(1, Math.min(120, parseInt(months) || 12));
    const data = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        type,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE date >= date('now', '-' || ? || ' months')
      GROUP BY strftime('%Y-%m', date), type
      ORDER BY month DESC
    `).all(String(safeMonths));
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Category breakdown (with optional subcategory drill-down)
router.get('/categories', (req, res) => {
  try {
    const { type, month, year, category, dateFrom, dateTo } = req.query;
    let sql, params = [];

    if (category) {
      // Subcategory drill-down for a specific category
      sql = `SELECT category, subcategory, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE category = ?`;
      params.push(category);
      if (type) { sql += ' AND type = ?'; params.push(type); }
      if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
      if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo); }
      if (!dateFrom && !dateTo && month && year) {
        sql += ' AND date BETWEEN ? AND ?';
        params.push(`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-31`);
      }
      sql += ' GROUP BY category, subcategory ORDER BY total DESC';
    } else {
      sql = 'SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE 1=1';
      if (type) { sql += ' AND type = ?'; params.push(type); }
      if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
      if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo); }
      if (!dateFrom && !dateTo && month && year) {
        sql += ' AND date BETWEEN ? AND ?';
        params.push(`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-31`);
      }
      sql += ' GROUP BY category ORDER BY total DESC';
    }

    const data = db.prepare(sql).all(...params);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Subcategory breakdown (all subcategories grouped by category)
router.get('/subcategories', (req, res) => {
  try {
    const { type, month, year, dateFrom, dateTo } = req.query;
    let sql = `SELECT category, subcategory, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE subcategory != '' AND subcategory IS NOT NULL`;
    const params = [];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo); }
    if (!dateFrom && !dateTo && month && year) {
      sql += ' AND date BETWEEN ? AND ?';
      params.push(`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-31`);
    }
    sql += ' GROUP BY category, subcategory ORDER BY category, total DESC';
    const data = db.prepare(sql).all(...params);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get distinct subcategories for a given category (for dropdown population)
router.get('/subcategory-list', (req, res) => {
  try {
    const { category, type } = req.query;
    let sql = `SELECT DISTINCT subcategory FROM transactions WHERE subcategory != '' AND subcategory IS NOT NULL`;
    const params = [];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY subcategory';
    const data = db.prepare(sql).all(...params).map(r => r.subcategory);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const { type, amount, description, category, subcategory, date, bank_account } = req.body;
    if (!amount || !type) return res.status(400).json({ success: false, error: 'Amount and type required' });
    if (!['income', 'expense'].includes(type)) return res.status(400).json({ success: false, error: 'Type must be income or expense' });
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    // Validate date format (YYYY-MM-DD)
    const txDate = date || new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate)) return res.status(400).json({ success: false, error: 'Invalid date format (use YYYY-MM-DD)' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO transactions (id, type, amount, description, category, subcategory, date, bank_account) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, type, Math.abs(numAmount), (description || '').slice(0, 500), (category || 'Other').slice(0, 100), (subcategory || '').slice(0, 100), txDate, bank_account || '');
    res.json({ success: true, data: db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Edit transaction
router.put('/:id', (req, res) => {
  try {
    const { type, amount, description, category, subcategory, date, bank_account } = req.body;
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Transaction not found' });
    db.prepare('UPDATE transactions SET type=?, amount=?, description=?, category=?, subcategory=?, date=?, bank_account=? WHERE id=?')
      .run(type || existing.type, Math.abs(amount || existing.amount), description ?? existing.description,
        category || existing.category, subcategory ?? existing.subcategory,
        date || existing.date, bank_account ?? existing.bank_account, req.params.id);
    res.json({ success: true, data: db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Bulk import transactions
router.post('/bulk', (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions)) return res.status(400).json({ success: false, error: 'Expected array' });
    const insert = db.prepare('INSERT INTO transactions (id, type, amount, description, category, subcategory, date) VALUES (?,?,?,?,?,?,?)');
    let count = 0;
    const txn = db.transaction(() => {
      for (const t of transactions) {
        if (!t.amount) continue;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + count;
        insert.run(id, t.type || 'expense', Math.abs(t.amount), t.description || '', t.category || 'Other',
          t.subcategory || '',
          t.date || new Date().toISOString().split('T')[0]);
        count++;
      }
    });
    txn();
    res.json({ success: true, imported: count });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
