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
    const { name, type, outstanding, rate, emi, tenure, notes, gold_weight, gold_purity, pledged_value } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO liabilities (id, name, type, outstanding, rate, emi, tenure, notes, gold_weight, gold_purity, pledged_value) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, name, type || 'Other', outstanding || 0, rate || 0, emi || 0, tenure || 0, notes || '',
           gold_weight || 0, gold_purity || '22K', pledged_value || 0);
    res.json({ success: true, data: db.prepare('SELECT * FROM liabilities WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, type, outstanding, rate, emi, tenure, notes, gold_weight, gold_purity, pledged_value } = req.body;
    db.prepare(`UPDATE liabilities SET name=?, type=?, outstanding=?, rate=?, emi=?, tenure=?, notes=?, gold_weight=?, gold_purity=?, pledged_value=?, updated_at=date('now') WHERE id=?`)
      .run(name, type, outstanding || 0, rate || 0, emi || 0, tenure || 0, notes || '',
           gold_weight || 0, gold_purity || '22K', pledged_value || 0, req.params.id);
    res.json({ success: true, data: db.prepare('SELECT * FROM liabilities WHERE id = ?').get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM liabilities WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Loan Amortization Schedule ──────────────────
router.get('/:id/amortization', (req, res) => {
  try {
    const liability = db.prepare('SELECT * FROM liabilities WHERE id = ?').get(req.params.id);
    if (!liability) return res.status(404).json({ success: false, error: 'Liability not found' });

    const outstanding = liability.outstanding || 0;
    const annualRate = liability.rate || 0;
    const emi = liability.emi || 0;
    const tenure = liability.tenure || 0;

    if (outstanding <= 0 || emi <= 0) {
      return res.status(400).json({ success: false, error: 'Outstanding amount and EMI must be greater than 0' });
    }

    const monthlyRate = annualRate / 12 / 100;
    const schedule = [];
    let balance = outstanding;

    // Use tenure if available, otherwise calculate from outstanding/emi
    const months = tenure > 0 ? tenure : Math.ceil(outstanding / emi) + 12; // safety margin
    const maxMonths = Math.min(months, 600); // cap at 50 years

    for (let month = 1; month <= maxMonths && balance > 0.01; month++) {
      const interest = balance * monthlyRate;
      const principal = Math.min(emi - interest, balance);
      balance = Math.max(0, balance - principal);

      schedule.push({
        month,
        emi: Math.round((principal + interest) * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      });

      if (balance <= 0.01) break;
    }

    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const totalPaid = schedule.reduce((s, r) => s + r.emi, 0);

    res.json({
      success: true,
      data: {
        schedule,
        summary: {
          loanAmount: outstanding,
          interestRate: annualRate,
          emi,
          totalMonths: schedule.length,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
        }
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
