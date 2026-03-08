/**
 * WealthPulse — Market Charts Page
 * TradingView powered charts + portfolio comparison
 */
const MarketChartsPage = {
  activeSymbol: 'NSE:NIFTY',
  activeName: 'Nifty 50',
  searchQuery: '',

  // Common indices grouped by region with TradingView symbols
  indexGroups: {
    'Indian Indices': [
      { symbol: 'NSE:NIFTY', name: 'Nifty 50', desc: 'Large-cap benchmark' },
      { symbol: 'NSE:BANKNIFTY', name: 'Bank Nifty', desc: 'Banking index' },
      { symbol: 'NSE:NIFTY_MID_SELECT', name: 'Nifty Midcap Select', desc: 'Mid-cap index' },
      { symbol: 'NSE:CNXSMALLCAP', name: 'Nifty Smallcap', desc: 'Small-cap index' },
      { symbol: 'NSE:CNXIT', name: 'Nifty IT', desc: 'IT sector index' },
      { symbol: 'NSE:CNXFINANCE', name: 'Nifty Financial', desc: 'Financial services' },
      { symbol: 'BSE:SENSEX', name: 'Sensex', desc: 'BSE 30 benchmark' },
    ],
    'US Indices': [
      { symbol: 'NASDAQ:NDX', name: 'NASDAQ 100', desc: 'US tech-heavy index' },
      { symbol: 'SP:SPX', name: 'S&P 500', desc: 'US large-cap benchmark' },
      { symbol: 'DJ:DJI', name: 'Dow Jones', desc: 'US blue-chip index' },
      { symbol: 'TVC:VIX', name: 'VIX', desc: 'Volatility index' },
    ],
    'Global Indices': [
      { symbol: 'TVC:NI225', name: 'Nikkei 225', desc: 'Japan' },
      { symbol: 'TVC:HSI', name: 'Hang Seng', desc: 'Hong Kong' },
      { symbol: 'TVC:UKX', name: 'FTSE 100', desc: 'UK' },
      { symbol: 'XETR:DAX', name: 'DAX', desc: 'Germany' },
    ],
    'Commodities': [
      { symbol: 'TVC:GOLD', name: 'Gold', desc: 'XAU/USD' },
      { symbol: 'TVC:SILVER', name: 'Silver', desc: 'XAG/USD' },
      { symbol: 'NYMEX:CL1!', name: 'Crude Oil', desc: 'WTI futures' },
    ],
    'Forex': [
      { symbol: 'FX_IDC:USDINR', name: 'USD/INR', desc: 'US Dollar to Rupee' },
      { symbol: 'FX_IDC:EURINR', name: 'EUR/INR', desc: 'Euro to Rupee' },
      { symbol: 'FX:EURUSD', name: 'EUR/USD', desc: 'Euro to Dollar' },
    ],
    'Crypto': [
      { symbol: 'CRYPTO:BTCUSD', name: 'Bitcoin', desc: 'BTC/USD' },
      { symbol: 'CRYPTO:ETHUSD', name: 'Ethereum', desc: 'ETH/USD' },
    ],
  },

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Market Charts</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Track global and domestic market indices via TradingView</p>
        </div>
      </div>
      <div id="marketChartsContent">
        <div class="loading"><div class="spinner"></div> Loading...</div>
      </div>
    `;
  },

  async init() {
    this.renderContent();
  },

  getAllIndices() {
    const all = [];
    for (const [group, items] of Object.entries(this.indexGroups)) {
      items.forEach(item => all.push({ ...item, group }));
    }
    return all;
  },

  getFilteredIndices() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return null;
    return this.getAllIndices().filter(idx =>
      idx.name.toLowerCase().includes(q) ||
      idx.desc.toLowerCase().includes(q) ||
      idx.symbol.toLowerCase().includes(q)
    );
  },

  _tradingViewUrl(item) {
    if (!item) return 'https://www.tradingview.com/';
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(item.symbol)}`;
  },

  _findItem(symbol) {
    for (const items of Object.values(this.indexGroups)) {
      const found = items.find(i => i.symbol === symbol);
      if (found) return found;
    }
    return null;
  },

  renderContent() {
    const activeItem = this._findItem(this.activeSymbol);

    document.getElementById('marketChartsContent').innerHTML = `
      <!-- Index Selector + Chart Layout -->
      <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;min-height:550px" id="chartLayout">
        <!-- Left panel: Index selector -->
        <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
          <div style="padding:12px;border-bottom:1px solid var(--border)">
            <input type="text" class="form-input" placeholder="Search indices..."
              id="indexSearch" oninput="MarketChartsPage.onSearch(this.value)"
              style="font-size:0.85rem;padding:8px 12px;width:100%">
          </div>
          <div id="indexList" style="flex:1;overflow-y:auto;padding:4px 0">
            ${this.renderIndexList()}
          </div>
        </div>

        <!-- Right panel: TradingView Chart -->
        <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
          <div class="card-header" style="padding:10px 16px;border-bottom:1px solid var(--border)">
            <div>
              <div class="card-title" id="activeChartTitle" style="font-size:1rem">${this.activeName}</div>
              <div class="text-muted" style="font-size:0.78rem" id="activeChartSymbol">${this.activeSymbol}</div>
            </div>
            <a href="${this._tradingViewUrl(activeItem)}" target="_blank" rel="noopener"
              class="btn btn-outline btn-sm" id="gfOpenBtn" style="text-decoration:none;font-size:0.8rem">
              Open in TradingView
            </a>
          </div>
          <div id="tvChartContainer" style="flex:1;min-height:480px;display:flex;align-items:center;justify-content:center">
            <div class="loading"><div class="spinner"></div> Loading chart...</div>
          </div>
        </div>
      </div>

      <!-- Portfolio vs Index Comparison -->
      <div class="card" style="margin-top:20px" id="portfolioVsIndexCard">
        <div class="card-header">
          <div>
            <div class="card-title">My Portfolio vs Market Indices</div>
            <div class="text-muted" style="font-size:0.78rem;margin-top:2px">Normalized growth starting at 100 from your first snapshot date</div>
          </div>
        </div>
        <div id="portfolioVsIndexContent">
          <div class="loading" style="padding:20px"><div class="spinner"></div> Loading comparison...</div>
        </div>
      </div>

      <!-- Gold-Silver Ratio -->
      <div class="card" style="margin-top:20px" id="goldSilverCard">
        <div class="card-header"><div class="card-title">Gold-Silver Ratio Analysis</div></div>
        <div id="goldSilverContent">
          <div class="loading" style="padding:20px"><div class="spinner"></div> Loading ratio data...</div>
        </div>
      </div>
    `;

    // Add responsive style for mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #chartLayout { grid-template-columns: 1fr !important; }
        #tvChartContainer { min-height: 350px !important; }
      }
      .idx-item { padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;border-left:3px solid transparent }
      .idx-item:hover { background:var(--bg-secondary) }
      .idx-item.active { background:var(--accent-bg, rgba(99,102,241,0.08));border-left-color:var(--accent);font-weight:500 }
      .idx-group-title { padding:8px 14px 4px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);font-weight:600 }
    `;
    document.getElementById('marketChartsContent').prepend(style);

    this.loadChart(this.activeSymbol);
    this.loadPortfolioVsIndex();
    this.loadGoldSilverRatio();
  },

  renderIndexList() {
    const filtered = this.getFilteredIndices();

    if (filtered) {
      if (!filtered.length) return '<div class="text-muted" style="padding:16px;text-align:center;font-size:0.85rem">No matches found</div>';
      return filtered.map(idx => `
        <div class="idx-item ${idx.symbol === this.activeSymbol ? 'active' : ''}"
          onclick="MarketChartsPage.selectIndex('${idx.symbol}', '${Utils.esc(idx.name)}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${idx.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${idx.desc}</div>
          </div>
        </div>
      `).join('');
    }

    let html = '';
    for (const [group, items] of Object.entries(this.indexGroups)) {
      html += `<div class="idx-group-title">${group}</div>`;
      html += items.map(idx => `
        <div class="idx-item ${idx.symbol === this.activeSymbol ? 'active' : ''}"
          onclick="MarketChartsPage.selectIndex('${idx.symbol}', '${Utils.esc(idx.name)}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${idx.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${idx.desc}</div>
          </div>
        </div>
      `).join('');
    }
    return html;
  },

  onSearch(query) {
    this.searchQuery = query;
    document.getElementById('indexList').innerHTML = this.renderIndexList();
  },

  selectIndex(symbol, name) {
    this.activeSymbol = symbol;
    this.activeName = name;
    this.searchQuery = '';
    const searchInput = document.getElementById('indexSearch');
    if (searchInput) searchInput.value = '';
    document.getElementById('indexList').innerHTML = this.renderIndexList();
    document.getElementById('activeChartTitle').textContent = name;
    document.getElementById('activeChartSymbol').textContent = symbol;
    const item = this._findItem(symbol);
    const btn = document.getElementById('gfOpenBtn');
    if (btn) btn.href = this._tradingViewUrl(item);
    this.loadChart(symbol);
  },

  loadChart(symbol) {
    const container = document.getElementById('tvChartContainer');
    if (!container) return;

    const item = this._findItem(symbol);
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    // Use TradingView Advanced Chart Widget (free, embeddable)
    const widgetId = 'tv-widget-' + Date.now();
    container.innerHTML = `<div id="${widgetId}" style="width:100%;height:100%"></div>`;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: 'D',
      timezone: 'Asia/Kolkata',
      theme: theme,
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    document.getElementById(widgetId).appendChild(script);
  },

  async loadPortfolioVsIndex() {
    const el = document.getElementById('portfolioVsIndexContent');
    if (!el) return;
    try {
      const res = await API.getPortfolioVsIndex();
      if (!res.success) {
        el.innerHTML = `
          <div class="empty-state" style="padding:32px">
            <div class="empty-icon">📈</div>
            <h3>Not enough data</h3>
            <p>${res.error || 'Take at least 2 snapshots to see portfolio comparison'}</p>
          </div>
        `;
        return;
      }

      const { labels, portfolio, indices, firstDate, portfolioReturn } = res.data;
      const returnColor = portfolioReturn >= 0 ? 'var(--green)' : 'var(--red)';

      const colors = {
        'My Portfolio': '#6366f1',
        'Nifty 50': '#f59e0b',
        'Sensex': '#10b981',
        'NASDAQ 100': '#3b82f6',
        'S&P 500': '#ec4899',
      };

      el.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
            <div class="stat-card" style="flex:1;min-width:140px">
              <div class="stat-label">My Portfolio Return</div>
              <div class="stat-value" style="color:${returnColor}">${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(1)}%</div>
              <div class="stat-sub">Since ${Utils.formatDate(firstDate)}</div>
            </div>
            ${Object.entries(indices).map(([name, series]) => {
              const last = series.filter(s => s.value !== null).pop();
              const idxReturn = last ? last.value - 100 : null;
              const color = idxReturn !== null ? (idxReturn >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)';
              return `
                <div class="stat-card" style="flex:1;min-width:140px">
                  <div class="stat-label">${name}</div>
                  <div class="stat-value" style="color:${color}">${idxReturn !== null ? (idxReturn >= 0 ? '+' : '') + idxReturn.toFixed(1) + '%' : 'N/A'}</div>
                  <div class="stat-sub">Same period</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="chart-container" style="height:320px">
            <canvas id="portfolioVsIndexChart"></canvas>
          </div>
          <p class="text-muted" style="font-size:0.75rem;margin-top:8px;text-align:center">
            All indices normalized to 100 at ${Utils.formatDate(firstDate)} for comparison
          </p>
        </div>
      `;

      requestAnimationFrame(async () => {
        const chartLabels = labels.map(d => Utils.formatDate(d));
        const datasets = [
          { label: 'My Portfolio', data: portfolio.map(p => p.value), color: colors['My Portfolio'], fill: false },
          ...Object.entries(indices).map(([name, series]) => ({
            label: name,
            data: series.map(s => s.value),
            color: colors[name] || '#94a3b8',
            fill: false,
          })),
        ];
        await Charts.line('portfolioVsIndexChart', chartLabels, datasets);
      });
    } catch (e) {
      el.innerHTML = `<p class="text-muted" style="padding:16px">Could not load comparison: ${e.message}</p>`;
    }
  },

  async loadGoldSilverRatio() {
    try {
      const res = await API.getGoldSilverRatio();
      const el = document.getElementById('goldSilverContent');
      if (!el) return;

      if (!res.success) {
        el.innerHTML = `<p class="text-muted" style="padding:16px">Could not load gold-silver ratio: ${res.error || 'Unknown error'}</p>`;
        return;
      }

      const ratio = res.ratio;
      const ratioColor = ratio > 80 ? 'var(--green)' : ratio < 50 ? 'var(--yellow)' : 'var(--text-primary)';
      const gaugePosition = Math.min(100, Math.max(0, ((ratio - 30) / 70) * 100));

      let cheaperMetal, cheaperExplanation;
      if (ratio > res.historicalAvg + 10) {
        cheaperMetal = 'Silver is relatively cheaper';
        cheaperExplanation = `The ratio (${ratio}) is well above the historical average (${res.historicalAvg}), meaning silver is undervalued relative to gold. Consider increasing silver allocation.`;
      } else if (ratio < res.historicalAvg - 10) {
        cheaperMetal = 'Gold is relatively cheaper';
        cheaperExplanation = `The ratio (${ratio}) is well below the historical average (${res.historicalAvg}), meaning gold is undervalued relative to silver. Consider increasing gold allocation.`;
      } else {
        cheaperMetal = 'Both are fairly valued';
        cheaperExplanation = `The ratio (${ratio}) is close to the historical average (${res.historicalAvg}). Neither metal is significantly over or undervalued relative to the other.`;
      }

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;padding:16px">
          <div style="text-align:center">
            <div class="text-muted" style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Gold Price</div>
            <div style="font-size:1.3rem;font-weight:700">${Utils.currency(res.goldPrice)}</div>
            <div class="text-muted" style="font-size:0.78rem">per gram</div>
          </div>
          <div style="text-align:center">
            <div class="text-muted" style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Silver Price</div>
            <div style="font-size:1.3rem;font-weight:700">${Utils.currency(res.silverPrice)}</div>
            <div class="text-muted" style="font-size:0.78rem">per gram</div>
          </div>
          <div style="text-align:center">
            <div class="text-muted" style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Current Ratio</div>
            <div style="font-size:1.8rem;font-weight:700;color:${ratioColor}">${ratio}</div>
            <div class="text-muted" style="font-size:0.78rem">Historical avg: ${res.historicalAvg}</div>
          </div>
          <div style="text-align:center">
            <div class="text-muted" style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Assessment</div>
            <div style="font-size:1rem;font-weight:600;margin-top:4px">${res.assessment}</div>
          </div>
        </div>
        <div style="padding:0 16px 16px">
          <div style="position:relative;height:8px;background:linear-gradient(to right, #f59e0b 0%, #10b981 45%, #10b981 55%, #3b82f6 100%);border-radius:4px;margin-bottom:6px">
            <div style="position:absolute;left:${gaugePosition}%;top:-4px;width:16px;height:16px;background:var(--bg-primary);border:3px solid var(--accent);border-radius:50%;transform:translateX(-50%)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted)">
            <span>Gold undervalued (30)</span>
            <span>Normal (50-80)</span>
            <span>Silver undervalued (100)</span>
          </div>
        </div>
        <div style="padding:0 16px 16px">
          <div style="background:var(--bg-secondary);border-radius:10px;padding:14px 16px;border-left:4px solid var(--accent)">
            <div style="font-weight:600;font-size:0.92rem;margin-bottom:4px">${cheaperMetal}</div>
            <p style="font-size:0.84rem;color:var(--text-secondary);margin:0;line-height:1.5">${cheaperExplanation}</p>
          </div>
        </div>
        <div style="padding:0 16px 16px">
          <p style="font-size:0.85rem;color:var(--text-secondary);background:var(--bg-secondary);padding:12px;border-radius:8px">${res.suggestion}</p>
        </div>
      `;
    } catch (e) {
      const el = document.getElementById('goldSilverContent');
      if (el) el.innerHTML = `<p class="text-muted" style="padding:16px">Could not load ratio data: ${e.message}</p>`;
    }
  },
};
