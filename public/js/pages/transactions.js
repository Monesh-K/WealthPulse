/**
 * WealthPulse — Transactions (Income & Expense) Page
 * Supports categories + subcategories, search, date range, edit, bank accounts
 */
const TransactionsPage = {
  items: [],
  summary: [],
  bankAccounts: [],
  activeFilter: { type: '', category: '', subcategory: '', search: '', dateFrom: '', dateTo: '' },
  pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
  categoryPeriod: 'monthly', // 'weekly', 'monthly', 'yearly', 'custom'
  categoryCustomFrom: '',
  categoryCustomTo: '',

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Income & Expenses</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Track cash flow, categorize transactions, view monthly summaries</p>
        </div>
        <div class="btn-group responsive-btn-group">
          <button class="btn btn-outline btn-sm" onclick="TransactionsPage.getAISpendingInsight()">🤖 AI Insight</button>
          <button class="btn btn-outline btn-sm" onclick="TransactionsPage.openImport()">📥 Import CSV</button>
          <button class="btn btn-success btn-sm" onclick="TransactionsPage.openForm('income')">+ Income</button>
          <button class="btn btn-danger btn-sm" onclick="TransactionsPage.openForm('expense')">+ Expense</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" id="txnStats"></div>

      <!-- Filters -->
      <div class="card" style="padding:12px 16px; margin-bottom:16px">
        <div class="asset-filter-row" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
          <span style="font-weight:600; font-size:0.85rem; color:var(--text-secondary)">Filter:</span>
          <input type="text" class="form-control" id="txnSearchInput" placeholder="Search..." style="width:auto; min-width:140px; padding:6px 10px; font-size:0.85rem" oninput="TransactionsPage.onSearchInput(this.value)">
          <select class="form-control" id="txnFilterType" style="width:auto; min-width:110px; padding:6px 10px; font-size:0.85rem" onchange="TransactionsPage.onFilterChange()">
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select class="form-control" id="txnFilterCategory" style="width:auto; min-width:140px; padding:6px 10px; font-size:0.85rem" onchange="TransactionsPage.onCategoryFilterChange()">
            <option value="">All Categories</option>
          </select>
          <select class="form-control" id="txnFilterSubcategory" style="width:auto; min-width:150px; padding:6px 10px; font-size:0.85rem" onchange="TransactionsPage.onFilterChange()">
            <option value="">All Subcategories</option>
          </select>
          <input type="date" class="form-control" id="txnDateFrom" style="width:auto; padding:6px 10px; font-size:0.85rem" onchange="TransactionsPage.onFilterChange()" title="From date">
          <input type="date" class="form-control" id="txnDateTo" style="width:auto; padding:6px 10px; font-size:0.85rem" onchange="TransactionsPage.onFilterChange()" title="To date">
          <button class="btn btn-outline btn-sm" id="txnClearFilterBtn" style="display:none; padding:6px 12px; font-size:0.8rem" onclick="TransactionsPage.clearFilters()">✕ Clear</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab active" data-tab="list" onclick="TransactionsPage.switchTab('list')">Transactions</button>
        <button class="tab" data-tab="summary" onclick="TransactionsPage.switchTab('summary')">Monthly Summary</button>
        <button class="tab" data-tab="categories" onclick="TransactionsPage.switchTab('categories')">Categories</button>
        <button class="tab" data-tab="subcategories" onclick="TransactionsPage.switchTab('subcategories')">Subcategories</button>
        <button class="tab" data-tab="budget" onclick="TransactionsPage.switchTab('budget')">Budget</button>
        <button class="tab" data-tab="recurring" onclick="TransactionsPage.switchTab('recurring')">Recurring</button>
      </div>

      <div id="txnTabContent">
        <div class="loading"><div class="spinner"></div> Loading...</div>
      </div>
    `;
  },

  async init() {
    await this.loadAll();
  },

  async loadAll() {
    try {
      const params = { page: this.pagination.page, pageSize: this.pagination.pageSize };
      if (this.activeFilter.type) params.type = this.activeFilter.type;
      if (this.activeFilter.category) params.category = this.activeFilter.category;
      if (this.activeFilter.subcategory) params.subcategory = this.activeFilter.subcategory;
      if (this.activeFilter.search) params.search = this.activeFilter.search;
      if (this.activeFilter.dateFrom) params.dateFrom = this.activeFilter.dateFrom;
      if (this.activeFilter.dateTo) params.dateTo = this.activeFilter.dateTo;

      const [txnRes, sumRes, bankRes] = await Promise.all([
        API.getTransactions(params),
        API.getTransactionSummary(12),
        API.getBankAccounts().catch(() => ({ data: [] })),
      ]);
      this.items = txnRes.data || [];
      this.pagination = txnRes.pagination || this.pagination;
      this.summary = sumRes.data || [];
      this.investmentByMonth = sumRes.investmentByMonth || {};
      this.bankAccounts = bankRes.data || [];
      this.renderStats();
      this.populateCategoryFilter();
      this.updateClearButtonVisibility();
      this.switchTab(document.querySelector('.tab.active')?.dataset?.tab || 'list');
    } catch (e) {
      document.getElementById('txnTabContent').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  async populateCategoryFilter() {
    const categories = [...new Set(this.items.map(t => t.category))].sort();
    const catEl = document.getElementById('txnFilterCategory');
    if (!catEl) return;
    const current = catEl.value;
    catEl.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${Utils.esc(c)}" ${c === current ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('');
    await this.populateSubcategoryFilter();
  },

  async populateSubcategoryFilter() {
    const subEl = document.getElementById('txnFilterSubcategory');
    if (!subEl) return;
    const current = subEl.value;
    const params = {};
    if (this.activeFilter.category) params.category = this.activeFilter.category;
    if (this.activeFilter.type) params.type = this.activeFilter.type;
    try {
      const res = await API.getSubcategoryList(params);
      const subs = res.data || [];
      subEl.innerHTML = '<option value="">All Subcategories</option>' +
        subs.map(s => `<option value="${Utils.esc(s)}" ${s === current ? 'selected' : ''}>${Utils.esc(s)}</option>`).join('');
    } catch { subEl.innerHTML = '<option value="">All Subcategories</option>'; }
  },

  onSearchInput: Utils.debounce(function(val) {
    TransactionsPage.activeFilter.search = val;
    TransactionsPage.pagination.page = 1;
    TransactionsPage.updateClearButtonVisibility();
    TransactionsPage.loadAll();
  }, 300),

  onFilterChange() {
    this.activeFilter.type = document.getElementById('txnFilterType')?.value || '';
    this.activeFilter.category = document.getElementById('txnFilterCategory')?.value || '';
    this.activeFilter.subcategory = document.getElementById('txnFilterSubcategory')?.value || '';
    this.activeFilter.dateFrom = document.getElementById('txnDateFrom')?.value || '';
    this.activeFilter.dateTo = document.getElementById('txnDateTo')?.value || '';
    this.pagination.page = 1;
    this.updateClearButtonVisibility();
    this.loadAll();
  },

  onCategoryFilterChange() {
    this.activeFilter.category = document.getElementById('txnFilterCategory')?.value || '';
    this.activeFilter.subcategory = '';
    const subEl = document.getElementById('txnFilterSubcategory');
    if (subEl) subEl.value = '';
    this.populateSubcategoryFilter();
    this.pagination.page = 1;
    this.onFilterChange();
  },

  updateClearButtonVisibility() {
    const btn = document.getElementById('txnClearFilterBtn');
    if (!btn) return;
    const f = this.activeFilter;
    const hasFilter = f.type || f.category || f.subcategory || f.search || f.dateFrom || f.dateTo;
    btn.style.display = hasFilter ? '' : 'none';
  },

  clearFilters() {
    this.activeFilter = { type: '', category: '', subcategory: '', search: '', dateFrom: '', dateTo: '' };
    this.pagination.page = 1;
    ['txnFilterType','txnFilterCategory','txnFilterSubcategory','txnSearchInput','txnDateFrom','txnDateTo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    this.updateClearButtonVisibility();
    this.loadAll();
  },

  renderStats() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const yearKey = `${now.getFullYear()}`;

    // Current month stats
    const monthIncome = this.summary.filter(s => s.month===monthKey && s.type==='income').reduce((s,r) => s+r.total, 0);
    const monthExpense = this.summary.filter(s => s.month===monthKey && s.type==='expense').reduce((s,r) => s+r.total, 0);
    const monthSavings = monthIncome - monthExpense;
    const monthRate = monthIncome > 0 ? (monthSavings/monthIncome*100) : 0;

    // Year-to-date stats
    const yearIncome = this.summary.filter(s => s.month.startsWith(yearKey) && s.type==='income').reduce((s,r) => s+r.total, 0);
    const yearExpense = this.summary.filter(s => s.month.startsWith(yearKey) && s.type==='expense').reduce((s,r) => s+r.total, 0);
    const yearSavings = yearIncome - yearExpense;
    const yearRate = yearIncome > 0 ? (yearSavings/yearIncome*100) : 0;
    const monthsElapsed = now.getMonth() + 1;
    const avgMonthlyExpense = monthsElapsed > 0 ? yearExpense / monthsElapsed : 0;

    document.getElementById('txnStats').innerHTML = `
      <div class="stat-card green">
        <div class="stat-label">This Month Income</div>
        <div class="stat-value">${Utils.currency(monthIncome)}</div>
        <div class="stat-sub">YTD: ${Utils.currency(yearIncome)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">This Month Expenses</div>
        <div class="stat-value">${Utils.currency(monthExpense)}</div>
        <div class="stat-sub">YTD: ${Utils.currency(yearExpense)}</div>
      </div>
      <div class="stat-card ${monthSavings>=0?'green':'red'}">
        <div class="stat-label">Month Savings</div>
        <div class="stat-value ${Utils.gainColor(monthSavings)}">${Utils.currency(monthSavings)}</div>
        <div class="stat-sub">Rate: ${Utils.percent(monthRate)}</div>
      </div>
      <div class="stat-card ${yearSavings>=0?'green':'red'}">
        <div class="stat-label">YTD Savings (${yearKey})</div>
        <div class="stat-value ${Utils.gainColor(yearSavings)}">${Utils.currency(yearSavings)}</div>
        <div class="stat-sub">Rate: ${Utils.percent(yearRate)}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Avg Monthly Expense</div>
        <div class="stat-value">${Utils.currency(avgMonthlyExpense)}</div>
        <div class="stat-sub">${monthsElapsed} months in ${yearKey}</div>
      </div>
    `;
  },

  switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    Charts.destroyAll();
    if (tab === 'list') this.renderList();
    else if (tab === 'summary') this.renderSummary();
    else if (tab === 'categories') this.renderCategories();
    else if (tab === 'subcategories') this.renderSubcategories();
    else if (tab === 'budget') this.renderBudget();
    else if (tab === 'recurring') this.renderRecurring();
  },

  renderList() {
    if (!this.items.length) {
      document.getElementById('txnTabContent').innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">💸</div><h3>No transactions yet</h3><p>Add income and expenses to track cash flow</p></div></div>`;
      return;
    }
    const { page, pageSize, total, totalPages } = this.pagination;
    const startItem = (page-1)*pageSize+1;
    const endItem = Math.min(page*pageSize, total);

    document.getElementById('txnTabContent').innerHTML = `
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="hide-mobile">Subcategory</th><th class="hide-mobile">Bank</th><th>Type</th><th class="text-right">Amount</th><th class="text-center">Actions</th></tr></thead>
            <tbody>
              ${this.items.map(t => `
                <tr>
                  <td class="font-mono text-muted">${Utils.formatDate(t.date)}</td>
                  <td title="${Utils.esc(t.description)}">
                    ${Utils.truncateText(t.description, 30) || '-'}
                    ${t.is_recurring ? '<span class="badge" style="background:var(--blue-bg,#eff6ff);color:var(--blue);font-size:0.65rem;padding:1px 5px;border-radius:8px;margin-left:4px;vertical-align:middle">recurring</span>' : ''}
                  </td>
                  <td><span class="badge badge-other txn-cat-badge" style="cursor:pointer" onclick="TransactionsPage.filterByCategory('${Utils.esc(t.category)}')">${Utils.esc(t.category)}</span></td>
                  <td class="hide-mobile">${t.subcategory ? `<span class="badge txn-subcat-badge" style="cursor:pointer; background:var(--bg-secondary); color:var(--text-primary); font-size:0.75rem" onclick="TransactionsPage.filterBySubcategory('${Utils.esc(t.category)}','${Utils.esc(t.subcategory)}')">${Utils.esc(t.subcategory)}</span>` : '<span class="text-muted" style="font-size:0.8rem">—</span>'}</td>
                  <td class="hide-mobile">${t.bank_name ? `<span class="badge" style="background:var(--blue-bg);color:var(--blue);font-size:0.72rem">🏦 ${Utils.esc(t.bank_name)}</span>` : '<span class="text-muted" style="font-size:0.8rem">—</span>'}</td>
                  <td><span class="badge badge-${t.type}">${t.type}</span></td>
                  <td class="text-right font-mono ${t.type==='income'?'text-green':'text-red'}">${t.type==='income'?'+':'-'}${Utils.currencyFull(t.amount)}</td>
                  <td class="text-center">
                    <div class="btn-group" style="justify-content:center">
                      <button class="btn-icon" onclick="TransactionsPage.openMakeRecurringModal('${t.id}')" title="Make Recurring">🔁</button>
                      <button class="btn-icon" onclick="TransactionsPage.openEditForm('${t.id}')" title="Edit">✏️</button>
                      <button class="btn-icon danger" onclick="TransactionsPage.deleteItem('${t.id}')" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div class="txn-pagination">
          <div class="txn-pagination-info">Showing <strong>${startItem}–${endItem}</strong> of <strong>${total}</strong></div>
          <div class="txn-pagination-controls">
            <button class="btn btn-outline btn-sm" ${page<=1?'disabled':''} onclick="TransactionsPage.goToPage(1)">«</button>
            <button class="btn btn-outline btn-sm" ${page<=1?'disabled':''} onclick="TransactionsPage.goToPage(${page-1})">‹</button>
            ${this.getPaginationButtons(page, totalPages)}
            <button class="btn btn-outline btn-sm" ${page>=totalPages?'disabled':''} onclick="TransactionsPage.goToPage(${page+1})">›</button>
            <button class="btn btn-outline btn-sm" ${page>=totalPages?'disabled':''} onclick="TransactionsPage.goToPage(${totalPages})">»</button>
          </div>
          <div class="txn-pagination-size">
            <select class="form-control" style="width:auto; padding:4px 8px; font-size:0.8rem" onchange="TransactionsPage.changePageSize(Number(this.value))">
              ${[15,30,50,100].map(s=>`<option value="${s}" ${s===pageSize?'selected':''}>${s} / page</option>`).join('')}
            </select>
          </div>
        </div>` : `<div class="txn-pagination"><div class="txn-pagination-info">Showing <strong>${total}</strong> transaction${total!==1?'s':''}</div></div>`}
      </div>
    `;
  },

  getPaginationButtons(current, totalPages) {
    const buttons = [];
    let start = Math.max(1, current-2);
    let end = Math.min(totalPages, current+2);
    if (end-start < 4) { if (start===1) end=Math.min(totalPages,start+4); else start=Math.max(1,end-4); }
    for (let i=start; i<=end; i++) {
      if (i===current) buttons.push(`<button class="btn btn-sm txn-page-active">${i}</button>`);
      else buttons.push(`<button class="btn btn-outline btn-sm" onclick="TransactionsPage.goToPage(${i})">${i}</button>`);
    }
    return buttons.join('');
  },

  goToPage(page) { this.pagination.page=Math.max(1,Math.min(page,this.pagination.totalPages)); this.loadAll(); },
  changePageSize(size) { this.pagination.pageSize=size; this.pagination.page=1; this.loadAll(); },

  filterByCategory(cat) {
    this.activeFilter.category = cat; this.activeFilter.subcategory = '';
    const catEl=document.getElementById('txnFilterCategory'); const subEl=document.getElementById('txnFilterSubcategory');
    if(catEl) catEl.value=cat; if(subEl) subEl.value='';
    this.onFilterChange();
  },

  filterBySubcategory(cat, sub) {
    this.activeFilter.category=cat; this.activeFilter.subcategory=sub;
    const catEl=document.getElementById('txnFilterCategory'); const subEl=document.getElementById('txnFilterSubcategory');
    if(catEl) catEl.value=cat;
    this.populateSubcategoryFilter().then(()=>{ if(subEl) subEl.value=sub; });
    this.loadAll();
  },

  renderSummary() {
    const months = {};
    this.summary.forEach(s => { if(!months[s.month]) months[s.month]={income:0,expense:0}; months[s.month][s.type]=s.total; });
    const labels = Object.keys(months).sort();
    const incomeData = labels.map(m=>months[m].income||0);
    const expenseData = labels.map(m=>months[m].expense||0);

    document.getElementById('txnTabContent').innerHTML = `
      <div class="card"><div class="card-header"><div class="card-title">Monthly Income vs Expenses</div></div><div class="chart-container" style="height:300px"><canvas id="txnBarChart"></canvas></div></div>
      <div class="card mt-16"><div class="table-wrapper"><table>
        <thead><tr><th>Month</th><th class="text-right">Income</th><th class="text-right">Expenses</th><th class="text-right">Savings</th><th class="text-right">Rate</th></tr></thead>
        <tbody>${labels.slice().reverse().map(m=>{const inc=months[m].income||0;const exp=months[m].expense||0;const sav=inc-exp;const rate=inc>0?(sav/inc*100):0;return`<tr><td class="font-mono">${Utils.formatMonth(m)}</td><td class="text-right font-mono text-green">${Utils.currencyFull(inc)}</td><td class="text-right font-mono text-red">${Utils.currencyFull(exp)}</td><td class="text-right font-mono ${Utils.gainColor(sav)}">${Utils.currencyFull(sav)}</td><td class="text-right font-mono ${Utils.gainColor(rate)}">${Utils.percent(rate)}</td></tr>`;}).join('')}</tbody>
      </table></div></div>
    `;
    Charts.destroyAll();
    requestAnimationFrame(async () => {
      await Charts.bar('txnBarChart', labels.map(m=>Utils.formatMonth(m)), [{label:'Income',data:incomeData,color:'#10b981'},{label:'Expenses',data:expenseData,color:'#ef4444'}]);
    });
  },

  // ─── PERIOD HELPERS (Money Manager style) ──────
  _getCategoryDateRange() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    switch (this.categoryPeriod) {
      case 'weekly': {
        const day = now.getDay(); // 0=Sun
        const start = new Date(now); start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); // Monday
        const end = new Date(start); end.setDate(start.getDate() + 6); // Sunday
        return { dateFrom: fmt(start), dateTo: fmt(end) };
      }
      case 'monthly': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { dateFrom: fmt(start), dateTo: fmt(end) };
      }
      case 'yearly': {
        return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: `${now.getFullYear()}-12-31` };
      }
      case 'custom': {
        return { dateFrom: this.categoryCustomFrom || '', dateTo: this.categoryCustomTo || '' };
      }
      default:
        return {};
    }
  },

  _getPeriodLabel() {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    switch (this.categoryPeriod) {
      case 'weekly': {
        const range = this._getCategoryDateRange();
        return `${Utils.formatDate(range.dateFrom)} – ${Utils.formatDate(range.dateTo)}`;
      }
      case 'monthly': return `${months[now.getMonth()]} ${now.getFullYear()}`;
      case 'yearly': return `${now.getFullYear()}`;
      case 'custom': {
        const f = this.categoryCustomFrom ? Utils.formatDate(this.categoryCustomFrom) : '...';
        const t = this.categoryCustomTo ? Utils.formatDate(this.categoryCustomTo) : '...';
        return `${f} – ${t}`;
      }
      default: return 'All Time';
    }
  },

  _canNavigatePeriod() {
    return ['weekly', 'monthly', 'yearly'].includes(this.categoryPeriod);
  },

  _navigatePeriod(dir) {
    // dir: -1 for prev, +1 for next
    const range = this._getEffectiveDateRange();
    const from = new Date(range.dateFrom + 'T00:00:00');

    if (this.categoryPeriod === 'weekly') {
      from.setDate(from.getDate() + dir * 7);
    } else if (this.categoryPeriod === 'monthly') {
      from.setMonth(from.getMonth() + dir);
    } else if (this.categoryPeriod === 'yearly') {
      from.setFullYear(from.getFullYear() + dir);
    }

    // Temporarily set "custom" dates so _getCategoryDateRange uses them, then restore period
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Compute the new end
    let end;
    if (this.categoryPeriod === 'weekly') {
      end = new Date(from); end.setDate(from.getDate() + 6);
    } else if (this.categoryPeriod === 'monthly') {
      // Ensure from is 1st of month
      from.setDate(1);
      end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    } else if (this.categoryPeriod === 'yearly') {
      from.setMonth(0, 1); // Jan 1
      end = new Date(from.getFullYear(), 11, 31);
    }

    // Override: we use a "pinned" date for the navigation
    this._pinnedFrom = fmt(from);
    this._pinnedTo = fmt(end);

    const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
    if (activeTab === 'categories') this.renderCategories();
    else if (activeTab === 'subcategories') this.renderSubcategories();
  },

  _getEffectiveDateRange() {
    if (this._pinnedFrom) {
      const r = { dateFrom: this._pinnedFrom, dateTo: this._pinnedTo };
      return r;
    }
    return this._getCategoryDateRange();
  },

  _getEffectivePeriodLabel() {
    if (this._pinnedFrom) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const from = new Date(this._pinnedFrom);
      if (this.categoryPeriod === 'monthly') return `${months[from.getMonth()]} ${from.getFullYear()}`;
      if (this.categoryPeriod === 'yearly') return `${from.getFullYear()}`;
      if (this.categoryPeriod === 'weekly') return `${Utils.formatDate(this._pinnedFrom)} – ${Utils.formatDate(this._pinnedTo)}`;
    }
    return this._getPeriodLabel();
  },

  onCategoryPeriodChange(period) {
    this.categoryPeriod = period;
    this._pinnedFrom = null;
    this._pinnedTo = null;
    // Show/hide custom date inputs
    const customRow = document.getElementById('categoryCustomDates');
    if (customRow) customRow.style.display = period === 'custom' ? 'flex' : 'none';
    const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
    if (activeTab === 'categories') this.renderCategories();
    else if (activeTab === 'subcategories') this.renderSubcategories();
  },

  onCategoryCustomDateChange() {
    this.categoryCustomFrom = document.getElementById('catDateFrom')?.value || '';
    this.categoryCustomTo = document.getElementById('catDateTo')?.value || '';
    this._pinnedFrom = null;
    this._pinnedTo = null;
    const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
    if (activeTab === 'categories') this.renderCategories();
    else if (activeTab === 'subcategories') this.renderSubcategories();
  },

  _renderPeriodSelector() {
    const p = this.categoryPeriod;
    const canNav = this._canNavigatePeriod();
    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <div class="btn-group" style="gap:0">
            ${['weekly', 'monthly', 'yearly', 'custom'].map(period => `
              <button class="btn btn-sm ${p === period ? 'btn-primary' : 'btn-outline'}" style="border-radius:${period === 'weekly' ? '6px 0 0 6px' : period === 'custom' ? '0 6px 6px 0' : '0'};min-width:72px" onclick="TransactionsPage.onCategoryPeriodChange('${period}')">${period.charAt(0).toUpperCase() + period.slice(1)}</button>
            `).join('')}
          </div>
          ${canNav ? `
            <div style="display:flex;align-items:center;gap:6px;margin-left:8px">
              <button class="btn btn-outline btn-sm" onclick="TransactionsPage._navigatePeriod(-1)" style="padding:4px 10px">‹</button>
              <span style="font-weight:600;font-size:0.9rem;min-width:130px;text-align:center">${this._getEffectivePeriodLabel()}</span>
              <button class="btn btn-outline btn-sm" onclick="TransactionsPage._navigatePeriod(1)" style="padding:4px 10px">›</button>
            </div>
          ` : `<span style="font-weight:600;font-size:0.9rem;margin-left:8px">${this._getEffectivePeriodLabel()}</span>`}
        </div>
        <div id="categoryCustomDates" style="display:${p === 'custom' ? 'flex' : 'none'};gap:10px;align-items:center;flex-wrap:wrap">
          <input type="date" class="form-control" id="catDateFrom" value="${this.categoryCustomFrom}" style="width:auto;padding:6px 10px;font-size:0.85rem" onchange="TransactionsPage.onCategoryCustomDateChange()" title="From">
          <span class="text-muted">to</span>
          <input type="date" class="form-control" id="catDateTo" value="${this.categoryCustomTo}" style="width:auto;padding:6px 10px;font-size:0.85rem" onchange="TransactionsPage.onCategoryCustomDateChange()" title="To">
        </div>
      </div>
    `;
  },

  async renderCategories() {
    const container = document.getElementById('txnTabContent');
    const range = this._getEffectiveDateRange();
    const periodLabel = this._getEffectivePeriodLabel();

    try {
      const incParams = { type: 'income', ...range };
      const expParams = { type: 'expense', ...range };
      const [incRes, expRes] = await Promise.all([
        API.getTransactionCategories(incParams),
        API.getTransactionCategories(expParams),
      ]);
      const incData = incRes.data || [];
      const expData = expRes.data || [];
      const incTotal = incData.reduce((s, c) => s + c.total, 0);
      const expTotal = expData.reduce((s, c) => s + c.total, 0);
      const investmentTotal = expData.filter(c => c.category === 'Investment').reduce((s, c) => s + c.total, 0);
      const trueExpTotal = expTotal - investmentTotal;
      const netSavings = incTotal - trueExpTotal;
      const savingsRatePct = incTotal > 0 ? ((netSavings / incTotal) * 100).toFixed(1) : '0.0';

      container.innerHTML = `
        ${this._renderPeriodSelector()}

        <!-- Period Summary Bar -->
        <div class="card" style="padding:16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
              <div>
                <span class="text-muted" style="font-size:0.78rem">Income</span>
                <div class="font-mono text-green" style="font-size:1.1rem;font-weight:600">${Utils.currency(incTotal)}</div>
              </div>
              <div style="font-size:1.2rem;color:var(--text-muted)">−</div>
              <div>
                <span class="text-muted" style="font-size:0.78rem">Expense (excl. invest.)</span>
                <div class="font-mono text-red" style="font-size:1.1rem;font-weight:600">${Utils.currency(trueExpTotal)}</div>
              </div>
              <div style="font-size:1.2rem;color:var(--text-muted)">=</div>
              <div>
                <span class="text-muted" style="font-size:0.78rem">Savings + Investments</span>
                <div class="font-mono ${Utils.gainColor(netSavings)}" style="font-size:1.1rem;font-weight:700">${Utils.currency(netSavings)}</div>
              </div>
            </div>
            ${incTotal > 0 ? `<div><span class="text-muted" style="font-size:0.78rem">Savings Rate</span><div class="font-mono" style="font-weight:600;font-size:1rem;color:${netSavings >= 0 ? 'var(--green)' : 'var(--red)'}">${savingsRatePct}%</div>${investmentTotal > 0 ? `<div class="text-muted" style="font-size:0.72rem">Includes ${Utils.currency(investmentTotal)} invested</div>` : ''}</div>` : ''}
          </div>
          ${incTotal > 0 || expTotal > 0 ? `
          <div style="margin-top:12px;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;display:flex">
            <div style="width:${incTotal / (incTotal + expTotal) * 100}%;background:#10b981;border-radius:4px 0 0 4px"></div>
            <div style="width:${expTotal / (incTotal + expTotal) * 100}%;background:#ef4444;border-radius:0 4px 4px 0"></div>
          </div>` : ''}
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <div class="card-title" style="display:flex;align-items:center;gap:6px">💰 Income by Category</div>
              <span class="font-mono text-green" style="font-size:0.85rem;font-weight:600">${Utils.currency(incTotal)}</span>
            </div>
            ${incData.length ? `
              <div class="chart-container" style="height:220px"><canvas id="incomeCatChart"></canvas></div>
              <div style="padding:8px 16px 16px">
                ${incData.map((c, i) => {
                  const pct = incTotal > 0 ? (c.total / incTotal * 100) : 0;
                  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#ef4444'];
                  const color = colors[i % colors.length];
                  return `
                  <div style="margin-bottom:10px;cursor:pointer" onclick="TransactionsPage.drillDownCategory('income','${Utils.esc(c.category)}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;margin-bottom:3px">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
                        <strong>${Utils.esc(c.category)}</strong>
                      </div>
                      <div style="display:flex;gap:12px;align-items:center">
                        <span class="font-mono text-green">${Utils.currencyFull(c.total)}</span>
                        <span class="text-muted" style="min-width:42px;text-align:right">${pct.toFixed(1)}%</span>
                        <span class="text-muted" style="font-size:0.78rem;min-width:28px;text-align:right">${c.count}x</span>
                        <span class="text-muted">→</span>
                      </div>
                    </div>
                    <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .4s ease"></div>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            ` : '<div class="empty-state" style="padding:32px"><div class="empty-icon">💰</div><p>No income in this period</p></div>'}
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title" style="display:flex;align-items:center;gap:6px">💸 Expense by Category</div>
              <span class="font-mono text-red" style="font-size:0.85rem;font-weight:600">${Utils.currency(expTotal)}</span>
            </div>
            ${expData.length ? `
              <div class="chart-container" style="height:220px"><canvas id="expenseCatChart"></canvas></div>
              <div style="padding:8px 16px 16px">
                ${expData.map((c, i) => {
                  const pct = expTotal > 0 ? (c.total / expTotal * 100) : 0;
                  const colors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#6366f1', '#10b981', '#64748b'];
                  const color = colors[i % colors.length];
                  return `
                  <div style="margin-bottom:10px;cursor:pointer" onclick="TransactionsPage.drillDownCategory('expense','${Utils.esc(c.category)}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;margin-bottom:3px">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
                        <strong>${Utils.esc(c.category)}</strong>
                      </div>
                      <div style="display:flex;gap:12px;align-items:center">
                        <span class="font-mono text-red">${Utils.currencyFull(c.total)}</span>
                        <span class="text-muted" style="min-width:42px;text-align:right">${pct.toFixed(1)}%</span>
                        <span class="text-muted" style="font-size:0.78rem;min-width:28px;text-align:right">${c.count}x</span>
                        <span class="text-muted">→</span>
                      </div>
                    </div>
                    <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .4s ease"></div>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            ` : '<div class="empty-state" style="padding:32px"><div class="empty-icon">💸</div><p>No expenses in this period</p></div>'}
          </div>
        </div>
        <div id="categoryDrillDown"></div>
      `;
      requestAnimationFrame(async () => {
        if (incData.length) await Charts.doughnut('incomeCatChart', incData.map(c => c.category), incData.map(c => c.total));
        if (expData.length) await Charts.doughnut('expenseCatChart', expData.map(c => c.category), expData.map(c => c.total));
      });
    } catch (e) {
      container.innerHTML = `${this._renderPeriodSelector()}<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  async drillDownCategory(type, category) {
    const drillEl = document.getElementById('categoryDrillDown'); if (!drillEl) return;
    drillEl.innerHTML = '<div class="loading" style="padding:24px"><div class="spinner"></div> Loading...</div>';
    try {
      const range = this._getEffectiveDateRange();
      const res = await API.getTransactionCategories({ type, category, ...range });
      const data = (res.data || []).filter(d => d.subcategory);
      if (!data.length) { drillEl.innerHTML = `<div class="card mt-16"><div class="empty-state" style="padding:24px"><p>No subcategory data for ${Utils.esc(category)}</p></div></div>`; return; }
      const total = data.reduce((s, d) => s + d.total, 0);
      drillEl.innerHTML = `<div class="card mt-16"><div class="card-header"><div class="card-title">${Utils.esc(category)} — Subcategory Breakdown</div><span class="text-muted" style="font-size:0.85rem">${Utils.currencyFull(total)} total</span></div><div class="grid-2" style="padding:16px;gap:16px"><div class="chart-container" style="height:220px"><canvas id="drillDownChart"></canvas></div><div><table style="width:100%;font-size:0.85rem"><thead><tr><th>Subcategory</th><th class="text-right">Amount</th><th class="text-right">%</th><th class="text-right">Count</th></tr></thead><tbody>${data.map(d => `<tr><td>${Utils.esc(d.subcategory || '(none)')}</td><td class="text-right font-mono">${Utils.currencyFull(d.total)}</td><td class="text-right font-mono text-muted">${(d.total / total * 100).toFixed(1)}%</td><td class="text-right text-muted">${d.count}</td></tr>`).join('')}</tbody></table></div></div></div>`;
      requestAnimationFrame(async () => {
        await Charts.doughnut('drillDownChart', data.map(d => d.subcategory || '(none)'), data.map(d => d.total));
      });
    } catch (e) { drillEl.innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`; }
  },

  async renderSubcategories() {
    const container = document.getElementById('txnTabContent');
    const range = this._getEffectiveDateRange();
    try {
      const [incRes, expRes] = await Promise.all([
        API.getTransactionSubcategories({ type: 'income', ...range }),
        API.getTransactionSubcategories({ type: 'expense', ...range }),
      ]);
      const incData = incRes.data || []; const expData = expRes.data || [];
      const groupBy = (data) => { const g = {}; data.forEach(d => { if (!g[d.category]) g[d.category] = []; g[d.category].push(d); }); return g; };
      const incGroups = groupBy(incData); const expGroups = groupBy(expData);
      const renderGroup = (groups, cls) => Object.keys(groups).map(cat => { const items = groups[cat]; const catTotal = items.reduce((s, i) => s + i.total, 0); return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)"><strong>${Utils.esc(cat)}</strong><span class="font-mono ${cls}" style="font-size:0.85rem">${Utils.currencyFull(catTotal)}</span></div>${items.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0 6px 20px;font-size:0.85rem"><span style="color:var(--text-secondary)">${Utils.esc(i.subcategory)}</span><div style="display:flex;gap:16px;align-items:center"><span class="font-mono">${Utils.currencyFull(i.total)}</span><span class="text-muted" style="font-size:0.8rem;width:40px;text-align:right">${i.count}x</span><div style="width:60px;height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden"><div style="width:${Math.round(i.total / catTotal * 100)}%;height:100%;background:${cls === 'text-green' ? '#10b981' : '#ef4444'};border-radius:3px"></div></div></div></div>`).join('')}</div>`; }).join('');
      container.innerHTML = `
        ${this._renderPeriodSelector()}
        <div class="grid-2">
          <div class="card"><div class="card-header"><div class="card-title">Income Subcategories</div></div><div style="padding:0 16px 16px">${incData.length ? renderGroup(incGroups, 'text-green') : '<div class="empty-state"><p>No data</p></div>'}</div></div>
          <div class="card"><div class="card-header"><div class="card-title">Expense Subcategories</div></div><div style="padding:0 16px 16px">${expData.length ? renderGroup(expGroups, 'text-red') : '<div class="empty-state"><p>No data</p></div>'}</div></div>
        </div>
      `;
    } catch (e) { container.innerHTML = `${this._renderPeriodSelector()}<div class="empty-state"><p>Error</p></div>`; }
  },

  // ─── BANK ACCOUNTS TAB ────────────────────────
  async renderBankAccounts() {
    const content = document.getElementById('txnTabContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div> Loading bank accounts...</div>';
    try {
      const res = await API.getBankAccounts();
      this.bankAccounts = res.data || [];
      const totalBalance = this.bankAccounts.reduce((s,b) => s+(b.balance||0), 0);
      if (!this.bankAccounts.length) {
        content.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">🏦</div><h3>No bank accounts</h3><p>Add your bank accounts to track balances</p><button class="btn btn-primary btn-sm" onclick="TransactionsPage.openBankForm()">+ Add Bank Account</button></div></div>`;
        return;
      }
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div><span class="text-muted" style="font-size:0.85rem">Total Balance:</span><strong style="font-size:1.1rem;margin-left:8px">${Utils.currency(totalBalance)}</strong></div>
          <button class="btn btn-primary btn-sm" onclick="TransactionsPage.openBankForm()">+ Add Bank Account</button>
        </div>
        <div class="grid-3">
          ${this.bankAccounts.map(b => `
            <div class="card" style="padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div><strong style="font-size:0.95rem">${Utils.esc(b.bank_name)}</strong><p class="text-muted" style="font-size:0.8rem;margin-top:2px">${Utils.esc(b.account_type||'Savings')} · ${b.account_number?'****'+b.account_number.slice(-4):''}</p></div>
                <div class="btn-group"><button class="btn-icon" onclick="TransactionsPage.openBankForm('${b.id}')" title="Edit">✏️</button><button class="btn-icon danger" onclick="TransactionsPage.deleteBankAccount('${b.id}')" title="Delete">🗑️</button></div>
              </div>
              <div class="stat-value" style="font-size:1.2rem">${Utils.currency(b.balance||0)}</div>
              ${b.notes?`<p class="text-muted" style="font-size:0.8rem;margin-top:8px">${Utils.esc(b.notes)}</p>`:''}
            </div>
          `).join('')}
        </div>
      `;
    } catch(e) { content.innerHTML=`<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`; }
  },

  openBankForm(id) {
    const b = id ? this.bankAccounts.find(x=>x.id===id) : {};
    const isEdit = !!id;
    Modal.open(isEdit?'Edit Bank Account':'Add Bank Account', `
      <form onsubmit="TransactionsPage.saveBankAccount(event,'${id||''}')">
        <div class="form-row"><div class="form-group"><label>Bank Name *</label><input class="form-control" name="bank_name" value="${Utils.esc(b.bank_name||'')}" required></div><div class="form-group"><label>Account Type</label><select class="form-control" name="account_type">${['Savings','Current','Salary','FD','RD','NRE','NRO'].map(t=>`<option value="${t}" ${b.account_type===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
        <div class="form-row"><div class="form-group"><label>Account Number</label><input class="form-control" name="account_number" value="${Utils.esc(b.account_number||'')}"></div><div class="form-group"><label>Balance</label><input class="form-control" type="number" step="0.01" name="balance" value="${b.balance||0}"></div></div>
        <div class="form-group"><label>Notes</label><input class="form-control" name="notes" value="${Utils.esc(b.notes||'')}"></div>
        <div class="modal-actions"><button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button><button type="submit" class="btn btn-primary">${isEdit?'Update':'Add'}</button></div>
      </form>
    `);
  },

  async saveBankAccount(e, id) {
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.target)); data.balance=Number(data.balance);
    try { if(id){await API.updateBankAccount(id,data);Toast.success('Updated!');}else{await API.createBankAccount(data);Toast.success('Added!');} Modal.close(); this.renderBankAccounts(); }
    catch(e) { Toast.error(e.message); }
  },

  async deleteBankAccount(id) {
    if(!await Modal.confirm('Delete Bank Account','Delete this bank account?'))return;
    try{await API.deleteBankAccount(id);Toast.success('Deleted');this.renderBankAccounts();}catch(e){Toast.error(e.message);}
  },

  // ─── FORMS ────────────────────────────────────
  openForm(type = 'expense') {
    const incomeCategories=['Salary','Freelance','Investments','Business','Gift','Rental','Other'];
    const expenseCategories=['Food','Transport','Shopping','Bills','Health','Entertainment','Education','Rent','EMI','Insurance','Investment','Other'];
    const cats = type==='income' ? incomeCategories : expenseCategories;
    // Merge in any custom categories from existing transactions
    const existingCats = [...new Set(this.items.filter(t => t.type === type).map(t => t.category))];
    existingCats.forEach(c => { if (c && !cats.includes(c)) cats.push(c); });

    Modal.open(`Add ${type==='income'?'Income':'Expense'}`, `
      <form onsubmit="TransactionsPage.save(event)">
        <input type="hidden" name="type" value="${type}">
        <div class="form-row"><div class="form-group"><label>Amount *</label><input class="form-control" type="number" step="0.01" name="amount" required></div><div class="form-group"><label>Date</label><input class="form-control" type="date" name="date" value="${new Date().toISOString().split('T')[0]}"></div></div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <div class="autocomplete-wrapper">
              <select class="form-control" name="category" id="txnFormCategory" onchange="TransactionsPage.onFormCategoryChange('${type}')">
                ${cats.map(c=>`<option>${c}</option>`).join('')}
                <option value="__new__">+ Add New Category</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label>Subcategory</label>
            <div style="position:relative">
              <input class="form-control" name="subcategory" id="txnFormSubcategory" list="txnSubcategoryList" placeholder="Type or select" autocomplete="off">
              <datalist id="txnSubcategoryList"></datalist>
            </div>
          </div>
        </div>
        <div class="form-group"><label>Description</label><input class="form-control" name="description" placeholder="Optional note"></div>
        <div class="form-group"><label>Bank Account</label>
          <select class="form-control" name="bank_account" id="txnFormBank">
            <option value="">None</option>
            ${this.bankAccounts.map(b => `<option value="${b.id}">${Utils.esc(b.bank_name)} (${Utils.esc(b.account_type||'Savings')})</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button><button type="submit" class="btn ${type==='income'?'btn-success':'btn-danger'}">Add ${type==='income'?'Income':'Expense'}</button></div>
      </form>
    `);
    this.onFormCategoryChange(type);
    this.loadBankAccountsForForm();
  },

  openEditForm(id) {
    const t = this.items.find(x=>x.id===id);
    if (!t) return;
    const type = t.type;
    const incomeCategories=['Salary','Freelance','Investments','Business','Gift','Rental','Other'];
    const expenseCategories=['Food','Transport','Shopping','Bills','Health','Entertainment','Education','Rent','EMI','Insurance','Investment','Other'];
    const cats = type==='income' ? incomeCategories : expenseCategories;
    if (!cats.includes(t.category) && t.category) cats.push(t.category);
    const existingCats = [...new Set(this.items.filter(x => x.type === type).map(x => x.category))];
    existingCats.forEach(c => { if (c && !cats.includes(c)) cats.push(c); });

    Modal.open(`Edit ${type==='income'?'Income':'Expense'}`, `
      <form onsubmit="TransactionsPage.saveEdit(event,'${id}')">
        <input type="hidden" name="type" value="${type}">
        <div class="form-row"><div class="form-group"><label>Amount *</label><input class="form-control" type="number" step="0.01" name="amount" value="${t.amount}" required></div><div class="form-group"><label>Date</label><input class="form-control" type="date" name="date" value="${t.date?t.date.split('T')[0]:''}"></div></div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <div class="autocomplete-wrapper">
              <select class="form-control" name="category" id="txnFormCategory" onchange="TransactionsPage.onFormCategoryChange('${type}')">
                ${cats.map(c=>`<option ${c===t.category?'selected':''}>${c}</option>`).join('')}
                <option value="__new__">+ Add New Category</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label>Subcategory</label>
            <div style="position:relative">
              <input class="form-control" name="subcategory" id="txnFormSubcategory" list="txnSubcategoryList" value="${Utils.esc(t.subcategory||'')}" placeholder="Type or select" autocomplete="off">
              <datalist id="txnSubcategoryList"></datalist>
            </div>
          </div>
        </div>
        <div class="form-group"><label>Description</label><input class="form-control" name="description" value="${Utils.esc(t.description||'')}" placeholder="Optional note"></div>
        <div class="form-group"><label>Bank Account</label>
          <select class="form-control" name="bank_account" id="txnFormBank">
            <option value="">None</option>
            ${this.bankAccounts.map(b => `<option value="${b.id}" ${t.bank_account===b.id?'selected':''}>${Utils.esc(b.bank_name)} (${Utils.esc(b.account_type||'Savings')})</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button><button type="submit" class="btn btn-primary">Update</button></div>
      </form>
    `);
    this.onFormCategoryChange(type);
    this.loadBankAccountsForForm();
  },

  async loadBankAccountsForForm() {
    if (this.bankAccounts.length > 0) return;
    try {
      const res = await API.getBankAccounts();
      this.bankAccounts = res.data || [];
      const sel = document.getElementById('txnFormBank');
      if (sel && this.bankAccounts.length) {
        const current = sel.value;
        sel.innerHTML = '<option value="">None</option>' +
          this.bankAccounts.map(b => `<option value="${b.id}" ${b.id === current ? 'selected' : ''}>${Utils.esc(b.bank_name)} (${Utils.esc(b.account_type||'Savings')})</option>`).join('');
      }
    } catch { /* ignore */ }
  },

  async onFormCategoryChange(type) {
    const catEl=document.getElementById('txnFormCategory'); const listEl=document.getElementById('txnSubcategoryList');
    if(!catEl||!listEl) return;

    // Handle "Add New Category"
    if (catEl.value === '__new__') {
      const name = prompt('Enter new category name:');
      if (name && name.trim()) {
        const opt = document.createElement('option');
        opt.value = name.trim();
        opt.textContent = name.trim();
        opt.selected = true;
        catEl.insertBefore(opt, catEl.querySelector('option[value="__new__"]'));
      } else {
        catEl.value = catEl.options[0].value;
      }
    }

    try { const res=await API.getSubcategoryList({category:catEl.value,type}); listEl.innerHTML=(res.data||[]).map(s=>`<option value="${Utils.esc(s)}">`).join(''); }
    catch { listEl.innerHTML=''; }
  },

  async save(e) {
    e.preventDefault();
    const form=Object.fromEntries(new FormData(e.target)); form.amount=Number(form.amount);
    try { await API.createTransaction(form); Toast.success('Transaction added!'); Modal.close(); await this.loadAll(); }
    catch(e) { Toast.error(e.message); }
  },

  async saveEdit(e, id) {
    e.preventDefault();
    const form=Object.fromEntries(new FormData(e.target)); form.amount=Number(form.amount);
    try { await API.updateTransaction(id, form); Toast.success('Transaction updated!'); Modal.close(); await this.loadAll(); }
    catch(e) { Toast.error(e.message); }
  },

  async deleteItem(id) {
    if(!await Modal.confirm('Delete Transaction','Delete this transaction?'))return;
    try{await API.deleteTransaction(id);Toast.success('Deleted');await this.loadAll();}catch(e){Toast.error(e.message);}
  },

  openImport() {
    Modal.open('Import Transactions from CSV/Excel', `
      <div style="margin-bottom:16px; color:var(--text-secondary); font-size:0.9rem"><p style="margin-bottom:8px"><strong>Supported formats:</strong></p><ul style="margin:0;padding-left:20px;line-height:1.6"><li><strong>Money Manager</strong> — auto-detected</li><li><strong>Generic CSV</strong> — columns: type, amount, description, category, subcategory, date</li></ul></div>
      <div class="file-upload-zone" onclick="document.getElementById('txnFileInput').click()"><div style="font-size:32px;margin-bottom:8px">📁</div><p>Click to select or drag & drop</p><p class="text-muted" style="font-size:0.8rem">CSV, XLS, XLSX</p></div>
      <input type="file" id="txnFileInput" accept=".csv,.xls,.xlsx" style="display:none" onchange="TransactionsPage.handleImport(this.files[0])">
      <div id="txnImportStatus" style="margin-top:16px"></div>
    `);
  },

  async handleImport(file) {
    if(!file)return;
    const statusEl=document.getElementById('txnImportStatus');
    statusEl.innerHTML='<div class="loading"><div class="spinner"></div> Importing...</div>';
    try {
      const res=await API.importAutoDetect(file);
      if(res.importType!=='transactions'){statusEl.innerHTML=`<div style="padding:16px;background:var(--blue-bg,#eff6ff);border-radius:8px;color:var(--blue,#3b82f6)">ℹ️ Detected as <strong>${Utils.esc(res.format)}</strong>. Imported <strong>${res.imported||0}</strong> assets.</div>`;return;}
      let details=`✅ Imported <strong>${res.imported}</strong> from <strong>${res.total}</strong> rows`;
      if(res.skipped>0) details+=`<br>⏭️ Skipped ${res.skipped}`;
      statusEl.innerHTML=`<div style="padding:16px;background:var(--green-bg);border-radius:8px;color:var(--green)">${details}</div>`;
      await this.loadAll();
    } catch(e) { statusEl.innerHTML=`<div style="padding:16px;background:var(--red-bg);border-radius:8px;color:var(--red)">❌ ${Utils.esc(e.message)}</div>`; }
  },

  async getAISpendingInsight() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthIncome = this.summary.filter(s => s.month===monthKey && s.type==='income').reduce((s,r) => s+r.total, 0);
    const monthExpense = this.summary.filter(s => s.month===monthKey && s.type==='expense').reduce((s,r) => s+r.total, 0);
    const savings = monthIncome - monthExpense;
    const savingsRate = monthIncome > 0 ? (savings/monthIncome*100) : 0;

    // Build category breakdown from current items
    const catTotals = {};
    this.items.forEach(t => {
      if (!catTotals[t.category]) catTotals[t.category] = { total: 0, count: 0, type: t.type };
      catTotals[t.category].total += t.amount;
      catTotals[t.category].count++;
    });
    const categories = Object.entries(catTotals).map(([category, data]) => ({
      category, total: data.total, count: data.count, type: data.type,
    }));

    const data = {
      monthlyIncome: monthIncome,
      monthlyExpenses: monthExpense,
      savingsRate,
      categories,
    };

    Modal.open('🤖 AI Spending Analysis', `
      <div id="aiSpendingInsight">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing spending patterns...
        </div>
      </div>
    `);

    try {
      const result = await API.getAIInsight('spending', data);
      const container = document.getElementById('aiSpendingInsight');
      if (container) {
        if (result.success && result.insight) {
          container.innerHTML = this._renderMarkdown(result.insight);
        } else {
          container.innerHTML = `<p class="text-muted">${result.error || 'Could not generate insight'}</p>`;
        }
      }
    } catch (err) {
      const container = document.getElementById('aiSpendingInsight');
      if (container) container.innerHTML = `<p class="text-muted">AI unavailable: ${err.message}</p>`;
    }
  },

  // ─── BUDGET TAB ─────────────────────────────────
  async renderBudget() {
    const container = document.getElementById('txnTabContent');
    container.innerHTML = '<div class="loading"><div class="spinner"></div> Loading budgets...</div>';

    try {
      const [budgetRes, statusRes] = await Promise.all([
        API.getBudgets().catch(() => ({ data: [] })),
        API.getBudgetStatus().catch(() => ({ data: [] })),
      ]);

      const budgets = budgetRes.data || [];
      const statuses = statusRes.data || [];

      // Merge budget limits with actual spending status
      const budgetMap = {};
      budgets.forEach(b => { budgetMap[b.category] = b; });
      statuses.forEach(s => {
        if (!budgetMap[s.category]) budgetMap[s.category] = { category: s.category, limit: 0 };
        budgetMap[s.category].spent = s.spent || 0;
      });

      const allBudgets = Object.values(budgetMap);

      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Monthly Budgets</div>
            <button class="btn btn-primary btn-sm" onclick="TransactionsPage.openSetBudgetModal()">+ Set Budget</button>
          </div>
          ${allBudgets.length ? `
            <div style="padding:16px">
              ${allBudgets.map(b => {
                const limit = b.limit || 0;
                const spent = b.spent || 0;
                const pct = limit > 0 ? (spent / limit * 100) : (spent > 0 ? 100 : 0);
                const colorClass = pct > 100 ? 'red' : pct >= 75 ? 'yellow' : 'green';
                const barColor = pct > 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#10b981';
                return `
                  <div style="margin-bottom:16px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                      <div style="display:flex;align-items:center;gap:8px">
                        <strong style="font-size:0.9rem">${Utils.esc(b.category)}</strong>
                        ${pct > 100 ? '<span class="badge" style="background:var(--red-bg,#fef2f2);color:var(--red);font-size:0.65rem;padding:1px 6px;border-radius:8px">Over Budget</span>' : ''}
                      </div>
                      <div style="display:flex;align-items:center;gap:12px;font-size:0.85rem">
                        <span class="font-mono ${pct > 100 ? 'text-red' : ''}">${Utils.currency(spent)}</span>
                        ${limit > 0 ? `<span class="text-muted">/ ${Utils.currency(limit)}</span>` : '<span class="text-muted">No limit</span>'}
                        <button class="btn btn-outline btn-xs" onclick="TransactionsPage.openSetBudgetModal('${Utils.esc(b.category)}', ${limit})" style="padding:2px 8px;font-size:0.75rem">Edit</button>
                        ${b.id ? `<button class="btn-icon danger" onclick="TransactionsPage.deleteBudgetItem('${b.id}')" title="Delete" style="font-size:0.75rem">🗑️</button>` : ''}
                      </div>
                    </div>
                    <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                      <div style="width:${Math.min(pct, 100)}%;height:100%;background:${barColor};border-radius:4px;transition:width 0.5s ease"></div>
                    </div>
                    <div class="text-muted" style="font-size:0.75rem;margin-top:2px;text-align:right">${limit > 0 ? pct.toFixed(0) + '% used' : ''}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="empty-state" style="padding:32px">
              <div class="empty-icon">📊</div>
              <h3>No budgets set</h3>
              <p>Set monthly budgets per category to track spending limits</p>
              <button class="btn btn-primary btn-sm" onclick="TransactionsPage.openSetBudgetModal()">+ Set Budget</button>
            </div>
          `}
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Error loading budgets: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  openSetBudgetModal(category, currentLimit) {
    const expenseCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Education', 'Rent', 'EMI', 'Insurance', 'Investment', 'Other'];
    // Include existing categories from transactions
    const existingCats = [...new Set(this.items.filter(t => t.type === 'expense').map(t => t.category))];
    existingCats.forEach(c => { if (c && !expenseCategories.includes(c)) expenseCategories.push(c); });

    Modal.open('Set Budget', `
      <form onsubmit="TransactionsPage.saveBudgetItem(event)">
        <div class="form-group">
          <label>Category</label>
          <select class="form-control" name="category" id="budgetCategory">
            ${expenseCategories.map(c => `<option value="${Utils.esc(c)}" ${c === category ? 'selected' : ''}>${Utils.esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Monthly Limit</label>
          <input class="form-control" type="number" step="0.01" name="limit" value="${currentLimit || ''}" required placeholder="e.g. 10000">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Budget</button>
        </div>
      </form>
    `);
  },

  async saveBudgetItem(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.limit = Number(form.limit);
    try {
      await API.saveBudget(form);
      Toast.success('Budget saved!');
      Modal.close();
      this.renderBudget();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteBudgetItem(id) {
    const ok = await Modal.confirm('Delete Budget', 'Remove this budget limit?');
    if (!ok) return;
    try {
      await API.deleteBudget(id);
      Toast.success('Budget removed');
      this.renderBudget();
    } catch (e) { Toast.error(e.message); }
  },

  // ─── RECURRING TRANSACTIONS TAB ─────────────────
  async renderRecurring() {
    const container = document.getElementById('txnTabContent');
    container.innerHTML = '<div class="loading"><div class="spinner"></div> Loading recurring transactions...</div>';

    try {
      const res = await API.getRecurringTransactions().catch(() => ({ data: [] }));
      const recurring = res.data || [];

      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Recurring Transactions</div>
          </div>
          ${recurring.length ? `
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Description</th><th>Category</th><th>Type</th><th class="text-right">Amount</th><th>Frequency</th><th>Next Due</th><th class="text-center">Actions</th></tr></thead>
                <tbody>
                  ${recurring.map(t => `
                    <tr>
                      <td>
                        <strong>${Utils.esc(t.description || t.category)}</strong>
                        <span class="badge" style="background:var(--blue-bg,#eff6ff);color:var(--blue);font-size:0.65rem;padding:1px 5px;border-radius:8px;margin-left:4px">recurring</span>
                      </td>
                      <td><span class="badge badge-other">${Utils.esc(t.category)}</span></td>
                      <td><span class="badge badge-${t.type}">${t.type}</span></td>
                      <td class="text-right font-mono ${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? '+' : '-'}${Utils.currencyFull(t.amount)}</td>
                      <td style="font-size:0.85rem">${Utils.esc(t.frequency || 'monthly')}</td>
                      <td class="font-mono text-muted" style="font-size:0.85rem">${t.next_due_date ? Utils.formatDate(t.next_due_date) : '-'}</td>
                      <td class="text-center">
                        <button class="btn-icon danger" onclick="TransactionsPage.removeRecurring('${t.id}')" title="Remove Recurring">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state" style="padding:32px">
              <div class="empty-icon">🔁</div>
              <h3>No recurring transactions</h3>
              <p>Mark any transaction as recurring using the 🔁 button in the Transactions tab</p>
            </div>
          `}
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  openMakeRecurringModal(id) {
    const t = this.items.find(x => x.id === id);
    if (!t) return;

    Modal.open('Make Recurring', `
      <form onsubmit="TransactionsPage.saveRecurring(event, '${id}')">
        <p class="text-muted" style="font-size:0.85rem; margin-bottom:16px">
          Set <strong>${Utils.esc(t.description || t.category)}</strong> (${Utils.currencyFull(t.amount)}) as a recurring transaction.
        </p>
        <div class="form-group">
          <label>Frequency</label>
          <select class="form-control" name="frequency">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div class="form-group">
          <label>Next Due Date</label>
          <input class="form-control" type="date" name="next_due_date" required value="${this._getNextMonth()}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Set Recurring</button>
        </div>
      </form>
    `);
  },

  _getNextMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  },

  async saveRecurring(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    try {
      await API.setRecurring(id, form);
      Toast.success('Transaction set as recurring!');
      Modal.close();
      await this.loadAll();
    } catch (err) { Toast.error(err.message); }
  },

  async removeRecurring(id) {
    try {
      await API.setRecurring(id, { is_recurring: false, frequency: null, next_due_date: null });
      Toast.success('Recurring removed');
      this.renderRecurring();
    } catch (e) { Toast.error(e.message); }
  },

  _renderMarkdown(text) {
    return text
      .split('\n')
      .map(line => {
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
        if (line.match(/^[\s]*[-•]\s/)) {
          return `<li style="margin-bottom:6px;font-size:0.88rem;line-height:1.5">${line.replace(/^[\s]*[-•]\s/, '')}</li>`;
        }
        if (line.trim() === '') return '';
        return `<p style="margin-bottom:6px;font-size:0.88rem;line-height:1.5">${line}</p>`;
      })
      .join('')
      .replace(/(<li.*?<\/li>)+/g, '<ul style="padding-left:18px;margin:0">$&</ul>');
  },
};
