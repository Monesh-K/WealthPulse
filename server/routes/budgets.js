const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Get all budgets
router.get('/', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM budgets ORDER BY category ASC').all();
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get budget status for current month — each budget's category, limit, and actual spending
router.get('/status', (req, res) => {
  try {
    const budgets = db.prepare('SELECT * FROM budgets ORDER BY category ASC').all();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

    const status = budgets.map(b => {
      const spent = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND category = ? AND date BETWEEN ? AND ?"
      ).get(b.category, monthStart, monthEnd);

      return {
        id: b.id,
        category: b.category,
        monthly_limit: b.monthly_limit,
        spent: spent.total,
        remaining: b.monthly_limit - spent.total,
        percentage: b.monthly_limit > 0 ? Math.round((spent.total / b.monthly_limit) * 10000) / 100 : 0,
        over_budget: spent.total > b.monthly_limit,
      };
    });

    const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
    const totalSpent = status.reduce((s, b) => s + b.spent, 0);

    res.json({
      success: true,
      data: status,
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overallPercentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Create or update budget (INSERT OR REPLACE by category)
router.post('/', (req, res) => {
  try {
    const { category, monthly_limit } = req.body;
    if (!category || !category.trim()) return res.status(400).json({ success: false, error: 'Category is required' });
    if (monthly_limit === undefined || monthly_limit === null || parseFloat(monthly_limit) < 0) {
      return res.status(400).json({ success: false, error: 'Monthly limit must be a non-negative number' });
    }

    db.prepare('INSERT OR REPLACE INTO budgets (category, monthly_limit) VALUES (?, ?)')
      .run(category.trim(), parseFloat(monthly_limit));

    const budget = db.prepare('SELECT * FROM budgets WHERE category = ?').get(category.trim());
    res.json({ success: true, data: budget });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Delete budget
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Budget not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
