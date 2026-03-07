const express = require('express');
const router = express.Router();
const db = require('../models/database');

// All tables to export/import
const TABLES = [
  'assets', 'liabilities', 'goals', 'transactions',
  'snapshots', 'essentials', 'settings', 'target_allocation',
  'bank_accounts', 'users'
];

// ─── GET /api/backup/export — Download all data as JSON ───
router.get('/export', (req, res) => {
  try {
    const backup = { version: 2, exportedAt: new Date().toISOString(), tables: {} };
    for (const table of TABLES) {
      try {
        backup.tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
      } catch {
        backup.tables[table] = []; // table might not exist yet
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename=wealthpulse-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, data: backup });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /api/backup/import — Restore all data from JSON ───
router.post('/import', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.tables) {
      return res.status(400).json({ success: false, error: 'Invalid backup format' });
    }

    const results = {};
    const txn = db.transaction(() => {
      for (const table of TABLES) {
        const rows = data.tables[table];
        if (!rows || !rows.length) { results[table] = 0; continue; }

        // Get column names from existing table
        let columns;
        try {
          const info = db.prepare(`PRAGMA table_info(${table})`).all();
          columns = info.map(c => c.name);
        } catch {
          results[table] = 0;
          continue;
        }

        // Clear existing data
        db.prepare(`DELETE FROM ${table}`).run();

        // Filter row keys to only include existing columns
        let imported = 0;
        for (const row of rows) {
          const validCols = columns.filter(c => row[c] !== undefined);
          if (!validCols.length) continue;
          const placeholders = validCols.map(() => '?').join(', ');
          const values = validCols.map(c => row[c]);
          try {
            db.prepare(`INSERT OR REPLACE INTO ${table} (${validCols.join(', ')}) VALUES (${placeholders})`).run(...values);
            imported++;
          } catch (e) {
            console.warn(`[Backup] Skip row in ${table}:`, e.message);
          }
        }
        results[table] = imported;
      }
    });
    txn();

    res.json({
      success: true,
      message: 'Backup restored successfully',
      results
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
