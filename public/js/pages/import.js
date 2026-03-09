/**
 * WealthPulse — Import Center Page
 * Unified bulk import for all 4 statement types with progress tracking
 */
const ImportPage = {
  files: [],
  results: [],
  marketStatus: null,

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">📥 Import Center</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">
            Import your monthly statements — all 4 files at once
          </p>
        </div>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="ImportPage.refreshMarketData()" id="importRefreshBtn">
            🔄 Refresh Market Data
          </button>
        </div>
      </div>

      <!-- Market Status Banner -->
      <div id="marketStatusBanner" class="card" style="margin-bottom:20px; padding:16px">
        <div class="loading" style="padding:8px 0"><div class="spinner"></div> Loading market status...</div>
      </div>

      <!-- Supported Formats Guide -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📋 Supported Statements</div>
        </div>
        <div class="import-formats-grid">
          <div class="import-format-card">
            <div class="import-format-icon">💸</div>
            <div class="import-format-info">
              <strong>Money Manager</strong>
              <span class="text-muted">Expense_Manager.csv</span>
              <span class="badge badge-other" style="font-size:0.7rem">→ Transactions</span>
            </div>
          </div>
          <div class="import-format-card">
            <div class="import-format-icon">📊</div>
            <div class="import-format-info">
              <strong>Groww Mutual Funds</strong>
              <span class="text-muted">Mutual_Funds_*.xlsx</span>
              <span class="badge badge-equity" style="font-size:0.7rem">→ MF Assets (Daily NAV)</span>
            </div>
          </div>
          <div class="import-format-card">
            <div class="import-format-icon">🇮🇳</div>
            <div class="import-format-info">
              <strong>Groww Indian Stocks</strong>
              <span class="text-muted">Stocks_Holdings_*.xlsx</span>
              <span class="badge badge-equity" style="font-size:0.7rem">→ Stock Assets (Live)</span>
            </div>
          </div>
          <div class="import-format-card">
            <div class="import-format-icon">🇺🇸</div>
            <div class="import-format-info">
              <strong>INDMoney US Stocks</strong>
              <span class="text-muted">IND-HOLDINGS_*.xls</span>
              <span class="badge badge-international" style="font-size:0.7rem">→ US Assets (Live)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Zone -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📁 Upload Files</div>
          <span class="text-muted" style="font-size:0.8rem">Select up to 4 files (or drag & drop)</span>
        </div>
        <div class="import-dropzone" id="importDropzone"
          ondragover="ImportPage.handleDragOver(event)"
          ondragleave="ImportPage.handleDragLeave(event)"
          ondrop="ImportPage.handleDrop(event)"
          onclick="document.getElementById('importFileInput').click()">
          <div style="font-size:48px; margin-bottom:12px; opacity:0.6">📂</div>
          <p style="font-size:1rem; font-weight:500; margin-bottom:4px">
            Drop your files here or click to browse
          </p>
          <p class="text-muted" style="font-size:0.82rem">
            CSV, XLS, XLSX — Auto-detects file format
          </p>
        </div>
        <input type="file" id="importFileInput" multiple accept=".csv,.xls,.xlsx"
          style="display:none" onchange="ImportPage.handleFileSelect(this.files)">

        <!-- Selected Files List -->
        <div id="selectedFilesList" style="margin-top:16px; display:none"></div>

        <!-- Import Button -->
        <div id="importActions" style="margin-top:16px; display:none; text-align:right">
          <button class="btn btn-outline btn-sm" onclick="ImportPage.clearFiles()" style="margin-right:8px">
            Clear All
          </button>
          <button class="btn btn-primary" onclick="ImportPage.importAll()" id="importAllBtn">
            🚀 Import All Files
          </button>
        </div>
      </div>

      <!-- Import Results -->
      <div id="importResults" style="display:none">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📊 Import Results</div>
          </div>
          <div id="importResultsList"></div>
        </div>
      </div>

      <!-- Import History / Tips -->
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <div class="card-title">💡 Tips for Monthly Import</div>
        </div>
        <div style="padding:4px 0; font-size:0.88rem; line-height:1.7; color:var(--text-secondary)">
          <ul style="padding-left:20px; margin:0">
            <li><strong>Repeat imports are safe</strong> — existing assets are updated, not duplicated. Transactions are de-duplicated by date + amount + category.</li>
            <li><strong>Mutual Fund NAVs</strong> refresh automatically every day at 9:30 PM IST.</li>
            <li><strong>Indian stock prices</strong> update live every 5 minutes during market hours (9:15 AM – 3:30 PM IST, Mon–Fri).</li>
            <li><strong>US stock prices</strong> update every 10 minutes during US market hours (7 PM – 1:30 AM IST, Mon–Fri).</li>
            <li><strong>Gold, Forex, FD/RD</strong> values refresh daily at 6 PM IST.</li>
            <li>Use the <strong>"Refresh Market Data"</strong> button above to manually update all prices anytime.</li>
            <li>A <strong>monthly snapshot</strong> is automatically taken on the 10th of each month.</li>
          </ul>
        </div>
      </div>

    `;
  },

  async init() {
    this.files = [];
    this.results = [];
    await this.loadMarketStatus();
  },

  async loadMarketStatus() {
    try {
      const res = await API.getMarketStatus();
      this.marketStatus = res.data;
      this.renderMarketStatus();
    } catch (e) {
      document.getElementById('marketStatusBanner').innerHTML = `
        <span class="text-muted">Could not load market status</span>
      `;
    }
  },

  renderMarketStatus() {
    const s = this.marketStatus;
    if (!s) return;

    const lastRefresh = s.lastRefresh ? new Date(s.lastRefresh) : null;
    const timeAgo = lastRefresh ? this.timeAgo(lastRefresh) : 'Never';

    document.getElementById('marketStatusBanner').innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:20px; align-items:center">
        <div style="flex:1; min-width:200px">
          <div style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px">Last Market Refresh</div>
          <div style="font-size:1rem; font-weight:600">${lastRefresh ? Utils.formatDate(s.lastRefresh.split('T')[0]) : 'Never'}</div>
          <div class="text-muted" style="font-size:0.8rem">${timeAgo}</div>
        </div>
        <div class="import-status-pills">
          <span class="import-pill">📊 ${s.mutualFunds || 0} MFs</span>
          <span class="import-pill">🇮🇳 ${s.indianStocks || 0} Indian Stocks</span>
          <span class="import-pill">🇺🇸 ${s.usStocks || 0} US Stocks</span>
          <span class="import-pill">💼 ${s.totalAssets || 0} Total Assets</span>
          ${s.fxRate ? `<span class="import-pill">💱 USD/INR: ${Number(s.fxRate).toFixed(2)}</span>` : ''}
        </div>
      </div>
    `;
  },

  timeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  },

  // ─── File Handling ──────────────────────────────
  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  },

  handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  },

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    this.addFiles(files);
  },

  handleFileSelect(fileList) {
    this.addFiles(fileList);
  },

  addFiles(fileList) {
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xls', 'xlsx'].includes(ext)) {
        Toast.error(`Unsupported file: ${file.name}. Only CSV, XLS, XLSX are supported.`);
        continue;
      }
      // Avoid adding same file twice
      if (this.files.some(f => f.name === file.name && f.size === file.size)) {
        Toast.info(`${file.name} already added`);
        continue;
      }
      this.files.push(file);
    }
    this.renderFileList();
  },

  removeFile(idx) {
    this.files.splice(idx, 1);
    this.renderFileList();
  },

  clearFiles() {
    this.files = [];
    this.results = [];
    this.renderFileList();
    document.getElementById('importResults').style.display = 'none';
  },

  renderFileList() {
    const listEl = document.getElementById('selectedFilesList');
    const actionsEl = document.getElementById('importActions');

    if (!this.files.length) {
      listEl.style.display = 'none';
      actionsEl.style.display = 'none';
      return;
    }

    listEl.style.display = 'block';
    actionsEl.style.display = 'block';

    listEl.innerHTML = this.files.map((file, idx) => {
      const icon = this.guessFileIcon(file.name);
      const size = (file.size / 1024).toFixed(1);
      return `
        <div class="import-file-item" id="fileItem_${idx}">
          <div style="display:flex; align-items:center; gap:10px; flex:1">
            <span style="font-size:1.3rem">${icon}</span>
            <div>
              <div style="font-weight:500; font-size:0.9rem">${Utils.esc(file.name)}</div>
              <div class="text-muted" style="font-size:0.78rem">${size} KB</div>
            </div>
          </div>
          <div class="import-file-status" id="fileStatus_${idx}">
            <span class="text-muted" style="font-size:0.82rem">Ready</span>
          </div>
          <button class="btn-icon danger" onclick="ImportPage.removeFile(${idx})" title="Remove">✕</button>
        </div>
      `;
    }).join('');
  },

  guessFileIcon(name) {
    const lower = name.toLowerCase();
    if (lower.includes('expense') || lower.includes('money')) return '💸';
    if (lower.includes('mutual') || lower.includes('mf')) return '📊';
    if (lower.includes('stock') && lower.includes('holding')) return '🇮🇳';
    if (lower.includes('ind-') || lower.includes('indmoney')) return '🇺🇸';
    return '📄';
  },

  // ─── Import All Files ──────────────────────────
  async importAll() {
    if (!this.files.length) {
      Toast.error('No files selected');
      return;
    }

    const btn = document.getElementById('importAllBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Importing...';

    this.results = [];
    let totalImported = 0;
    let totalUpdated = 0;
    let errors = 0;

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const statusEl = document.getElementById(`fileStatus_${i}`);
      const itemEl = document.getElementById(`fileItem_${i}`);

      // Show processing state
      statusEl.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> <span style="font-size:0.82rem">Importing...</span>';
      itemEl.style.opacity = '0.7';

      try {
        const res = await API.importAutoDetect(file);

        const imported = res.imported || 0;
        const updated = res.updated || res.consolidated || 0;
        totalImported += imported;
        totalUpdated += updated;

        let statusText = '';
        const parts = [];
        if (imported > 0) parts.push(`${imported} new`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (res.skipped > 0) parts.push(`${res.skipped} skipped`);
        if (res.transferSkipped > 0) parts.push(`${res.transferSkipped} transfers skipped`);
        statusText = parts.join(', ');

        statusEl.innerHTML = `
          <span style="color:var(--green); font-size:0.82rem">
            ✅ ${Utils.esc(res.format)} — ${statusText}
          </span>
        `;
        itemEl.style.opacity = '1';
        itemEl.style.borderLeft = '3px solid var(--green)';

        this.results.push({ file: file.name, success: true, ...res });
      } catch (e) {
        errors++;
        statusEl.innerHTML = `
          <span style="color:var(--red); font-size:0.82rem">
            ❌ ${Utils.esc(e.message)}
          </span>
        `;
        itemEl.style.opacity = '1';
        itemEl.style.borderLeft = '3px solid var(--red)';

        this.results.push({ file: file.name, success: false, error: e.message });
      }
    }

    btn.disabled = false;
    btn.innerHTML = '🚀 Import All Files';

    // Show summary
    this.renderResults(totalImported, totalUpdated, errors);

    // Show toast
    if (errors === 0) {
      Toast.success(`All ${this.files.length} files imported successfully! ${totalImported} new + ${totalUpdated} updated`);
    } else {
      Toast.error(`${errors} file(s) failed. ${this.files.length - errors} succeeded.`);
    }

    // Refresh market status
    await this.loadMarketStatus();
  },

  renderResults(totalImported, totalUpdated, errors) {
    const resultsEl = document.getElementById('importResults');
    const listEl = document.getElementById('importResultsList');
    resultsEl.style.display = 'block';

    const successCount = this.results.filter(r => r.success).length;

    listEl.innerHTML = `
      <div style="padding:16px; background:${errors === 0 ? 'var(--green-bg)' : 'var(--yellow-bg)'}; border-radius:8px; margin-bottom:16px">
        <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:center">
          <div>
            <div style="font-size:1.5rem; font-weight:700; color:${errors === 0 ? 'var(--green)' : 'var(--yellow)'}">${successCount}/${this.results.length}</div>
            <div class="text-muted" style="font-size:0.8rem">Files processed</div>
          </div>
          <div>
            <div style="font-size:1.2rem; font-weight:600">${totalImported}</div>
            <div class="text-muted" style="font-size:0.8rem">New records</div>
          </div>
          <div>
            <div style="font-size:1.2rem; font-weight:600">${totalUpdated}</div>
            <div class="text-muted" style="font-size:0.8rem">Updated records</div>
          </div>
          ${errors > 0 ? `
            <div>
              <div style="font-size:1.2rem; font-weight:600; color:var(--red)">${errors}</div>
              <div class="text-muted" style="font-size:0.8rem">Errors</div>
            </div>
          ` : ''}
        </div>
      </div>

      ${this.results.map(r => `
        <div class="import-result-row ${r.success ? 'success' : 'error'}">
          <div style="display:flex; align-items:center; gap:10px; flex:1">
            <span style="font-size:1.1rem">${r.success ? '✅' : '❌'}</span>
            <div>
              <strong style="font-size:0.88rem">${Utils.esc(r.file)}</strong>
              ${r.success ? `
                <div class="text-muted" style="font-size:0.78rem">
                  ${Utils.esc(r.format || 'Unknown')} · ${r.importType || 'assets'}
                  ${r.portfolioSummary ? ` · P&L: ₹${Number(r.portfolioSummary.pnl || 0).toLocaleString('en-IN')}` : ''}
                </div>
              ` : `
                <div style="color:var(--red); font-size:0.78rem">${Utils.esc(r.error)}</div>
              `}
            </div>
          </div>
          ${r.success ? `
            <div style="text-align:right; font-size:0.82rem">
              ${r.imported ? `<span style="color:var(--green)">+${r.imported} new</span>` : ''}
              ${r.updated || r.consolidated ? `<span style="color:var(--blue)"> 🔄${r.updated || r.consolidated} updated</span>` : ''}
            </div>
          ` : ''}
        </div>
      `).join('')}

      <div style="margin-top:16px; padding:12px; background:var(--bg-tertiary); border-radius:8px; font-size:0.82rem; color:var(--text-secondary)">
        💡 <strong>Next step:</strong> Check the
        <a href="#assets" style="color:var(--accent)">Assets</a> and
        <a href="#transactions" style="color:var(--accent)">Transactions</a> pages to verify your data.
        Market prices will auto-update based on schedule.
      </div>
    `;
  },

  async refreshMarketData() {
    const btn = document.getElementById('importRefreshBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Refreshing...';
    try {
      const res = await API.refreshPrices();
      Toast.success(`Market prices refreshed! ${res.updated || 0} assets updated.`);
      await this.loadMarketStatus();
    } catch (e) {
      Toast.error('Refresh failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔄 Refresh Market Data';
    }
  },
};
