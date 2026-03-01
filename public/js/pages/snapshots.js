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
            <p>Snapshots are taken automatically on the 1st of each month, or take one now</p>
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
};
