/**
 * WealthPulse — Financial Essentials Page
 * Insurance, emergency fund, monthly expense tracking & financial health check
 */
const EssentialsPage = {
  data: {},
  monthlyExpense: 0,
  epfNpsConfig: {},

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Financial Essentials</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Insurance, emergency fund, EPF/NPS & financial health check</p>
        </div>
      </div>
      <div id="essContent">
        <div class="loading"><div class="spinner"></div> Loading...</div>
      </div>
    `;
  },

  async init() {
    await this.load();
  },

  async load() {
    try {
      const [essRes, allocRes, txnSumRes, settRes] = await Promise.all([
        API.getEssentials(),
        API.getAssetAllocation().catch(() => ({ data: {} })),
        API.getTransactionSummary(3).catch(() => ({ data: [] })),
        API.getSettings().catch(() => ({ data: {} })),
      ]);
      this.data = essRes.data || {};
      if (allocRes.data?.emergencyFundValue) {
        this.data.emergency_fund_auto = allocRes.data.emergencyFundValue;
      }
      // Compute average monthly expense from last 3 months
      const expRows = (txnSumRes.data || []).filter(s => s.type === 'expense');
      this.monthlyExpense = expRows.length > 0 ? Math.round(expRows.reduce((s, r) => s + r.total, 0) / Math.min(expRows.length, 3)) : 0;
      this.epfNpsConfig = (settRes.data || {}).epfNpsConfig || {};
      this.renderContent();
    } catch (e) {
      document.getElementById('essContent').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  renderContent() {
    const d = this.data;
    const emergencyAuto = d.emergency_fund_auto || 0;
    const emergencyManual = d.emergency_fund || 0;
    const emergencyTotal = emergencyAuto || emergencyManual;
    const monthlyExp = this.monthlyExpense;
    const emergMonths = monthlyExp > 0 ? (emergencyTotal / monthlyExp) : 0;

    const termScore = d.term_insurance >= 10000000 ? 100 : d.term_insurance >= 5000000 ? 70 : d.term_insurance > 0 ? 40 : 0;
    const healthScore = d.health_insurance >= 1000000 ? 100 : d.health_insurance >= 500000 ? 70 : d.health_insurance > 0 ? 40 : 0;
    const emergScore = emergMonths >= 6 ? 100 : emergMonths >= 3 ? 70 : emergencyTotal > 0 ? 40 : 0;
    const overall = Math.round((termScore + healthScore + emergScore) / 3);
    const overallCls = overall >= 75 ? 'green' : overall >= 40 ? 'yellow' : 'red';

    // EPF/NPS info
    const epf = this.epfNpsConfig;
    const epfBalance = epf.epf_balance || 0;
    const npsBalance = epf.nps_balance || 0;
    const hasRetirement = epfBalance > 0 || npsBalance > 0;

    document.getElementById('essContent').innerHTML = `
      <!-- Health Score -->
      <div class="stats-grid">
        <div class="stat-card ${overallCls}">
          <div class="stat-label">Financial Health Score</div>
          <div class="stat-value">${overall}/100</div>
          <div class="stat-sub">${overall >= 75 ? '✅ Good standing' : overall >= 40 ? '⚠️ Needs attention' : '🚨 Critical gaps'}</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">Dependents</div>
          <div class="stat-value">${d.dependents || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Monthly Expense</div>
          <div class="stat-value">${Utils.currency(monthlyExp)}</div>
          <div class="stat-sub">Last 3 months average</div>
        </div>
        ${hasRetirement ? `
        <div class="stat-card green">
          <div class="stat-label">Retirement Corpus</div>
          <div class="stat-value">${Utils.currency(epfBalance + npsBalance)}</div>
          <div class="stat-sub">EPF + NPS</div>
        </div>` : ''}
      </div>

      <!-- Detail Cards -->
      <div class="grid-3">
        <div class="card">
          <div class="card-header"><div class="card-title">🛡️ Term Insurance</div></div>
          <div class="stat-value mb-8">${Utils.currency(d.term_insurance || 0)}</div>
          <div class="progress-bar mb-8"><div class="progress-fill ${termScore >= 75 ? 'green' : termScore >= 40 ? 'yellow' : 'red'}" style="width:${termScore}%"></div></div>
          <p class="text-muted" style="font-size:0.8rem">
            ${termScore >= 75 ? 'Adequate cover' : termScore >= 40 ? 'Consider increasing cover' : 'Recommended: ₹1 Cr minimum'}
          </p>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🏥 Health Insurance</div></div>
          <div class="stat-value mb-8">${Utils.currency(d.health_insurance || 0)}</div>
          <div class="progress-bar mb-8"><div class="progress-fill ${healthScore >= 75 ? 'green' : healthScore >= 40 ? 'yellow' : 'red'}" style="width:${healthScore}%"></div></div>
          <p class="text-muted" style="font-size:0.8rem">
            ${healthScore >= 75 ? 'Good health cover' : healthScore >= 40 ? 'Consider a top-up plan' : 'Recommended: ₹10L minimum'}
          </p>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🏦 Emergency Fund</div></div>
          <div class="stat-value mb-8">${Utils.currency(emergencyTotal)}</div>
          ${emergencyAuto > 0 ? `<p class="text-muted" style="font-size:0.78rem; margin-bottom:6px">Auto-calculated from Cash + Liquid + Arbitrage funds</p>` : ''}
          <div class="progress-bar mb-8"><div class="progress-fill ${emergScore >= 75 ? 'green' : emergScore >= 40 ? 'yellow' : 'red'}" style="width:${Math.min(emergMonths / 6 * 100, 100)}%"></div></div>
          <p class="text-muted" style="font-size:0.8rem">
            ${emergMonths >= 6 ? `✅ ${emergMonths.toFixed(1)} months covered` : emergMonths >= 3 ? `⚠️ ${emergMonths.toFixed(1)} months covered` : monthlyExp > 0 ? `🚨 ${emergMonths.toFixed(1)} months — need 6 months (${Utils.currency(monthlyExp * 6)})` : 'Set monthly expenses to track coverage'}
          </p>
        </div>
      </div>

      ${hasRetirement ? this.renderRetirementSection() : ''}

      <!-- Checklist -->
      <div class="card mt-16">
        <div class="card-header"><div class="card-title">📋 Financial Checklist</div></div>
        <div style="padding:4px 0">
          ${this.renderCheckItem('Term Life Insurance ≥ ₹1 Cr', termScore >= 75)}
          ${this.renderCheckItem('Health Insurance ≥ ₹10 Lakh', healthScore >= 75)}
          ${this.renderCheckItem('Emergency Fund ≥ 6 months expenses', emergScore >= 75)}
          ${this.renderCheckItem('EPF / Retirement savings started', epfBalance > 0)}
          ${this.renderCheckItem('NPS or additional pension plan', npsBalance > 0)}
          ${this.renderCheckItem('Will / Nomination updated', d.will_updated || false)}
        </div>
      </div>

      <!-- Edit Form -->
      <div class="card mt-16">
        <div class="card-header"><div class="card-title">Update Essentials</div></div>
        <form id="essForm">
          <div class="form-row">
            <div class="form-group">
              <label>Term Insurance Cover (₹)</label>
              <input class="form-control" type="number" step="1" id="ess_term_insurance" name="term_insurance" value="${d.term_insurance || 0}">
            </div>
            <div class="form-group">
              <label>Health Insurance Cover (₹)</label>
              <input class="form-control" type="number" step="1" id="ess_health_insurance" name="health_insurance" value="${d.health_insurance || 0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Emergency Fund (₹) <span class="text-muted" style="font-size:0.75rem; text-transform:none">(Manual override)</span></label>
              <input class="form-control" type="number" step="1" id="ess_emergency_fund" name="emergency_fund" value="${d.emergency_fund || 0}">
            </div>
            <div class="form-group">
              <label>Number of Dependents</label>
              <input class="form-control" type="number" id="ess_dependents" name="dependents" value="${d.dependents || 0}" min="0">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:8px">
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    // Bind form submit event properly
    const form = document.getElementById('essForm');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        EssentialsPage.save();
      });
    }
  },

  renderCheckItem(text, done) {
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-color)">
        <span style="font-size:1.1rem">${done ? '✅' : '⬜'}</span>
        <span style="font-size:0.88rem; ${done ? '' : 'color:var(--text-muted)'}">${text}</span>
      </div>
    `;
  },

  renderRetirementSection() {
    const epf = this.epfNpsConfig;
    const epfBal = epf.epf_balance || 0;
    const npsBal = epf.nps_balance || 0;
    const epfRate = epf.epf_interest_rate || 8.25;
    const npsRate = epf.nps_return_rate || 10;

    return `
      <div class="card mt-16">
        <div class="card-header">
          <div class="card-title">🏛️ Retirement Tracker</div>
          <a href="#settings" class="btn btn-ghost btn-xs">Configure →</a>
        </div>
        <div class="grid-2">
          <div style="padding:4px 0">
            <div class="flex-between mb-8"><span class="text-muted" style="font-size:0.85rem">EPF Balance</span><strong>${Utils.currency(epfBal)}</strong></div>
            <div class="flex-between mb-8"><span class="text-muted" style="font-size:0.85rem">Interest Rate</span><span>${epfRate}%</span></div>
            <div class="flex-between"><span class="text-muted" style="font-size:0.85rem">Monthly Contribution</span><span class="text-green">${Utils.currency(Math.round((epf.epf_employee_pct || 12) / 100 * (epf.epf_wage || 0) * 2))}</span></div>
          </div>
          <div style="padding:4px 0">
            <div class="flex-between mb-8"><span class="text-muted" style="font-size:0.85rem">NPS Balance</span><strong>${Utils.currency(npsBal)}</strong></div>
            <div class="flex-between mb-8"><span class="text-muted" style="font-size:0.85rem">Expected Return</span><span>${npsRate}%</span></div>
            <div class="flex-between"><span class="text-muted" style="font-size:0.85rem">Monthly SIP</span><span class="text-green">${Utils.currency(epf.nps_monthly || 0)}</span></div>
          </div>
        </div>
      </div>
    `;
  },

  async save() {
    const form = document.getElementById('essForm');
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const payload = {
      term_insurance: Number(document.getElementById('ess_term_insurance').value) || 0,
      health_insurance: Number(document.getElementById('ess_health_insurance').value) || 0,
      emergency_fund: Number(document.getElementById('ess_emergency_fund').value) || 0,
      dependents: Number(document.getElementById('ess_dependents').value) || 0,
    };
    try {
      await API.updateEssentials(payload);
      Toast.success('Essentials updated!');
      await this.load();
    } catch (err) {
      Toast.error(err.message || 'Failed to save essentials');
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  },
};
