/**
 * WealthPulse — Snapshots Page (Net Worth History)
 */
const SnapshotsPage = {
  items: [],

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Net Worth Snapshots</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Monthly records of your financial position</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="SnapshotsPage.takeSnapshot()">📸 Take Snapshot Now</button>
      </div>
      <div id="snapshotContent">
        <div class="loading"><div class="spinner"></div> Loading...</div>
      </div>
    `;
  },

  async init() {
    await this.load();
  },

  async load() {
    try {
      const res = await API.getSnapshots();
      this.items = res.data || [];
      this.renderContent();
    } catch (e) {
      document.getElementById('snapshotContent').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  renderContent() {
    if (!this.items.length) {
      document.getElementById('snapshotContent').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">📸</div>
            <h3>No snapshots yet</h3>
            <p>Snapshots are taken automatically on the 10th of each month, or take one now</p>
            <button class="btn btn-primary btn-sm" onclick="SnapshotsPage.takeSnapshot()">Take First Snapshot</button>
          </div>
        </div>
      `;
      return;
    }

    const latest = this.items[this.items.length - 1];
    const prev = this.items.length > 1 ? this.items[this.items.length - 2] : null;
    const growth = prev ? ((latest.net_worth - prev.net_worth) / Math.abs(prev.net_worth || 1)) * 100 : 0;

    document.getElementById('snapshotContent').innerHTML = `
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Latest Net Worth</div>
          <div class="stat-value">${Utils.currency(latest.net_worth)}</div>
          <div class="stat-sub">${Utils.formatDate(latest.date)}</div>
        </div>
        <div class="stat-card ${growth >= 0 ? 'green' : 'red'}">
          <div class="stat-label">Month-over-Month</div>
          <div class="stat-value ${Utils.gainColor(growth)}">${growth >= 0 ? '↑' : '↓'} ${Utils.percent(Math.abs(growth))}</div>
          <div class="stat-sub">${prev ? Utils.currency(latest.net_worth - prev.net_worth) + ' change' : 'First snapshot'}</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">Snapshots</div>
          <div class="stat-value">${this.items.length}</div>
          <div class="stat-sub">Since ${Utils.formatDate(this.items[0].date)}</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="card mb-24">
        <div class="card-header"><div class="card-title">Net Worth Trend</div></div>
        <div class="chart-container" style="height:300px">
          <canvas id="snapshotChart"></canvas>
        </div>
      </div>

      <!-- Stacked Allocation History -->
      <div class="card mb-24">
        <div class="card-header"><div class="card-title">Stacked Allocation History</div></div>
        <div id="allocationHistoryContent">
          <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px">
            <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Loading allocation history...
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="card-header"><div class="card-title">Snapshot History</div></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th class="text-right">Assets</th><th class="text-right">Liabilities</th><th class="text-right">Net Worth</th><th class="text-right">Change</th><th class="text-center">Actions</th></tr></thead>
            <tbody>
              ${[...this.items].reverse().map((s, i, arr) => {
                const prevS = arr[i + 1];
                const change = prevS ? s.net_worth - prevS.net_worth : 0;
                return `
                  <tr>
                    <td class="font-mono">${Utils.formatDate(s.date)}</td>
                    <td class="text-right font-mono">${Utils.currencyFull(s.assets)}</td>
                    <td class="text-right font-mono text-red">${Utils.currencyFull(s.liabilities)}</td>
                    <td class="text-right font-mono" style="font-weight:600">${Utils.currencyFull(s.net_worth)}</td>
                    <td class="text-right font-mono ${Utils.gainColor(change)}">${prevS ? Utils.currencyFull(change) : '-'}</td>
                    <td class="text-center">
                      <button class="btn-icon" onclick="SnapshotsPage.editDate(${s.id}, '${s.date}')" title="Edit Date">✏️</button>
                      <button class="btn-icon danger" onclick="SnapshotsPage.deleteItem(${s.id})" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Chart
    requestAnimationFrame(async () => {
      await Charts.line('snapshotChart',
        this.items.map(s => Utils.formatDate(s.date)),
        [
          { label: 'Net Worth', data: this.items.map(s => s.net_worth), color: '#6366f1' },
          { label: 'Assets', data: this.items.map(s => s.assets), color: '#10b981', fill: false },
          { label: 'Liabilities', data: this.items.map(s => s.liabilities), color: '#ef4444', fill: false },
        ]
      );

      // Load allocation history
      this.loadAllocationHistory();
    });
  },

  async takeSnapshot() {
    try {
      await API.takeSnapshot();
      Toast.success('Snapshot captured!');
      await this.load();
    } catch (e) { Toast.error(e.message); }
  },

  async deleteItem(id) {
    const ok = await Modal.confirm('Delete Snapshot', 'Delete this snapshot?');
    if (!ok) return;
    try { await API.deleteSnapshot(id); Toast.success('Deleted'); await this.load(); }
    catch (e) { Toast.error(e.message); }
  },

  editDate(id, currentDate) {
    Modal.open('Edit Snapshot Date', `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label class="form-label">Snapshot Date</label>
          <input type="date" id="editSnapshotDate" class="form-input" value="${currentDate}"
            max="${new Date().toISOString().split('T')[0]}" style="width:100%">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="SnapshotsPage.saveDate(${id})">Save</button>
        </div>
      </div>
    `);
  },

  async saveDate(id) {
    const dateInput = document.getElementById('editSnapshotDate');
    const date = dateInput?.value;
    if (!date) { Toast.error('Please select a date'); return; }
    try {
      await API.updateSnapshot(id, { date });
      Modal.close();
      Toast.success('Snapshot date updated');
      await this.load();
    } catch (e) { Toast.error(e.message); }
  },

  async loadAllocationHistory() {
    const container = document.getElementById('allocationHistoryContent');
    if (!container) return;

    try {
      const res = await API.getAllocationHistory();
      const data = res.data || {};
      const dates = data.dates || [];
      const categories = data.categories || {};

      if (!dates.length || !Object.keys(categories).length) {
        container.innerHTML = '<div class="empty-state" style="padding:24px"><p>Not enough snapshot data for allocation history. Take more snapshots over time.</p></div>';
        return;
      }

      const colors = {
        'Equity': '#3b82f6', 'Debt': '#10b981', 'Gold': '#f59e0b', 'Cash': '#6b7280',
        'Real Estate': '#b45309', 'International': '#7c3aed', 'Crypto': '#db2777', 'Retirement': '#7c3aed'
      };
      const defaultColors = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#8b5cf6', '#ef4444', '#3b82f6'];
      let colorIdx = 0;

      const datasets = Object.keys(categories).map(cat => {
        const color = colors[cat] || defaultColors[colorIdx++ % defaultColors.length];
        return {
          label: cat,
          data: categories[cat],
          color: color,
          fill: true,
        };
      });

      container.innerHTML = `
        <div class="chart-container" style="height:300px">
          <canvas id="allocationHistoryChart"></canvas>
        </div>
      `;

      requestAnimationFrame(async () => {
        await Charts.line('allocationHistoryChart',
          dates.map(d => Utils.formatDate(d)),
          datasets
        );
      });
    } catch (err) {
      container.innerHTML = '<div class="empty-state" style="padding:24px"><p>Could not load allocation history.</p></div>';
    }
  },
};
