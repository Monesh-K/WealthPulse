/**
 * WealthPulse — Dashboard Page
 */
const DashboardPage = {
  async render() {
    return `
      <div id="dashboardContent">
        <div class="loading"><div class="spinner"></div> Loading dashboard...</div>
      </div>
    `;
  },

  async init() {
    try {
      const [res, txnSumRes, aiStatusRes, profileRes, xirrRes, sipCalRes, gsRatioRes] = await Promise.all([
        API.getDashboard(),
        API.getTransactionSummary(12).catch(() => ({ data: [] })),
        API.getAIStatus().catch(() => ({ enabled: false })),
        API.getProfileSummary().catch(() => ({ data: null })),
        API.getPortfolioXirr().catch(() => ({ data: null })),
        API.getSipCalendar().catch(() => ({ data: null })),
        API.getGoldSilverRatio().catch(() => ({ success: false })),
      ]);
      const d = res.data;
      d._txnSummary = txnSumRes.data || [];
      d._investmentByMonth = txnSumRes.investmentByMonth || {};
      d._aiEnabled = aiStatusRes.enabled || false;
      d._profileSummary = profileRes.data || null;
      d._portfolioXirr = xirrRes.data || null;
      d._sipCalendar = sipCalRes.data || null;
      d._goldSilverRatio = gsRatioRes.success ? gsRatioRes : null;
      this._lastData = d;
      document.getElementById('dashboardContent').innerHTML = this.buildHTML(d);
      // Use requestAnimationFrame to ensure DOM is rendered before chart init
      requestAnimationFrame(async () => await this.renderCharts(d));
    } catch (e) {
      document.getElementById('dashboardContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Could not load dashboard</h3>
          <p>${Utils.esc(e.message)}</p>
        </div>
      `;
    }
  },

  async fetchDashboardInsight(d) {
    if (!d) d = this._lastData;
    if (!d) { Toast.error('No dashboard data available'); return; }

    Modal.open('🤖 AI Portfolio Analysis', `
      <div id="aiInsightContent">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing your portfolio...
        </div>
      </div>
    `);

    try {
      const result = await API.getAIInsight('dashboard', {
        netWorth: d.netWorth,
        totalInvested: d.totalInvested,
        totalCurrent: d.totalCurrent,
        gainLoss: d.gainLoss,
        totalLiabilities: d.totalLiabilities,
        monthlyIncome: d.monthlyIncome,
        monthlyExpenses: d.monthlyExpenses,
        assetCount: d.assetCount,
        liabilityCount: d.liabilityCount,
        goalCount: d.goalCount,
        allocationByCategory: d.allocationByCategory,
      });
      const container = document.getElementById('aiInsightContent');
      if (container) {
        if (result.success && result.insight) {
          container.innerHTML = this.renderMarkdown(result.insight);
        } else {
          container.innerHTML = `<p class="text-muted" style="font-size:0.85rem">${result.error || 'Could not generate insight'}</p>`;
        }
      }
    } catch (err) {
      const container = document.getElementById('aiInsightContent');
      if (container) container.innerHTML = `<p class="text-muted" style="font-size:0.85rem">AI insight unavailable: ${err.message}</p>`;
    }
  },

  renderMarkdown(text) {
    // Simple markdown to HTML conversion for bullet points and bold
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

  buildHTML(d) {
    const gainPct = d.totalInvested > 0 ? ((d.gainLoss / d.totalInvested) * 100) : 0;

    // Compute savings from past transaction records (last month, since current month is incomplete)
    let lastMonthIncome = 0, lastMonthExpense = 0, lastMonthInvestment = 0, lastMonthLabel = '';
    const invByMonth = d._investmentByMonth || {};
    if (d._txnSummary && d._txnSummary.length) {
      const months = {};
      d._txnSummary.forEach(s => { if (!months[s.month]) months[s.month] = { income: 0, expense: 0 }; months[s.month][s.type] = s.total; });
      const sortedMonths = Object.keys(months).sort();
      // Pick last completed month (not current)
      const now = new Date();
      const curMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const pastMonths = sortedMonths.filter(m => m < curMonthKey);
      const targetMonth = pastMonths.length > 0 ? pastMonths[pastMonths.length - 1] : (sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null);
      if (targetMonth && months[targetMonth]) {
        lastMonthIncome = months[targetMonth].income || 0;
        lastMonthExpense = months[targetMonth].expense || 0;
        lastMonthInvestment = invByMonth[targetMonth] || 0;
        lastMonthLabel = Utils.formatMonth(targetMonth);
      }
    }
    const lastMonthTrueExpense = lastMonthExpense - lastMonthInvestment;
    const lastMonthSavings = lastMonthIncome - lastMonthTrueExpense;
    const lastMonthSavingsRate = lastMonthIncome > 0 ? (lastMonthSavings / lastMonthIncome * 100) : 0;

    // Also compute average savings rate over last 6 months
    let avgSavingsRate = 0;
    if (d._txnSummary && d._txnSummary.length) {
      const months = {};
      d._txnSummary.forEach(s => { if (!months[s.month]) months[s.month] = { income: 0, expense: 0 }; months[s.month][s.type] = s.total; });
      const now = new Date();
      const curMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const pastMonths = Object.keys(months).filter(m => m < curMonthKey).sort().slice(-6);
      if (pastMonths.length > 0) {
        const totalInc = pastMonths.reduce((s, m) => s + (months[m].income || 0), 0);
        const totalExp = pastMonths.reduce((s, m) => s + (months[m].expense || 0), 0);
        const totalInv = pastMonths.reduce((s, m) => s + (invByMonth[m] || 0), 0);
        const totalTrueExp = totalExp - totalInv;
        avgSavingsRate = totalInc > 0 ? ((totalInc - totalTrueExp) / totalInc * 100) : 0;
      }
    }

    // Portfolio XIRR
    let xirrHTML = '';
    if (d.topAssets && d.topAssets.length) {
      const withDates = d.topAssets.filter(a => a.purchase_date && a.invested_value > 0);
      if (withDates.length > 0) {
        let totalW = 0, wSum = 0;
        for (const a of withDates) {
          const days = Utils.daysSince(a.purchase_date);
          const inv = a.invested_value_inr || a.invested_value || 0;
          const cur = a.current_value_inr || a.current_value || 0;
          const x = Utils.xirr(inv, cur, days);
          if (x !== null) { wSum += x * inv; totalW += inv; }
        }
        if (totalW > 0) {
          const portfolioXirr = wSum / totalW;
          xirrHTML = `<div class="stat-sub">XIRR: ${Utils.percent(portfolioXirr)}</div>`;
        }
      }
    }

    // Portfolio XIRR - from API
    let apiXirrHTML = '';
    if (d._portfolioXirr && d._portfolioXirr.xirr != null) {
      const xirrValue = d._portfolioXirr.xirr;
      apiXirrHTML = `
        <div class="stat-card ${xirrValue >= 0 ? 'green' : 'red'}">
          <div class="stat-label">Portfolio XIRR</div>
          <div class="stat-value ${Utils.gainColor(xirrValue)}">${Utils.percent(xirrValue)}</div>
          <div class="stat-sub">Annualized return</div>
        </div>
      `;
    }

    // Monthly SIP Outflow
    let sipOutflowHTML = '';
    if (d._sipCalendar) {
      const totalSIP = d._sipCalendar.totalMonthly || (d._sipCalendar.entries || []).reduce((s, e) => s + (e.amount || 0), 0);
      if (totalSIP > 0) {
        sipOutflowHTML = `
          <div class="stat-card blue">
            <div class="stat-label">Monthly SIP + EMI</div>
            <div class="stat-value">${Utils.currency(totalSIP)}</div>
            <div class="stat-sub">${(d._sipCalendar.entries || []).length} active SIPs</div>
          </div>
        `;
      }
    }

    // Family Net Worth
    let familyHTML = '';
    if (d._profileSummary && d._profileSummary.profiles && d._profileSummary.profiles.length > 1) {
      const profiles = d._profileSummary.profiles;
      const totalFamilyNW = d._profileSummary.totalNetWorth || profiles.reduce((s, p) => s + (p.netWorth || 0), 0);
      const profileColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
      familyHTML = `
        <div class="card mb-24" style="margin-bottom:24px">
          <div class="card-header">
            <div class="card-title">👨‍👩‍👧‍👦 Family Net Worth</div>
            <a href="#settings" class="btn btn-ghost btn-xs">Manage Profiles →</a>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-size:1.4rem;font-weight:700">${Utils.currency(totalFamilyNW)}</div>
            <span class="text-muted" style="font-size:0.85rem">${profiles.length} profiles</span>
          </div>
          <div style="display:flex;gap:4px;height:12px;border-radius:6px;overflow:hidden;margin-bottom:12px">
            ${profiles.map((p, i) => {
              const pct = totalFamilyNW > 0 ? ((p.netWorth || 0) / totalFamilyNW * 100) : 0;
              return `<div style="width:${pct}%;background:${p.color || profileColors[i % profileColors.length]};min-width:${pct > 0 ? '4px' : '0'}" title="${Utils.esc(p.name)}: ${Utils.currency(p.netWorth || 0)}"></div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            ${profiles.map((p, i) => `
              <div style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                <span style="width:10px;height:10px;border-radius:50%;background:${p.color || profileColors[i % profileColors.length]};display:inline-block"></span>
                <span>${Utils.esc(p.name)}</span>
                <span class="font-mono" style="font-weight:600">${Utils.currency(p.netWorth || 0)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      ${familyHTML}
      <!-- KPI Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Net Worth</div>
          <div class="stat-value">${Utils.currency(d.netWorth)}</div>
          <div class="stat-sub">${d.assetCount} assets · ${d.liabilityCount} liabilities</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">Total Invested</div>
          <div class="stat-value">${Utils.currency(d.totalInvested)}</div>
          <div class="stat-sub">Current: ${Utils.currency(d.totalCurrent)}</div>
        </div>
        <div class="stat-card ${d.gainLoss >= 0 ? 'green' : 'red'}">
          <div class="stat-label">Gain / Loss</div>
          <div class="stat-value ${Utils.gainColor(d.gainLoss)}">${Utils.currency(d.gainLoss)}</div>
          <div class="stat-sub ${Utils.gainClass(d.gainLoss)}">${d.gainLoss >= 0 ? '↑' : '↓'} ${Utils.percent(Math.abs(gainPct))}</div>
          ${xirrHTML}
        </div>
        <div class="stat-card ${lastMonthSavings >= 0 ? 'green' : 'red'}">
          <div class="stat-label">${lastMonthLabel ? lastMonthLabel + ' Savings' : 'Monthly Savings'}</div>
          <div class="stat-value ${Utils.gainColor(lastMonthSavings)}">${Utils.currency(lastMonthSavings)}</div>
          <div class="stat-sub">Rate: ${Utils.percent(lastMonthSavingsRate)} · Avg: ${Utils.percent(avgSavingsRate)}${lastMonthInvestment > 0 ? ` (incl. inv.)` : ''}</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-label">Liabilities</div>
          <div class="stat-value">${Utils.currency(d.totalLiabilities)}</div>
          <div class="stat-sub">${d.liabilityCount} active</div>
        </div>
        ${d.emergencyFundValue > 0 ? `
        <div class="stat-card" style="border-left:3px solid #06b6d4">
          <div class="stat-label">Emergency Fund</div>
          <div class="stat-value">${Utils.currency(d.emergencyFundValue)}</div>
          <div class="stat-sub">${d.emergencyMonths > 0 ? d.emergencyMonths.toFixed(1) + ' months of expenses' : 'Cash + Liquid + FDs'}</div>
        </div>
        ` : ''}
        ${d.retirementCorpus > 0 ? `
        <div class="stat-card" style="border-left:3px solid #7c3aed">
          <div class="stat-label">Retirement Corpus</div>
          <div class="stat-value">${Utils.currency(d.retirementCorpus)}</div>
          <div class="stat-sub">${Utils.percent(d.retirementPct)} of net worth</div>
        </div>
        ` : ''}
        ${d.liquidNetWorth !== undefined ? `
        <div class="stat-card">
          <div class="stat-label">Liquid Net Worth</div>
          <div class="stat-value">${Utils.currency(d.liquidNetWorth)}</div>
          <div class="stat-sub">Excl. retirement assets</div>
        </div>
        ` : ''}
        ${apiXirrHTML}
        ${sipOutflowHTML}
      </div>

      ${d._aiEnabled ? `
      <!-- AI Insights Button -->
      <div style="margin-bottom:20px">
        <button class="btn btn-outline btn-sm" onclick="DashboardPage.fetchDashboardInsight()" style="display:inline-flex;align-items:center;gap:6px">
          🤖 AI Portfolio Insight
        </button>
      </div>
      ` : ''}

      <!-- Net Worth Breakdown -->
      ${d.allocationByCategory ? (() => {
        const cats = Object.entries(d.allocationByCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const totalVal = cats.reduce((s, [, v]) => s + v, 0);
        if (!cats.length) return '';
        return `
        <div class="card mb-24" style="margin-bottom:24px">
          <div class="card-header">
            <div class="card-title">📊 Net Worth Breakdown</div>
            <a href="#assets" class="btn btn-ghost btn-xs">Details →</a>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div style="flex:1;min-width:280px">
              ${cats.map(([cat, val]) => {
                const pct = totalVal > 0 ? (val / totalVal * 100) : 0;
                const colors = {'Equity':'#3b82f6','Debt':'#10b981','Gold':'#f59e0b','Cash':'#6b7280','Real Estate':'#b45309','International':'#7c3aed','Crypto':'#db2777','Retirement':'#7c3aed'};
                const color = colors[cat] || '#6366f1';
                return `
                <div style="margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:3px">
                    <span style="font-weight:500">${cat}</span>
                    <span class="font-mono">${Utils.currency(val)} <span class="text-muted">(${pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s ease"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <div style="width:200px;flex-shrink:0">
              <canvas id="breakdownPieChart" style="max-height:200px"></canvas>
            </div>
          </div>
        </div>`;
      })() : ''}

      <!-- Charts Row -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Net Worth Trend</div>
          </div>
          <div class="chart-container" style="height:280px">
            <canvas id="netWorthChart"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Asset Allocation</div>
          </div>
          <div class="chart-container" style="height:280px">
            <canvas id="allocationChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Assets & Goals -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Top Holdings</div>
            <a href="#assets" class="btn btn-ghost btn-xs">View All →</a>
          </div>
          ${d.topAssets && d.topAssets.length ? `
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Name</th><th>Category</th><th class="text-right">Value</th><th class="text-right">Gain</th><th class="text-right hide-mobile">XIRR</th></tr></thead>
                <tbody>
                  ${d.topAssets.map(a => {
                    const inv = a.invested_value_inr || a.invested_value || 0;
                    const cur = a.current_value_inr || a.current_value || 0;
                    const gain = cur - inv;
                    const gainPctAsset = inv > 0 ? (gain / inv * 100) : 0;
                    let xirrVal = null;
                    if (a.purchase_date && inv > 0) {
                      const days = Utils.daysSince(a.purchase_date);
                      xirrVal = Utils.xirr(inv, cur, days);
                    }
                    return `<tr>
                      <td><strong title="${Utils.esc(a.name)}" class="truncate" style="max-width:160px; display:inline-block">${Utils.truncateText(a.name, 22)}</strong></td>
                      <td>${Utils.categoryBadge(a.category)}</td>
                      <td class="text-right font-mono">${Utils.currency(cur)}</td>
                      <td class="text-right font-mono ${Utils.gainColor(gain)}">${Utils.currency(gain)}<br><span style="font-size:0.75rem">${Utils.percent(gainPctAsset)}</span></td>
                      <td class="text-right font-mono hide-mobile ${xirrVal !== null ? Utils.gainColor(xirrVal) : 'text-muted'}">${xirrVal !== null ? Utils.percent(xirrVal) : '-'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><p>No assets yet. <a href="#assets">Add some!</a></p></div>'}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Goal Progress</div>
            <a href="#goals" class="btn btn-ghost btn-xs">View All →</a>
          </div>
          ${d.goals && d.goals.length ? d.goals.map(g => {
            const years = (g.target_year || 2030) - new Date().getFullYear();
            const inflAdj = g.target_amount * Math.pow(1 + (g.inflation || 6) / 100, Math.max(years, 0));
            const pct = inflAdj > 0 ? Math.min((g.current_value / inflAdj) * 100, 100) : 0;
            const cls = pct >= 75 ? 'green' : pct >= 40 ? 'yellow' : 'red';
            return `
              <div style="margin-bottom:16px">
                <div class="flex-between mb-8">
                  <strong>${Utils.esc(g.name)}</strong>
                  <span class="font-mono" style="font-size:0.85rem">${Utils.percent(pct)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
                <div class="flex-between mt-8" style="font-size:0.78rem; color:var(--text-muted)">
                  <span>${Utils.currency(g.current_value)}</span>
                  <span>Target: ${Utils.currency(inflAdj)} by ${g.target_year}</span>
                </div>
              </div>
            `;
          }).join('') : '<div class="empty-state"><p>No goals set. <a href="#goals">Create one!</a></p></div>'}
        </div>
      </div>

      <!-- Monthly Cash Flow Trend -->
      ${d._txnSummary && d._txnSummary.length ? (() => {
        const months = {};
        d._txnSummary.forEach(s => { if (!months[s.month]) months[s.month] = { income: 0, expense: 0 }; months[s.month][s.type] = s.total; });
        const labels = Object.keys(months).sort().slice(-6);
        if (!labels.length) return '';
        return `
        <div class="card" style="margin-top:24px">
          <div class="card-header">
            <div class="card-title">💹 Monthly Cash Flow (Last 6 Months)</div>
            <a href="#transactions" class="btn btn-ghost btn-xs">View All →</a>
          </div>
          <div class="chart-container" style="height:260px">
            <canvas id="cashFlowChart"></canvas>
          </div>
          <div style="display:flex;gap:24px;padding:12px 0 0;flex-wrap:wrap;font-size:0.85rem">
            ${labels.map(m => {
              const inc = months[m]?.income || 0;
              const exp = months[m]?.expense || 0;
              const sav = inc - exp;
              const rate = inc > 0 ? (sav / inc * 100) : 0;
              return `<div style="display:flex;align-items:center;gap:6px">
                <span class="text-muted">${Utils.formatMonth(m)}:</span>
                <span class="font-mono ${Utils.gainColor(sav)}">${Utils.currency(sav)}</span>
                <span class="text-muted" style="font-size:0.78rem">(${rate.toFixed(0)}%)</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      })() : ''}

      <!-- Gold-Silver Ratio -->
      ${d._goldSilverRatio ? (() => {
        const gs = d._goldSilverRatio;
        const ratio = gs.ratio;
        let cheaperMetal, cheaperColor;
        if (ratio > gs.historicalAvg + 10) {
          cheaperMetal = 'Silver is relatively cheaper';
          cheaperColor = '#94a3b8';
        } else if (ratio < gs.historicalAvg - 10) {
          cheaperMetal = 'Gold is relatively cheaper';
          cheaperColor = '#f59e0b';
        } else {
          cheaperMetal = 'Both fairly valued';
          cheaperColor = 'var(--text-secondary)';
        }
        const gaugePos = Math.min(100, Math.max(0, ((ratio - 30) / 70) * 100));
        return `
        <div class="card" style="margin-top:24px">
          <div class="card-header">
            <div class="card-title">Gold-Silver Ratio</div>
            <a href="#marketcharts" class="btn btn-ghost btn-xs">Full Analysis →</a>
          </div>
          <div style="padding:0 16px 16px">
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
              <div style="text-align:center;flex:1;min-width:80px">
                <div class="text-muted" style="font-size:0.72rem;text-transform:uppercase">Gold</div>
                <div style="font-weight:700;font-size:1.1rem">${Utils.currency(gs.goldPrice)}</div>
                <div class="text-muted" style="font-size:0.72rem">per gram</div>
              </div>
              <div style="text-align:center;flex:1;min-width:80px">
                <div class="text-muted" style="font-size:0.72rem;text-transform:uppercase">Silver</div>
                <div style="font-weight:700;font-size:1.1rem">${Utils.currency(gs.silverPrice)}</div>
                <div class="text-muted" style="font-size:0.72rem">per gram</div>
              </div>
              <div style="text-align:center;flex:1;min-width:80px">
                <div class="text-muted" style="font-size:0.72rem;text-transform:uppercase">Ratio</div>
                <div style="font-weight:700;font-size:1.4rem">${ratio}</div>
                <div class="text-muted" style="font-size:0.72rem">Avg: ${gs.historicalAvg}</div>
              </div>
              <div style="text-align:center;flex:1;min-width:100px">
                <div style="font-weight:600;font-size:0.88rem;color:${cheaperColor}">${cheaperMetal}</div>
              </div>
            </div>
            <div style="position:relative;height:6px;background:linear-gradient(to right, #f59e0b 0%, #10b981 45%, #10b981 55%, #3b82f6 100%);border-radius:3px">
              <div style="position:absolute;left:${gaugePos}%;top:-5px;width:14px;height:14px;background:var(--bg-primary);border:3px solid var(--accent);border-radius:50%;transform:translateX(-50%)"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-top:4px">
              <span>Gold cheaper</span><span>Normal</span><span>Silver cheaper</span>
            </div>
          </div>
        </div>`;
      })() : ''}
    `;
  },

  async renderCharts(d) {
    // Net worth trend
    if (d.snapshots && d.snapshots.length) {
      const canvas = document.getElementById('netWorthChart');
      if (canvas) {
        await Charts.line('netWorthChart',
          d.snapshots.map(s => Utils.formatDate(s.date)),
          [
            { label: 'Net Worth', data: d.snapshots.map(s => s.net_worth), color: '#6366f1' },
            { label: 'Assets', data: d.snapshots.map(s => s.assets), color: '#10b981', fill: false },
            { label: 'Liabilities', data: d.snapshots.map(s => s.liabilities), color: '#ef4444', fill: false },
          ]
        );
      }
    }

    // Allocation
    if (d.allocationByCategory) {
      const cats = Object.entries(d.allocationByCategory).filter(([, v]) => v > 0);
      if (cats.length) {
        if (document.getElementById('allocationChart')) {
          await Charts.doughnut('allocationChart', cats.map(c => c[0]), cats.map(c => c[1]));
        }
        if (document.getElementById('breakdownPieChart')) {
          await Charts.doughnut('breakdownPieChart', cats.map(c => c[0]), cats.map(c => c[1]));
        }
      }
    }

    // Cash flow trend
    if (d._txnSummary && d._txnSummary.length) {
      const months = {};
      d._txnSummary.forEach(s => { if (!months[s.month]) months[s.month] = { income: 0, expense: 0 }; months[s.month][s.type] = s.total; });
      const labels = Object.keys(months).sort().slice(-6);
      if (labels.length && document.getElementById('cashFlowChart')) {
        await Charts.bar('cashFlowChart',
          labels.map(m => Utils.formatMonth(m)),
          [
            { label: 'Income', data: labels.map(m => months[m]?.income || 0), color: '#10b981' },
            { label: 'Expenses', data: labels.map(m => months[m]?.expense || 0), color: '#ef4444' },
          ]
        );
      }
    }
  },
};
