/**
 * WealthPulse — Assets Page
 * Full-featured asset management with filters, charts, and responsive design
 */
const AssetsPage = {
  items: [],
  allocation: null,
  filters: { categories: [], assetClasses: [], fundTypes: [] },
  activeFilter: { category: '', asset_class: '', fund_type: '', search: '' },
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
  activeTab: 'list',
  selectMode: false,
  selectedIds: new Set(),
  statFilter: '', // 'growth', 'retirement', 'emergency' or ''

  allItems: [], // all assets without pagination for SIP/FD tabs

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Assets</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Track investments, monitor performance & allocation</p>
        </div>
        <div class="btn-group responsive-btn-group">
          <button class="btn btn-outline btn-sm" onclick="AssetsPage.toggleSelectMode()" id="selectModeBtn">☑ Select</button>
          <button class="btn btn-outline btn-sm" onclick="AssetsPage.mergeduplicates()">🔀 Merge Duplicates</button>
          <button class="btn btn-primary btn-sm" onclick="AssetsPage.openForm()">+ Add Asset</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" id="assetStats"></div>

      <!-- Filters -->
      <div class="card" style="padding:12px 16px; margin-bottom:16px">
        <div class="asset-filter-row" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
          <span style="font-weight:600; font-size:0.85rem; color:var(--text-secondary)">Filter:</span>
          <input type="text" class="form-control" id="assetSearchInput" placeholder="Search assets..."
            style="width:auto; flex:1; min-width:100px; padding:6px 10px; font-size:0.85rem"
            oninput="AssetsPage.onSearchInput(this.value)">
          <select class="form-control" id="assetFilterCategory"
            style="width:auto; flex:1; min-width:100px; padding:6px 10px; font-size:0.85rem"
            onchange="AssetsPage.onFilterChange()">
            <option value="">All Categories</option>
          </select>
          <select class="form-control" id="assetFilterClass"
            style="width:auto; flex:1; min-width:100px; padding:6px 10px; font-size:0.85rem"
            onchange="AssetsPage.onFilterChange()">
            <option value="">All Asset Classes</option>
          </select>
          <select class="form-control" id="assetFilterFundType"
            style="width:auto; flex:1; min-width:100px; padding:6px 10px; font-size:0.85rem"
            onchange="AssetsPage.onFilterChange()">
            <option value="">All Fund Types</option>
          </select>
          <button class="btn btn-outline btn-sm" id="assetClearFilterBtn" style="display:none; padding:6px 12px; font-size:0.8rem"
            onclick="AssetsPage.clearFilters()">✕ Clear</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab active" data-tab="list" onclick="AssetsPage.switchTab('list')">Holdings</button>
        <button class="tab" data-tab="allocation" onclick="AssetsPage.switchTab('allocation')">Allocation</button>
        <button class="tab" data-tab="target" onclick="AssetsPage.switchTab('target')">Current vs Target</button>
        <button class="tab" data-tab="sips" onclick="AssetsPage.switchTab('sips')">SIPs</button>
        <button class="tab" data-tab="fds" onclick="AssetsPage.switchTab('fds')">Fixed Deposits</button>
      </div>

      <div id="assetTabContent">
        <div class="loading"><div class="spinner"></div> Loading assets...</div>
      </div>
    `;
  },

  async init() {
    await this.loadAll();
  },

  async loadAll() {
    try {
      const params = { page: this.pagination.page, pageSize: this.pagination.pageSize };
      if (this.activeFilter.category) params.category = this.activeFilter.category;
      if (this.activeFilter.asset_class) params.asset_class = this.activeFilter.asset_class;
      if (this.activeFilter.fund_type) params.fund_type = this.activeFilter.fund_type;
      if (this.activeFilter.search) params.search = this.activeFilter.search;

      const [assetsRes, allocRes, filtersRes, allAssetsRes] = await Promise.all([
        API.getAssets(params),
        API.getAssetAllocation(this.activeFilter).catch(() => ({ data: null })),
        API.getAssetFilters().catch(() => ({ data: { categories: [], assetClasses: [], fundTypes: [] } })),
        API.getAssets({ pageSize: 999 }).catch(() => ({ data: [] })),
      ]);

      this.items = assetsRes.data || [];
      this.allItems = allAssetsRes.data || [];
      this.pagination = {
        page: assetsRes.page || 1,
        pageSize: assetsRes.pageSize || 50,
        total: assetsRes.total || 0,
        totalPages: assetsRes.totalPages || 1,
      };
      this.allocation = allocRes.data || null;
      this.filters = filtersRes.data || { categories: [], assetClasses: [], fundTypes: [] };

      this.renderStats();
      this.populateFilters();
      this.updateClearButtonVisibility();
      this.switchTab(this.activeTab);
    } catch (e) {
      document.getElementById('assetTabContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Could not load assets</h3>
          <p>${Utils.esc(e.message)}</p>
        </div>`;
    }
  },

  renderStats() {
    const alloc = this.allocation;
    if (!alloc) {
      document.getElementById('assetStats').innerHTML = '';
      return;
    }
    const gain = alloc.totalValue - alloc.totalInvested;
    const gainPct = alloc.totalInvested > 0 ? (gain / alloc.totalInvested * 100) : 0;

    const emergency = alloc.emergencyFundValue || 0;
    const emergencyInv = alloc.emergencyFundInvested || 0;
    const retirement = alloc.retirementCorpus || 0;
    const retirementInv = alloc.retirementCorpusInvested || 0;
    const growth = alloc.totalValue - emergency - retirement;
    const growthInv = alloc.totalInvested - emergencyInv - retirementInv;

    let statsHTML = `
      <div class="stat-card blue">
        <div class="stat-label">Total Invested</div>
        <div class="stat-value">${Utils.currency(alloc.totalInvested)}</div>
        <div class="stat-sub">Current: ${Utils.currency(alloc.totalValue)} · ${this.pagination.total} assets</div>
      </div>
      <div class="stat-card ${gain >= 0 ? 'green' : 'red'}">
        <div class="stat-label">Total Gain / Loss</div>
        <div class="stat-value ${Utils.gainColor(gain)}">${Utils.currency(gain)}</div>
        <div class="stat-sub ${Utils.gainClass(gain)}">${gain >= 0 ? '↑' : '↓'} ${Utils.percent(Math.abs(gainPct))}</div>
      </div>
      ${growth > 0 ? `
      <div class="stat-card${this.statFilter === 'growth' ? ' active-stat' : ''}" style="border-left:3px solid #3b82f6;cursor:pointer" onclick="AssetsPage.filterByStat('growth')">
        <div class="stat-label">Growth Assets</div>
        <div class="stat-value">${Utils.currency(growth)}</div>
        <div class="stat-sub">Invested: ${Utils.currency(growthInv)} · ${alloc.totalValue > 0 ? Utils.percent(growth / alloc.totalValue * 100) : '0%'} of portfolio</div>
      </div>` : ''}
      ${retirement > 0 ? `
      <div class="stat-card${this.statFilter === 'retirement' ? ' active-stat' : ''}" style="border-left:3px solid #7c3aed;cursor:pointer" onclick="AssetsPage.filterByStat('retirement')">
        <div class="stat-label">Retirement Corpus</div>
        <div class="stat-value">${Utils.currency(retirement)}</div>
        <div class="stat-sub">Invested: ${Utils.currency(retirementInv)} · ${alloc.totalValue > 0 ? Utils.percent(retirement / alloc.totalValue * 100) : '0%'} of portfolio</div>
      </div>` : ''}
      <div class="stat-card yellow${this.statFilter === 'emergency' ? ' active-stat' : ''}" style="cursor:pointer" onclick="AssetsPage.filterByStat('emergency')">
        <div class="stat-label">Emergency Fund</div>
        <div class="stat-value">${Utils.currency(emergency)}</div>
        <div class="stat-sub">${alloc.totalValue > 0 ? Utils.percent(emergency / alloc.totalValue * 100) : '0%'} of portfolio</div>
      </div>
    `;
    if (this.activeFilter.category || this.activeFilter.asset_class || this.activeFilter.fund_type || this.activeFilter.search) {
      statsHTML += `<div style="grid-column: 1 / -1; text-align:center; padding:4px; font-size:0.78rem; color:var(--text-muted); background:var(--bg-tertiary); border-radius:6px">Showing filtered results</div>`;
    }
    document.getElementById('assetStats').innerHTML = statsHTML;
  },

  filterByStat(stat) {
    // Toggle: clicking same stat clears the filter
    this.statFilter = this.statFilter === stat ? '' : stat;
    this.renderStats();
    this.switchTab(this.activeTab);
  },

  _isEmergencyAsset(a) {
    if (a.is_emergency_fund === 1) return true;
    const cat = a.category || '';
    const ft = (a.fund_type || '').toLowerCase();
    if (cat === 'Retirement') return false;
    const isFD = ft === 'fd' || ft === 'fixed deposit' || (a.subtype || '').toLowerCase().includes('fixed deposit') ||
                 (a.name || '').toLowerCase().includes('fixed deposit') || (a.name || '').toLowerCase().includes(' fd');
    return cat === 'Cash' || ft === 'arbitrage' || ft === 'liquid' || isFD;
  },

  _isRetirementAsset(a) {
    return (a.category || '') === 'Retirement';
  },

  _isGrowthAsset(a) {
    return !this._isEmergencyAsset(a) && !this._isRetirementAsset(a);
  },

  getStatFilteredItems() {
    if (!this.statFilter) return this.items;
    const all = this.allItems.length ? this.allItems : this.items;
    switch (this.statFilter) {
      case 'growth': return all.filter(a => this._isGrowthAsset(a));
      case 'retirement': return all.filter(a => this._isRetirementAsset(a));
      case 'emergency': return all.filter(a => this._isEmergencyAsset(a));
      default: return this.items;
    }
  },

  populateFilters() {
    const catEl = document.getElementById('assetFilterCategory');
    const clsEl = document.getElementById('assetFilterClass');
    const ftEl = document.getElementById('assetFilterFundType');

    if (catEl) {
      const cur = catEl.value;
      catEl.innerHTML = '<option value="">All Categories</option>' +
        (this.filters.categories || []).map(c => `<option value="${Utils.esc(c)}" ${c === cur ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('');
    }
    if (clsEl) {
      const cur = clsEl.value;
      clsEl.innerHTML = '<option value="">All Asset Classes</option>' +
        (this.filters.assetClasses || []).map(c => `<option value="${Utils.esc(c)}" ${c === cur ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('');
    }
    if (ftEl) {
      const cur = ftEl.value;
      ftEl.innerHTML = '<option value="">All Fund Types</option>' +
        (this.filters.fundTypes || []).map(c => `<option value="${Utils.esc(c)}" ${c === cur ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('');
    }
  },

  onSearchInput: Utils.debounce(function (val) {
    AssetsPage.activeFilter.search = val;
    AssetsPage.pagination.page = 1;
    AssetsPage.updateClearButtonVisibility();
    AssetsPage.loadAll();
  }, 300),

  onFilterChange() {
    this.activeFilter.category = document.getElementById('assetFilterCategory')?.value || '';
    this.activeFilter.asset_class = document.getElementById('assetFilterClass')?.value || '';
    this.activeFilter.fund_type = document.getElementById('assetFilterFundType')?.value || '';
    this.pagination.page = 1;
    this.updateClearButtonVisibility();
    this.loadAll();
  },

  updateClearButtonVisibility() {
    const btn = document.getElementById('assetClearFilterBtn');
    if (!btn) return;
    const f = this.activeFilter;
    btn.style.display = (f.category || f.asset_class || f.fund_type || f.search) ? '' : 'none';
  },

  clearFilters() {
    this.activeFilter = { category: '', asset_class: '', fund_type: '', search: '' };
    this.pagination.page = 1;
    ['assetFilterCategory', 'assetFilterClass', 'assetFilterFundType', 'assetSearchInput'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    this.updateClearButtonVisibility();
    this.loadAll();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    Charts.destroyAll();
    if (tab === 'list') this.renderList();
    else if (tab === 'allocation') this.renderAllocation();
    else if (tab === 'target') this.renderTargetAllocation();
    else if (tab === 'sips') this.renderSIPs();
    else if (tab === 'fds') this.renderFDs();
  },

  // ─── Holdings List ───────────────────────────
  renderList() {
    const container = document.getElementById('assetTabContent');
    const displayItems = this.statFilter ? this.getStatFilteredItems() : this.items;
    const statLabels = { growth: 'Growth Assets', retirement: 'Retirement Corpus', emergency: 'Emergency Fund' };

    if (!displayItems.length) {
      container.innerHTML = `
        <div class="card">
          ${this._renderAssetClassTabs()}
          ${this.statFilter ? `<div style="padding:8px 16px;background:var(--accent-bg,rgba(99,102,241,0.08));border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between"><span style="font-size:0.85rem;font-weight:600">Showing: ${statLabels[this.statFilter]}</span><button class="btn btn-outline btn-xs" onclick="AssetsPage.filterByStat('')">Clear</button></div>` : ''}
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>No assets found</h3>
            <p>${this.activeFilter.search || this.activeFilter.category || this.activeFilter.asset_class || this.statFilter ? 'Try adjusting your filters' : 'Add your first investment to get started'}</p>
            <button class="btn btn-primary btn-sm" onclick="AssetsPage.openForm()">+ Add Asset</button>
          </div>
        </div>`;
      return;
    }

    const { page, pageSize, total, totalPages } = this.statFilter ? { page: 1, pageSize: displayItems.length, total: displayItems.length, totalPages: 1 } : this.pagination;
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    container.innerHTML = `
      <div class="card">
        ${this._renderAssetClassTabs()}
        ${this.statFilter ? `<div style="padding:8px 16px;background:var(--accent-bg,rgba(99,102,241,0.08));border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between"><span style="font-size:0.85rem;font-weight:600">Showing: ${statLabels[this.statFilter]} (${displayItems.length})</span><button class="btn btn-outline btn-xs" onclick="AssetsPage.filterByStat('')">Clear</button></div>` : ''}
        ${this.selectMode && this.selectedIds.size > 0 ? `
          <div class="bulk-action-bar" style="position:sticky;top:0;z-index:10;background:var(--bg-primary);padding:12px 16px;border-bottom:2px solid var(--red);display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:12px 12px 0 0">
            <span style="font-size:0.85rem;font-weight:600">${this.selectedIds.size} asset(s) selected</span>
            <button class="btn btn-danger btn-sm" onclick="AssetsPage.bulkDelete()">🗑 Delete Selected</button>
          </div>
        ` : ''}
        <div class="table-wrapper">
          <table class="asset-holdings-table">
            <thead>
              <tr>
                ${this.selectMode ? `<th style="width:40px"><input type="checkbox" ${this.selectedIds.size === displayItems.length && displayItems.length > 0 ? 'checked' : ''} onchange="AssetsPage.toggleSelectAll(this.checked)"></th>` : ''}
                <th>Name</th>
                <th class="hide-mobile">Category</th>
                <th class="hide-mobile">Class</th>
                <th class="text-right hide-mobile-asset">Invested</th>
                <th class="text-right">Current</th>
                <th class="text-right">Gain/Loss</th>
                <th class="text-right hide-mobile">XIRR</th>
                <th class="text-right hide-mobile">1D</th>
                <th class="text-center hide-mobile-asset">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayItems.map(a => {
                const inv = a.invested_value_inr || a.invested_value || 0;
                const cur = a.current_value_inr || a.current_value || 0;
                const gain = cur - inv;
                const gainPct = inv > 0 ? (gain / inv * 100) : 0;
                let xirrVal = null;
                if (a.purchase_date && inv > 0) {
                  const days = Utils.daysSince(a.purchase_date);
                  xirrVal = Utils.xirr(inv, cur, days);
                }
                const isUSD = a.currency === 'USD';
                const invUSD = isUSD ? (a.invested_value || 0) : 0;
                const curUSD = isUSD ? (a.current_value || 0) : 0;
                const gainUSD = curUSD - invUSD;
                return `
                  <tr class="asset-row" onclick="AssetsPage.toggleMobileDetail(this)">
                    ${this.selectMode ? `<td><input type="checkbox" class="asset-checkbox" value="${a.id}" ${this.selectedIds.has(a.id) ? 'checked' : ''} onchange="event.stopPropagation();AssetsPage.toggleSelect('${a.id}', this.checked)"></td>` : ''}
                    <td>
                      <strong class="asset-name-text" title="${Utils.esc(a.name)}">${Utils.truncateText(a.name, 28)}</strong>
                      ${a.ticker ? `<br><span class="text-muted" style="font-size:0.75rem">${Utils.esc(a.ticker)}</span>` : ''}
                    </td>
                    <td class="hide-mobile">${Utils.categoryBadge(a.category)}</td>
                    <td class="hide-mobile"><span class="text-muted" style="font-size:0.82rem">${Utils.esc(a.asset_class || '-')}</span></td>
                    <td class="text-right font-mono hide-mobile-asset">
                      ${Utils.currency(inv)}
                      ${isUSD ? `<br><span class="usd-value text-muted" style="font-size:0.73rem">$${invUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
                    </td>
                    <td class="text-right font-mono">
                      ${Utils.currency(cur)}
                      ${isUSD ? `<br><span class="usd-value text-muted" style="font-size:0.73rem">$${curUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
                    </td>
                    <td class="text-right font-mono ${Utils.gainColor(gain)}">
                      ${Utils.currency(gain)}<br>
                      <span style="font-size:0.75rem">${Utils.percent(gainPct)}</span>
                      ${isUSD ? `<br><span class="usd-value text-muted" style="font-size:0.73rem">${gainUSD >= 0 ? '+' : ''}$${gainUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
                    </td>
                    <td class="text-right font-mono hide-mobile ${xirrVal !== null ? Utils.gainColor(xirrVal) : 'text-muted'}">${xirrVal !== null ? Utils.percent(xirrVal) : '-'}</td>
                    <td class="text-right font-mono hide-mobile ${Utils.gainColor(a.day_change_pct || 0)}">${a.day_change_pct ? (a.day_change_pct > 0 ? '+' : '') + a.day_change_pct.toFixed(2) + '%' : '-'}</td>
                    <td class="text-center hide-mobile-asset">
                      <div class="btn-group" style="justify-content:center">
                        <button class="btn-icon" onclick="event.stopPropagation();AssetsPage.openForm('${a.id}')" title="Edit">✏️</button>
                        <button class="btn-icon danger" onclick="event.stopPropagation();AssetsPage.deleteItem('${a.id}')" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                  <tr class="asset-detail-row">
                    <td colspan="99">
                      <div class="asset-detail-content">
                        <div class="asset-detail-grid">
                          <div class="asset-detail-item">
                            <span class="asset-detail-label">Invested</span>
                            <span class="font-mono">${Utils.currency(inv)}${isUSD ? ` <span class="text-muted" style="font-size:0.72rem">($${invUSD.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})})</span>` : ''}</span>
                          </div>
                          <div class="asset-detail-item">
                            <span class="asset-detail-label">Category</span>
                            <span>${Utils.categoryBadge(a.category)}${a.asset_class ? ` <span class="text-muted" style="font-size:0.75rem">${Utils.esc(a.asset_class)}</span>` : ''}</span>
                          </div>
                          <div class="asset-detail-item">
                            <span class="asset-detail-label">1D Change</span>
                            <span class="font-mono ${Utils.gainColor(a.day_change_pct || 0)}">${a.day_change_pct ? (a.day_change_pct > 0 ? '+' : '') + a.day_change_pct.toFixed(2) + '%' : '-'}</span>
                          </div>
                          <div class="asset-detail-item">
                            <span class="asset-detail-label">XIRR</span>
                            <span class="font-mono ${xirrVal !== null ? Utils.gainColor(xirrVal) : 'text-muted'}">${xirrVal !== null ? Utils.percent(xirrVal) : '-'}</span>
                          </div>
                        </div>
                        <div class="asset-detail-actions">
                          <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();AssetsPage.openForm('${a.id}')">✏️ Edit</button>
                          <button class="btn btn-outline btn-xs danger" onclick="event.stopPropagation();AssetsPage.deleteItem('${a.id}')">🗑️ Delete</button>
                        </div>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div class="txn-pagination">
          <div class="txn-pagination-info">Showing <strong>${startItem}–${endItem}</strong> of <strong>${total}</strong></div>
          <div class="txn-pagination-controls">
            <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="AssetsPage.goToPage(1)">«</button>
            <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="AssetsPage.goToPage(${page - 1})">‹</button>
            ${this._paginationBtns(page, totalPages)}
            <button class="btn btn-outline btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="AssetsPage.goToPage(${page + 1})">›</button>
            <button class="btn btn-outline btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="AssetsPage.goToPage(${totalPages})">»</button>
          </div>
        </div>` : `<div class="txn-pagination"><div class="txn-pagination-info">${total} asset${total !== 1 ? 's' : ''}</div></div>`}
      </div>
    `;
  },

  _paginationBtns(current, totalPages) {
    const btns = [];
    let start = Math.max(1, current - 2);
    let end = Math.min(totalPages, current + 2);
    if (end - start < 4) { if (start === 1) end = Math.min(totalPages, start + 4); else start = Math.max(1, end - 4); }
    for (let i = start; i <= end; i++) {
      if (i === current) btns.push(`<button class="btn btn-sm txn-page-active">${i}</button>`);
      else btns.push(`<button class="btn btn-outline btn-sm" onclick="AssetsPage.goToPage(${i})">${i}</button>`);
    }
    return btns.join('');
  },

  goToPage(page) {
    this.pagination.page = Math.max(1, Math.min(page, this.pagination.totalPages));
    this.loadAll();
  },

  // ─── Allocation Tab ──────────────────────────
  renderAllocation() {
    const container = document.getElementById('assetTabContent');
    if (!this.allocation) {
      container.innerHTML = '<div class="card"><div class="empty-state"><p>No allocation data</p></div></div>';
      return;
    }
    const alloc = this.allocation;

    const renderBreakdown = (title, obj, chartId) => {
      const entries = Object.entries(obj || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      if (!entries.length) return `<div class="card"><div class="empty-state"><p>No data for ${title}</p></div></div>`;
      return `
        <div class="card">
          <div class="card-header"><div class="card-title">${title}</div></div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;padding-top:8px">
            <div style="flex:1;min-width:200px">
              ${entries.map(([cat, val]) => {
                const pct = total > 0 ? (val / total * 100) : 0;
                return `
                <div style="margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:3px">
                    <span style="font-weight:500">${Utils.esc(cat)}</span>
                    <span class="font-mono">${Utils.currency(val)} <span class="text-muted">(${pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:4px;transition:width 0.5s ease"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <div style="width:200px;flex-shrink:0">
              <canvas id="${chartId}" style="max-height:200px"></canvas>
            </div>
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="grid-2">
        ${renderBreakdown('📊 By Category', alloc.byCategory, 'allocCatChart')}
        ${renderBreakdown('🏷️ By Asset Class', alloc.byAssetClass, 'allocClassChart')}
      </div>
      ${Object.keys(alloc.byFundType || {}).length ? renderBreakdown('📁 By Fund Type', alloc.byFundType, 'allocFundChart') : ''}
    `;

    // Render charts
    requestAnimationFrame(async () => {
      const renderPie = async (id, obj) => {
        const entries = Object.entries(obj || {}).filter(([, v]) => v > 0);
        if (entries.length) await Charts.doughnut(id, entries.map(e => e[0]), entries.map(e => e[1]));
      };
      await renderPie('allocCatChart', alloc.byCategory);
      await renderPie('allocClassChart', alloc.byAssetClass);
      if (alloc.byFundType) await renderPie('allocFundChart', alloc.byFundType);
    });
  },

  // ─── Current vs Target Allocation Tab ────────
  renderTargetAllocation() {
    const container = document.getElementById('assetTabContent');
    if (!this.allocation) {
      container.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🎯</div><h3>No allocation data</h3><p>Add assets to see your allocation vs targets</p></div></div>';
      return;
    }
    const alloc = this.allocation;

    const defaultTargets = {
      'Equity': 50, 'Debt': 25, 'Gold': 10, 'Cash': 5,
      'Real Estate': 5, 'International': 5, 'Crypto': 0
    };
    const savedTargets = JSON.parse(localStorage.getItem('wp_target_allocation') || 'null');
    const targets = savedTargets || defaultTargets;

    const catEntries = Object.entries(alloc.byCategory || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const catTotal = catEntries.reduce((s, [, v]) => s + v, 0);
    const allCats = [...new Set([...catEntries.map(e => e[0]), ...Object.keys(targets)])];
    const visibleCats = allCats.filter(cat => (alloc.byCategory?.[cat] || 0) > 0 || (targets[cat] || 0) > 0);

    if (catTotal <= 0) {
      container.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🎯</div><h3>No allocation data</h3><p>Add assets to compare against your targets</p></div></div>';
      return;
    }

    // Summary stats
    let onTrack = 0, over = 0, under = 0;
    visibleCats.forEach(cat => {
      const currentPct = catTotal > 0 ? ((alloc.byCategory?.[cat] || 0) / catTotal * 100) : 0;
      const targetPct = targets[cat] || 0;
      const diff = currentPct - targetPct;
      if (Math.abs(diff) <= 2) onTrack++;
      else if (diff > 0) over++;
      else under++;
    });

    // Rebalance suggestions
    const rebalanceRows = visibleCats.map(cat => {
      const val = alloc.byCategory?.[cat] || 0;
      const currentPct = catTotal > 0 ? (val / catTotal * 100) : 0;
      const targetPct = targets[cat] || 0;
      const diff = currentPct - targetPct;
      const targetVal = catTotal * targetPct / 100;
      const action = Math.abs(diff) <= 2 ? null : (diff > 0 ? { type: 'sell', amount: val - targetVal } : { type: 'buy', amount: targetVal - val });
      return { cat, val, currentPct, targetPct, diff, targetVal, action };
    });

    container.innerHTML = `
      <!-- Summary Cards -->
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card green">
          <div class="stat-label">On Track</div>
          <div class="stat-value">${onTrack}</div>
          <div class="stat-sub">Within ±2% of target</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-label">Over-allocated</div>
          <div class="stat-value">${over}</div>
          <div class="stat-sub">Above target range</div>
        </div>
        <div class="stat-card red">
          <div class="stat-label">Under-allocated</div>
          <div class="stat-value">${under}</div>
          <div class="stat-sub">Below target range</div>
        </div>
      </div>

      <!-- Comparison Table -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🎯 Current vs Target Allocation</div>
          <button class="btn btn-outline btn-xs" onclick="AssetsPage.editTargetAllocation()">Edit Targets</button>
        </div>
        <div class="table-wrapper" style="border:none">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Current Value</th>
                <th class="text-right">Current %</th>
                <th class="text-right">Target %</th>
                <th class="text-right">Diff</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rebalanceRows.map(r => {
                const status = Math.abs(r.diff) <= 2 ? '✅ On Track' : (r.diff > 0 ? '⚠️ Over' : '🔻 Under');
                const statusColor = Math.abs(r.diff) <= 2 ? 'var(--green)' : (r.diff > 0 ? 'var(--yellow)' : 'var(--red)');
                return `<tr>
                  <td><strong>${Utils.esc(r.cat)}</strong></td>
                  <td class="text-right font-mono">${Utils.currency(r.val)}</td>
                  <td class="text-right font-mono">${r.currentPct.toFixed(1)}%</td>
                  <td class="text-right font-mono text-muted">${r.targetPct.toFixed(1)}%</td>
                  <td class="text-right font-mono ${r.diff >= 0 ? 'text-green' : 'text-red'}">${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(1)}%</td>
                  <td><span style="font-size:0.82rem;color:${statusColor}">${status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid-2" style="margin-bottom:20px">
        <div class="card">
          <div class="card-header"><div class="card-title">📊 Comparison Chart</div></div>
          <div class="chart-container" style="height:280px"><canvas id="targetCompareBarChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">🔘 Deviation from Target</div></div>
          <div class="chart-container" style="height:280px"><canvas id="targetDeviationChart"></canvas></div>
        </div>
      </div>

      <!-- Rebalance Suggestions -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔄 Rebalance Suggestions</div>
        </div>
        ${rebalanceRows.filter(r => r.action).length ? `
        <div class="table-wrapper" style="border:none">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Current</th>
                <th class="text-right">Target</th>
                <th>Action</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rebalanceRows.filter(r => r.action).map(r => `
                <tr>
                  <td><strong>${Utils.esc(r.cat)}</strong></td>
                  <td class="text-right font-mono">${Utils.currency(r.val)}</td>
                  <td class="text-right font-mono text-muted">${Utils.currency(r.targetVal)}</td>
                  <td>
                    <span class="badge ${r.action.type === 'sell' ? 'badge-red' : 'badge-green'}" style="font-size:0.78rem;padding:3px 10px;border-radius:12px;background:${r.action.type === 'sell' ? 'var(--red-bg, #fef2f2)' : 'var(--green-bg, #f0fdf4)'};color:${r.action.type === 'sell' ? 'var(--red, #ef4444)' : 'var(--green, #10b981)'}">
                      ${r.action.type === 'sell' ? '↓ Reduce' : '↑ Increase'}
                    </span>
                  </td>
                  <td class="text-right font-mono ${r.action.type === 'sell' ? 'text-red' : 'text-green'}">${Utils.currency(r.action.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-muted" style="font-size:0.78rem;padding:12px 16px 4px;margin:0">
          💡 These are suggestions to rebalance your portfolio to match target allocation. Amounts shown are approximate.
        </p>
        ` : `
        <div class="empty-state" style="padding:24px">
          <div class="empty-icon">🎉</div>
          <h3>Portfolio is well balanced!</h3>
          <p>All categories are within ±2% of their targets.</p>
        </div>
        `}
      </div>
    `;

    // Render charts
    requestAnimationFrame(async () => {
      // Bar chart — current vs target %
      const currentPcts = visibleCats.map(cat => catTotal > 0 ? ((alloc.byCategory?.[cat] || 0) / catTotal * 100) : 0);
      const targetPcts = visibleCats.map(cat => targets[cat] || 0);
      await Charts.bar('targetCompareBarChart', visibleCats, [
        { label: 'Current %', data: currentPcts, color: '#6366f1' },
        { label: 'Target %', data: targetPcts, color: '#10b98180' },
      ], {
        scales: {
          y: { ticks: { callback: val => val + '%' } },
        },
        plugins: {
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` },
          },
        },
      });

      // Deviation horizontal bar chart
      const deviations = visibleCats.map(cat => {
        const currentPct = catTotal > 0 ? ((alloc.byCategory?.[cat] || 0) / catTotal * 100) : 0;
        return currentPct - (targets[cat] || 0);
      });
      const deviationColors = deviations.map(d => Math.abs(d) <= 2 ? '#10b981' : (d > 0 ? '#f59e0b' : '#ef4444'));
      await Charts.bar('targetDeviationChart', visibleCats, [
        { label: 'Deviation %', data: deviations, backgroundColor: deviationColors, color: deviationColors },
      ], {
        indexAxis: 'y',
        scales: {
          x: { ticks: { callback: val => (val >= 0 ? '+' : '') + val + '%' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.x >= 0 ? '+' : ''}${ctx.parsed.x.toFixed(1)}% deviation` },
          },
        },
      });
    });
  },

  // ─── SIPs Tab ─────────────────────────────────
  renderSIPs() {
    const container = document.getElementById('assetTabContent');
    const sipAssets = this.allItems.filter(a => (a.monthly_contribution || 0) > 0 || (a.sip_amount || 0) > 0);

    if (!sipAssets.length) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>No SIPs Found</h3>
            <p>Add a monthly SIP/contribution to your assets to track them here</p>
            <button class="btn btn-primary btn-sm" onclick="AssetsPage.openForm()">+ Add Asset with SIP</button>
          </div>
        </div>`;
      return;
    }

    const totalSIP = sipAssets.reduce((s, a) => s + (a.monthly_contribution || a.sip_amount || 0), 0);
    const totalInvested = sipAssets.reduce((s, a) => s + (a.invested_value_inr || a.invested_value || 0), 0);
    const totalCurrent = sipAssets.reduce((s, a) => s + (a.current_value_inr || a.current_value || 0), 0);
    const totalGain = totalCurrent - totalInvested;
    const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested * 100) : 0;

    // Group by category
    const byCat = {};
    sipAssets.forEach(a => {
      const cat = a.category || 'Other';
      if (!byCat[cat]) byCat[cat] = { sip: 0, count: 0 };
      byCat[cat].sip += (a.monthly_contribution || a.sip_amount || 0);
      byCat[cat].count++;
    });

    container.innerHTML = `
      <!-- SIP Summary -->
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card blue">
          <div class="stat-label">Total Monthly SIP</div>
          <div class="stat-value">${Utils.currency(totalSIP)}</div>
          <div class="stat-sub">${sipAssets.length} active SIP${sipAssets.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Annual SIP Outflow</div>
          <div class="stat-value">${Utils.currency(totalSIP * 12)}</div>
          <div class="stat-sub">Projected yearly investment</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">SIP Portfolio Value</div>
          <div class="stat-value">${Utils.currency(totalCurrent)}</div>
        </div>
        <div class="stat-card ${totalGain >= 0 ? 'green' : 'red'}">
          <div class="stat-label">SIP Gain / Loss</div>
          <div class="stat-value ${Utils.gainColor(totalGain)}">${Utils.currency(totalGain)}</div>
          <div class="stat-sub ${Utils.gainClass(totalGain)}">${totalGain >= 0 ? '↑' : '↓'} ${Utils.percent(Math.abs(totalGainPct))}</div>
        </div>
      </div>

      <!-- SIP by Category -->
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-header"><div class="card-title">📊 SIP by Category</div></div>
          <div style="padding:8px 0">
            ${Object.entries(byCat).sort((a, b) => b[1].sip - a[1].sip).map(([cat, data]) => {
              const pct = totalSIP > 0 ? (data.sip / totalSIP * 100) : 0;
              return `
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:3px">
                  <span style="font-weight:500">${Utils.esc(cat)} <span class="text-muted">(${data.count})</span></span>
                  <span class="font-mono">${Utils.currency(data.sip)}/mo <span class="text-muted">(${pct.toFixed(1)}%)</span></span>
                </div>
                <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px;transition:width 0.5s ease"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📈 SIP Growth Projection</div></div>
          <div class="chart-container" style="height:220px"><canvas id="sipProjectionChart"></canvas></div>
        </div>
      </div>

      <!-- SIP Table -->
      <div class="card">
        <div class="card-header"><div class="card-title">📋 Active SIPs</div></div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th class="hide-mobile">Fund House</th>
                <th class="text-right">Monthly SIP</th>
                <th class="text-right">Invested</th>
                <th class="text-right">Current</th>
                <th class="text-right">Gain/Loss</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sipAssets.sort((a, b) => (b.monthly_contribution || b.sip_amount || 0) - (a.monthly_contribution || a.sip_amount || 0)).map(a => {
                const sip = a.monthly_contribution || a.sip_amount || 0;
                const inv = a.invested_value_inr || a.invested_value || 0;
                const cur = a.current_value_inr || a.current_value || 0;
                const gain = cur - inv;
                const gainPct = inv > 0 ? (gain / inv * 100) : 0;
                return `
                <tr>
                  <td><strong title="${Utils.esc(a.name)}">${Utils.truncateText(a.name, 28)}</strong></td>
                  <td>${Utils.categoryBadge(a.category)}</td>
                  <td class="hide-mobile"><span class="text-muted" style="font-size:0.82rem">${Utils.esc(a.fund_house || a.bank_name || '-')}</span></td>
                  <td class="text-right font-mono text-blue" style="font-weight:600">${Utils.currency(sip)}</td>
                  <td class="text-right font-mono">${Utils.currency(inv)}</td>
                  <td class="text-right font-mono">${Utils.currency(cur)}</td>
                  <td class="text-right font-mono ${Utils.gainColor(gain)}">${Utils.currency(gain)}<br><span style="font-size:0.75rem">${Utils.percent(gainPct)}</span></td>
                  <td class="text-center">
                    <button class="btn-icon" onclick="AssetsPage.openForm('${a.id}')" title="Edit">✏️</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:600;border-top:2px solid var(--border-color)">
                <td colspan="3">Total</td>
                <td class="text-right font-mono text-blue">${Utils.currency(totalSIP)}</td>
                <td class="text-right font-mono">${Utils.currency(totalInvested)}</td>
                <td class="text-right font-mono">${Utils.currency(totalCurrent)}</td>
                <td class="text-right font-mono ${Utils.gainColor(totalGain)}">${Utils.currency(totalGain)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;

    // Render SIP projection chart
    requestAnimationFrame(async () => {
      const months = [3, 6, 12, 24, 36, 60];
      const labels = months.map(m => m >= 12 ? `${m / 12}Y` : `${m}M`);
      const assumedReturn = 0.12; // 12% annual
      const monthlyRate = assumedReturn / 12;
      const projections = months.map(m => {
        // Future value of SIP: P * [(1+r)^n - 1] / r * (1+r)
        const fv = totalSIP * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate);
        return Math.round(fv);
      });
      const invested = months.map(m => totalSIP * m);

      await Charts.bar('sipProjectionChart', labels, [
        { label: 'Amount Invested', data: invested, color: '#6366f180' },
        { label: 'Projected Value (12%)', data: projections, color: '#10b981' },
      ], {
        scales: {
          y: { ticks: { callback: val => Utils.currency(val) } },
        },
        plugins: {
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Utils.currency(ctx.parsed.y)}` },
          },
        },
      });
    });
  },

  // ─── Fixed Deposits Tab ──────────────────────
  renderFDs() {
    const container = document.getElementById('assetTabContent');
    const fdAssets = this.allItems.filter(a => {
      const sub = (a.subtype || '').toLowerCase();
      const cls = (a.asset_class || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      return sub.includes('fd') || sub.includes('fixed deposit') || cls === 'fixed income' ||
             name.includes('fixed deposit') || (name.includes('fd') && a.interest_rate > 0 && a.tenure_months > 0);
    });

    if (!fdAssets.length) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">🏦</div>
            <h3>No Fixed Deposits</h3>
            <p>Add FDs with interest rate, tenure, and purchase date to auto-calculate returns</p>
            <button class="btn btn-primary btn-sm" onclick="AssetsPage.openFDForm()">+ Add Fixed Deposit</button>
          </div>
        </div>`;
      return;
    }

    const totalInvested = fdAssets.reduce((s, a) => s + (a.invested_value || 0), 0);
    const totalCurrent = fdAssets.reduce((s, a) => s + (a.current_value || 0), 0);
    const totalInterest = totalCurrent - totalInvested;
    const totalMaturity = fdAssets.reduce((s, a) => s + (a.maturity_value || a.current_value || 0), 0);

    container.innerHTML = `
      <!-- FD Summary -->
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card blue">
          <div class="stat-label">Total Deposited</div>
          <div class="stat-value">${Utils.currency(totalInvested)}</div>
          <div class="stat-sub">${fdAssets.length} FD${fdAssets.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Current Value</div>
          <div class="stat-value">${Utils.currency(totalCurrent)}</div>
          <div class="stat-sub">Interest earned: ${Utils.currency(totalInterest)}</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-label">Maturity Value</div>
          <div class="stat-value">${Utils.currency(totalMaturity)}</div>
          <div class="stat-sub">At full term completion</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Interest Rate</div>
          <div class="stat-value">${fdAssets.length > 0 ? (fdAssets.reduce((s, a) => s + (a.interest_rate || 0), 0) / fdAssets.length).toFixed(2) : 0}%</div>
        </div>
      </div>

      <!-- FD Cards -->
      <div class="grid-2">
        ${fdAssets.sort((a, b) => (b.invested_value || 0) - (a.invested_value || 0)).map(a => {
          const inv = a.invested_value || 0;
          const cur = a.current_value || inv;
          const interest = cur - inv;
          const matVal = a.maturity_value || cur;
          const matDate = a.fd_maturity_date || '';
          const daysElapsed = a.fd_days_elapsed || 0;
          const daysTotal = a.fd_days_total || 1;
          const progress = Math.min(100, (daysElapsed / daysTotal) * 100);
          const isMatured = matDate && new Date(matDate) <= new Date();

          return `
          <div class="card" style="position:relative;overflow:hidden">
            ${isMatured ? '<div style="position:absolute;top:8px;right:8px"><span class="badge" style="background:var(--green-bg,#f0fdf4);color:var(--green);font-size:0.72rem;padding:2px 8px;border-radius:10px">✅ Matured</span></div>' : ''}
            <div class="card-header">
              <div class="card-title" style="font-size:0.95rem">${Utils.esc(a.name)}</div>
              <button class="btn-icon" onclick="AssetsPage.openForm('${a.id}')" title="Edit">✏️</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div>
                <div class="text-muted" style="font-size:0.75rem">Principal</div>
                <div class="font-mono" style="font-weight:600">${Utils.currency(inv)}</div>
              </div>
              <div>
                <div class="text-muted" style="font-size:0.75rem">Current Value</div>
                <div class="font-mono text-green" style="font-weight:600">${Utils.currency(cur)}</div>
              </div>
              <div>
                <div class="text-muted" style="font-size:0.75rem">Interest Rate</div>
                <div class="font-mono">${a.interest_rate || 0}% p.a.</div>
              </div>
              <div>
                <div class="text-muted" style="font-size:0.75rem">Interest Earned</div>
                <div class="font-mono text-green">${Utils.currency(interest)}</div>
              </div>
              <div>
                <div class="text-muted" style="font-size:0.75rem">Tenure</div>
                <div class="font-mono">${a.tenure_months || 0} months</div>
              </div>
              <div>
                <div class="text-muted" style="font-size:0.75rem">Maturity Date</div>
                <div class="font-mono">${matDate ? Utils.formatDate(matDate) : '-'}</div>
              </div>
              ${a.fund_house || a.bank_name ? `<div style="grid-column:span 2">
                <div class="text-muted" style="font-size:0.75rem">Bank</div>
                <div style="font-size:0.88rem">🏦 ${Utils.esc(a.fund_house || a.bank_name)}</div>
              </div>` : ''}
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
                <span class="text-muted">${a.purchase_date ? Utils.formatDate(a.purchase_date) : 'Start'}</span>
                <span class="text-muted">${isMatured ? 'Matured' : `${Math.round(progress)}% complete`}</span>
                <span class="text-muted">${matDate ? Utils.formatDate(matDate) : 'Maturity'}</span>
              </div>
              <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                <div style="width:${progress}%;height:100%;background:${isMatured ? 'var(--green)' : 'var(--accent)'};border-radius:4px;transition:width 0.5s ease"></div>
              </div>
            </div>
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
              <span class="text-muted" style="font-size:0.78rem">Maturity Value</span>
              <span class="font-mono" style="font-weight:700;color:var(--accent)">${Utils.currency(matVal)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-primary btn-sm" onclick="AssetsPage.openFDForm()">+ Add Fixed Deposit</button>
      </div>
    `;
  },

  // Quick add FD form
  openFDForm() {
    const categories = ['Debt', 'Cash', 'Other'];
    Modal.open('Add Fixed Deposit', `
      <form id="fdForm" onsubmit="AssetsPage.saveFD(event)">
        <div class="form-group">
          <label>FD Name *</label>
          <input class="form-control" name="name" required placeholder="e.g. SBI FD - 1 Year">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Bank / Institution</label>
            <input class="form-control" name="fund_house" placeholder="e.g. SBI, HDFC Bank">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select class="form-control" name="category">
              ${categories.map(c => `<option ${c === 'Debt' ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Principal Amount (₹) *</label>
            <input class="form-control" type="number" step="0.01" name="invested_value" required placeholder="100000">
          </div>
          <div class="form-group">
            <label>Interest Rate (% p.a.) *</label>
            <input class="form-control" type="number" step="0.01" name="interest_rate" required placeholder="7.1">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tenure (months) *</label>
            <input class="form-control" type="number" name="tenure_months" required placeholder="12">
          </div>
          <div class="form-group">
            <label>Purchase / Start Date *</label>
            <input class="form-control" type="date" name="purchase_date" required>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" name="notes" rows="2" placeholder="e.g. Auto-renewal, FD number..."></textarea>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add FD</button>
        </div>
      </form>
    `);
  },

  async saveFD(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.invested_value = Number(form.invested_value) || 0;
    form.interest_rate = Number(form.interest_rate) || 0;
    form.tenure_months = Number(form.tenure_months) || 0;
    form.current_value = form.invested_value; // Will be auto-calculated by backend
    form.subtype = 'Fixed Deposit';
    form.asset_class = 'Fixed Income';

    try {
      await API.createAsset(form);
      Toast.success('Fixed Deposit added!');
      Modal.close();
      await this.loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  _renderAssetClassTabs() {
    // Build unique asset classes from filters
    const classes = this.filters.assetClasses || [];
    if (!classes.length) return '';
    const active = this.activeFilter.asset_class || '';
    return `
      <div class="asset-class-tabs">
        <button class="asset-class-tab ${active === '' ? 'active' : ''}" onclick="AssetsPage.onClassTabClick('')">All</button>
        ${classes.map(cls => `
          <button class="asset-class-tab ${active === cls ? 'active' : ''}" onclick="AssetsPage.onClassTabClick('${Utils.esc(cls)}')">${Utils.esc(cls)}</button>
        `).join('')}
      </div>`;
  },

  onClassTabClick(cls) {
    this.activeFilter.asset_class = cls;
    // Also sync the dropdown filter
    const el = document.getElementById('assetFilterClass');
    if (el) el.value = cls;
    this.pagination.page = 1;
    this.updateClearButtonVisibility();
    this.loadAll();
  },

  editTargetAllocation() {
    const defaultTargets = {
      'Equity': 50, 'Debt': 25, 'Gold': 10, 'Cash': 5,
      'Real Estate': 5, 'International': 5, 'Crypto': 0
    };
    const savedTargets = JSON.parse(localStorage.getItem('wp_target_allocation') || 'null');
    const targets = savedTargets || defaultTargets;
    const cats = Object.keys(targets);

    Modal.open('Edit Target Allocation', `
      <form id="targetAllocForm" onsubmit="AssetsPage.saveTargetAllocation(event)">
        <p class="text-muted" style="font-size:0.85rem;margin-bottom:16px">Set your ideal portfolio allocation percentages. They should sum to 100%.</p>
        ${cats.map(cat => `
          <div class="form-group" style="margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <label style="width:120px;font-size:0.85rem;font-weight:500">${cat}</label>
              <input class="form-control" type="number" step="0.1" min="0" max="100" name="${cat}" value="${targets[cat]}" style="width:80px;font-size:0.85rem">
              <span class="text-muted" style="font-size:0.85rem">%</span>
            </div>
          </div>
        `).join('')}
        <div id="targetAllocTotal" style="font-size:0.85rem;margin:12px 0;font-weight:600"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="button" class="btn btn-outline" onclick="AssetsPage.resetTargetAllocation()">Reset Defaults</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);

    // Update total display
    const updateTotal = () => {
      const form = document.getElementById('targetAllocForm');
      if (!form) return;
      const total = cats.reduce((s, cat) => s + (Number(form.elements[cat]?.value) || 0), 0);
      const el = document.getElementById('targetAllocTotal');
      if (el) {
        el.textContent = `Total: ${total.toFixed(1)}%`;
        el.style.color = Math.abs(total - 100) <= 0.5 ? 'var(--green)' : 'var(--red)';
      }
    };
    updateTotal();
    document.getElementById('targetAllocForm')?.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', updateTotal);
    });
  },

  saveTargetAllocation(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const targets = {};
    Object.keys(form).forEach(k => { targets[k] = Number(form[k]) || 0; });
    localStorage.setItem('wp_target_allocation', JSON.stringify(targets));
    Modal.close();
    Toast.success('Target allocation saved!');
    this.switchTab('allocation');
  },

  resetTargetAllocation() {
    localStorage.removeItem('wp_target_allocation');
    Modal.close();
    Toast.success('Target allocation reset to defaults');
    this.switchTab('allocation');
  },

  // ─── Add / Edit Form ─────────────────────────
  openForm(id) {
    const a = id ? this.items.find(x => x.id === id) : {};
    const isEdit = !!id;

    const categories = ['Equity', 'Debt', 'Gold', 'Cash', 'Real Estate', 'International', 'Crypto', 'Retirement', 'Other'];
    const assetClasses = ['Mutual Fund', 'Stock', 'ETF', 'Fixed Income', 'Commodity', 'Cash', 'Real Estate', 'Crypto', 'Other'];

    Modal.open(isEdit ? 'Edit Asset' : 'Add Asset', `
      <form id="assetForm" onsubmit="AssetsPage.save(event, '${id || ''}')">
        <div class="form-group">
          <label>Name *</label>
          <input class="form-control" name="name" value="${Utils.esc(a.name || '')}" required placeholder="e.g. HDFC Flexicap Fund">
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Category</label>
            <select class="form-control" name="category" onchange="AssetsPage._onCategoryChange(this.value)">
              ${categories.map(c => `<option ${a.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Asset Class</label>
            <select class="form-control" name="asset_class">
              <option value="">—</option>
              ${assetClasses.map(c => `<option ${a.asset_class === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Fund Type</label>
            <input class="form-control" name="fund_type" value="${Utils.esc(a.fund_type || '')}" placeholder="Equity, Debt, Liquid...">
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Invested Value</label>
            <input class="form-control" type="number" step="0.01" name="invested_value" value="${a.invested_value || 0}">
          </div>
          <div class="form-group">
            <label>Current Value</label>
            <input class="form-control" type="number" step="0.01" name="current_value" value="${a.current_value || 0}">
          </div>
          <div class="form-group">
            <label>Units</label>
            <input class="form-control" type="number" step="0.0001" name="units" value="${a.units || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Currency</label>
            <select class="form-control" name="currency">
              <option ${(a.currency || 'INR') === 'INR' ? 'selected' : ''}>INR</option>
              <option ${a.currency === 'USD' ? 'selected' : ''}>USD</option>
            </select>
          </div>
          <div class="form-group">
            <label>Ticker / Symbol</label>
            <input class="form-control" name="ticker" value="${Utils.esc(a.ticker || '')}" placeholder="e.g. HDFCFLEX.NS">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Purchase Date</label>
            <input class="form-control" type="date" name="purchase_date" value="${a.purchase_date ? a.purchase_date.split('T')[0] : ''}">
          </div>
          <div class="form-group">
            <label>Subtype</label>
            <input class="form-control" name="subtype" value="${Utils.esc(a.subtype || '')}" placeholder="e.g. Mutual Fund, FD, Stock">
          </div>
        </div>
        <div class="form-group" id="retirementFields" style="display:${a.category === 'Retirement' ? 'block' : 'none'}">
          <label>Retirement Type</label>
          <select class="form-control" name="retirement_subtype" id="formRetirementSubtype">
            <option value="">Select Type</option>
            <option value="EPF" ${(a.retirement_subtype || '') === 'EPF' ? 'selected' : ''}>EPF</option>
            <option value="NPS" ${(a.retirement_subtype || '') === 'NPS' ? 'selected' : ''}>NPS</option>
            <option value="PPF" ${(a.retirement_subtype || '') === 'PPF' ? 'selected' : ''}>PPF</option>
            <option value="Other" ${(a.retirement_subtype || '') === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group" id="npsFields" style="display:${a.retirement_subtype === 'NPS' ? 'block' : 'none'}">
          <label>NPS Equity Allocation (%)</label>
          <input class="form-control" type="number" name="nps_equity_pct" id="formNpsEquityPct" value="${a.nps_equity_pct || 75}" min="0" max="100">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fund House / Bank</label>
            <input class="form-control" name="fund_house" value="${Utils.esc(a.fund_house || a.bank_name || '')}">
          </div>
          <div class="form-group">
            <label>Monthly SIP / Contribution</label>
            <input class="form-control" type="number" step="0.01" name="monthly_contribution" value="${a.monthly_contribution || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Interest Rate (%)</label>
            <input class="form-control" type="number" step="0.01" name="interest_rate" value="${a.interest_rate || 0}">
          </div>
          <div class="form-group">
            <label>Tenure (months)</label>
            <input class="form-control" type="number" name="tenure_months" value="${a.tenure_months || 0}">
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" name="notes" rows="2">${Utils.esc(a.notes || '')}</textarea>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Asset</button>
        </div>
      </form>
    `);
  },

  _onCategoryChange(val) {
    const retFields = document.getElementById('retirementFields');
    const npsFields = document.getElementById('npsFields');
    if (retFields) retFields.style.display = val === 'Retirement' ? 'block' : 'none';
    if (npsFields) npsFields.style.display = 'none';
    if (val === 'Retirement') {
      const retSub = document.getElementById('formRetirementSubtype');
      if (retSub) retSub.addEventListener('change', function() {
        if (npsFields) npsFields.style.display = this.value === 'NPS' ? 'block' : 'none';
      });
    }
  },

  async save(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.invested_value = Number(form.invested_value) || 0;
    form.current_value = Number(form.current_value) || form.invested_value;
    form.units = Number(form.units) || 0;
    form.monthly_contribution = Number(form.monthly_contribution) || 0;
    form.interest_rate = Number(form.interest_rate) || 0;
    form.tenure_months = Number(form.tenure_months) || 0;

    try {
      if (id) {
        await API.updateAsset(id, form);
        Toast.success('Asset updated!');
      } else {
        await API.createAsset(form);
        Toast.success('Asset added!');
      }
      Modal.close();
      await this.loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  async deleteItem(id) {
    const ok = await Modal.confirm('Delete Asset', 'Are you sure you want to delete this asset?');
    if (!ok) return;
    try {
      await API.deleteAsset(id);
      Toast.success('Asset deleted');
      await this.loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  toggleSelectMode() {
    this.selectMode = !this.selectMode;
    this.selectedIds.clear();
    const btn = document.getElementById('selectModeBtn');
    if (btn) btn.textContent = this.selectMode ? '✕ Cancel' : '☑ Select';
    this.renderList();
  },

  toggleSelect(id, checked) {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    // Re-render just the bulk action bar
    this.renderList();
  },

  toggleSelectAll(checked) {
    if (checked) {
      this.items.forEach(a => this.selectedIds.add(a.id));
    } else {
      this.selectedIds.clear();
    }
    this.renderList();
  },

  async bulkDelete() {
    if (!this.selectedIds.size) return;
    const ok = await Modal.confirm('Bulk Delete', `Delete ${this.selectedIds.size} selected asset(s)? This cannot be undone.`);
    if (!ok) return;
    try {
      await API.bulkDeleteAssets([...this.selectedIds]);
      Toast.success(`Deleted ${this.selectedIds.size} assets`);
      this.selectedIds.clear();
      this.selectMode = false;
      const btn = document.getElementById('selectModeBtn');
      if (btn) btn.textContent = '☑ Select';
      await this.loadAll();
    } catch (e) { Toast.error(e.message); }
  },

  async mergeduplicates() {
    const ok = await Modal.confirm('Merge Duplicates', 'This will combine assets with the same name. Continue?');
    if (!ok) return;
    try {
      const res = await API.mergeAssetDuplicates();
      Toast.success(res.message || 'Done');
      await this.loadAll();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  // ─── Asset Transaction History ─────────────────
  async openAssetTransactions(assetId) {
    const asset = this.items.find(a => a.id === assetId) || this.allItems.find(a => a.id === assetId);
    const name = asset ? asset.name : 'Asset';

    Modal.open(`Transaction History — ${Utils.esc(name)}`, `
      <div id="assetTxnContent">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Loading transactions...
        </div>
      </div>
    `);

    try {
      const res = await API.getAssetTransactions(assetId);
      const txns = res.data || [];
      const container = document.getElementById('assetTxnContent');
      if (!container) return;

      container.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="AssetsPage.openAddAssetTransaction('${assetId}')">+ Add Transaction</button>
        </div>
        ${txns.length ? `
          <div class="table-wrapper" style="max-height:400px;overflow-y:auto">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th class="text-right">Units</th><th class="text-right">Price</th><th class="text-right">Amount</th><th class="text-center">Actions</th></tr></thead>
              <tbody>
                ${txns.map(t => `
                  <tr>
                    <td class="font-mono text-muted">${t.date ? Utils.formatDate(t.date) : '-'}</td>
                    <td><span class="badge badge-${t.type === 'buy' ? 'income' : t.type === 'sell' ? 'expense' : 'other'}" style="font-size:0.75rem">${Utils.esc(t.type)}</span></td>
                    <td class="text-right font-mono">${t.units || '-'}</td>
                    <td class="text-right font-mono">${t.price ? Utils.currencyFull(t.price) : '-'}</td>
                    <td class="text-right font-mono ${t.type === 'sell' || t.type === 'dividend' ? 'text-green' : ''}">${Utils.currencyFull(t.amount || 0)}</td>
                    <td class="text-center">
                      <button class="btn-icon danger" onclick="AssetsPage.deleteAssetTxn('${t.id}', '${assetId}')" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state" style="padding:24px"><p>No transaction history recorded. Add buy/sell/dividend entries.</p></div>'}
      `;
    } catch (err) {
      const container = document.getElementById('assetTxnContent');
      if (container) container.innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(err.message)}</p></div>`;
    }
  },

  openAddAssetTransaction(assetId) {
    Modal.open('Add Asset Transaction', `
      <form onsubmit="AssetsPage.saveAssetTransaction(event, '${assetId}')">
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" name="type">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="dividend">Dividend</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input class="form-control" type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Units</label>
            <input class="form-control" type="number" step="0.0001" name="units" placeholder="0">
          </div>
          <div class="form-group">
            <label>Price per Unit</label>
            <input class="form-control" type="number" step="0.01" name="price" placeholder="0">
          </div>
          <div class="form-group">
            <label>Total Amount</label>
            <input class="form-control" type="number" step="0.01" name="amount" required placeholder="0">
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input class="form-control" name="notes" placeholder="Optional note">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    `);
  },

  async saveAssetTransaction(e, assetId) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.units = Number(form.units) || 0;
    form.price = Number(form.price) || 0;
    form.amount = Number(form.amount) || 0;
    try {
      await API.addAssetTransaction(assetId, form);
      Toast.success('Transaction added!');
      Modal.close();
      this.openAssetTransactions(assetId);
    } catch (err) { Toast.error(err.message); }
  },

  async deleteAssetTxn(txnId, assetId) {
    const ok = await Modal.confirm('Delete Transaction', 'Delete this asset transaction?');
    if (!ok) return;
    try {
      await API.deleteAssetTransaction(txnId);
      Toast.success('Deleted');
      this.openAssetTransactions(assetId);
    } catch (e) { Toast.error(e.message); }
  },

  toggleMobileDetail(row) {
    // Only toggle on mobile
    if (window.innerWidth > 768) return;
    const detailRow = row.nextElementSibling;
    if (!detailRow || !detailRow.classList.contains('asset-detail-row')) return;
    detailRow.classList.toggle('open');
    row.classList.toggle('expanded');
  },
};
