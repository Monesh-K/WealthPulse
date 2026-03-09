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

// Monthly summary (supports filters)
router.get('/summary', (req, res) => {
  try {
    const { months = 12, type, category, subcategory, search, dateFrom, dateTo, bank_account } = req.query;
    const safeMonths = Math.max(1, Math.min(120, parseInt(months) || 12));
    let where = "date >= date('now', '-' || ? || ' months')";
    const params = [String(safeMonths)];
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

    const data = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        type,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE ${where}
      GROUP BY strftime('%Y-%m', date), type
      ORDER BY month DESC
    `).all(...params);

    // Investment expenses per month (treated as savings, not true expenses)
    const invParams = [String(safeMonths)];
    let invWhere = "date >= date('now', '-' || ? || ' months') AND type = 'expense' AND category = 'Investment'";
    if (bank_account) { invWhere += ' AND bank_account = ?'; invParams.push(bank_account); }
    if (search) {
      invWhere += ' AND (LOWER(description) LIKE ? OR LOWER(category) LIKE ? OR LOWER(subcategory) LIKE ?)';
      const s = `%${search.toLowerCase()}%`;
      invParams.push(s, s, s);
    }
    if (dateFrom) { invWhere += ' AND date >= ?'; invParams.push(dateFrom); }
    if (dateTo) { invWhere += ' AND date <= ?'; invParams.push(dateTo); }

    const investmentExpenses = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(amount) as total
      FROM transactions
      WHERE ${invWhere}
      GROUP BY strftime('%Y-%m', date)
    `).all(...invParams);
    const investmentByMonth = {};
    investmentExpenses.forEach(r => { investmentByMonth[r.month] = r.total; });

    res.json({ success: true, data, investmentByMonth });
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

// ─── Recurring Transactions ──────────────────────
// List all recurring transactions
router.get('/recurring', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM transactions WHERE is_recurring = 1 ORDER BY next_due_date ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Generate due recurring transactions
router.post('/generate-recurring', (req, res) => {
  try {
    const result = generateRecurringTransactions();
    res.json({ success: true, ...result });
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

// Set a transaction as recurring
router.put('/:id/recurring', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Transaction not found' });

    const { is_recurring, frequency, next_due_date } = req.body;
    const validFrequencies = ['monthly', 'quarterly', 'yearly'];

    if (is_recurring && !validFrequencies.includes(frequency)) {
      return res.status(400).json({ success: false, error: 'Frequency must be monthly, quarterly, or yearly' });
    }

    db.prepare('UPDATE transactions SET is_recurring = ?, frequency = ?, next_due_date = ? WHERE id = ?')
      .run(is_recurring ? 1 : 0, is_recurring ? frequency : null, is_recurring ? (next_due_date || null) : null, req.params.id);

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

// ─── Helper: Generate due recurring transactions ───
function generateRecurringTransactions() {
  const today = new Date().toISOString().split('T')[0];
  const recurring = db.prepare("SELECT * FROM transactions WHERE is_recurring = 1 AND next_due_date IS NOT NULL AND next_due_date <= ?").all(today);

  let generated = 0;
  const txn = db.transaction(() => {
    for (const r of recurring) {
      // Create new transaction with the due date
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + generated;
      db.prepare('INSERT INTO transactions (id, type, amount, description, category, subcategory, date, bank_account) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, r.type, r.amount, r.description || '', r.category || 'Other', r.subcategory || '', r.next_due_date, r.bank_account || '');

      // Advance next_due_date based on frequency
      const dueDate = new Date(r.next_due_date);
      let nextDate;
      switch (r.frequency) {
        case 'monthly':
          nextDate = new Date(dueDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate = new Date(dueDate);
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate = new Date(dueDate);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          nextDate = new Date(dueDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
      }

      db.prepare('UPDATE transactions SET next_due_date = ? WHERE id = ?')
        .run(nextDate.toISOString().split('T')[0], r.id);

      generated++;
    }
  });
  txn();

  return { generated, message: `Generated ${generated} recurring transactions` };
}

module.exports = router;
module.exports.generateRecurringTransactions = generateRecurringTransactions;
