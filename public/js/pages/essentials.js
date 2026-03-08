/**
 * WealthPulse — Financial Essentials Page
 * Insurance, emergency fund, monthly expense tracking & financial health check
 */
const EssentialsPage = {
  data: {},
  monthlyExpense: 0,
  epfNpsConfig: {},
  linkedAssets: [],

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
      const [essRes, allocRes, txnSumRes, settRes, linkedRes] = await Promise.all([
        API.getEssentials(),
        API.getAssetAllocation().catch(() => ({ data: {} })),
        API.getTransactionSummary(3).catch(() => ({ data: [] })),
        API.getSettings().catch(() => ({ data: {} })),
        API.getEmergencyFundAssets().catch(() => ({ data: [] })),
      ]);
      this.data = essRes.data || {};
      if (allocRes.data?.emergencyFundValue) {
        this.data.emergency_fund_auto = allocRes.data.emergencyFundValue;
      }
      // Compute average monthly expense from last 3 months
      const expRows = (txnSumRes.data || []).filter(s => s.type === 'expense');
      this.monthlyExpense = expRows.length > 0 ? Math.round(expRows.reduce((s, r) => s + r.total, 0) / Math.min(expRows.length, 3)) : 0;
      this.epfNpsConfig = (settRes.data || {}).epfNpsConfig || {};
      this.linkedAssets = linkedRes.data || [];
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

      <!-- Term, Health, Emergency Fund — all in one line -->
      <div class="grid-3">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🛡️ Term Insurance</div>
            <button class="btn btn-outline btn-xs" onclick="EssentialsPage.openInsuranceForm('term')">Edit</button>
          </div>
          <div class="stat-value mb-8">${Utils.currency(d.term_insurance || 0)}</div>
          <div class="progress-bar mb-8"><div class="progress-fill ${termScore >= 75 ? 'green' : termScore >= 40 ? 'yellow' : 'red'}" style="width:${termScore}%"></div></div>
          <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px">
            ${termScore >= 75 ? 'Adequate cover' : termScore >= 40 ? 'Consider increasing' : 'Recommended: ₹1 Cr min'}
          </p>
          ${d.term_policy_id || d.term_provider ? `
          <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.8rem">
            ${d.term_provider ? `<div class="flex-between mb-4"><span class="text-muted">Provider</span><strong>${Utils.esc(d.term_provider)}</strong></div>` : ''}
            ${d.term_policy_id ? `<div class="flex-between mb-4"><span class="text-muted">Policy ID</span><span class="font-mono">${Utils.esc(d.term_policy_id)}</span></div>` : ''}
            ${d.term_premium ? `<div class="flex-between mb-4"><span class="text-muted">Premium</span><span>${Utils.currency(d.term_premium)}/yr</span></div>` : ''}
            ${d.term_expiry ? `<div class="flex-between mb-4"><span class="text-muted">Expiry</span><span>${Utils.formatDate(d.term_expiry)}</span></div>` : ''}
            ${d.term_nominee ? `<div class="flex-between mb-4"><span class="text-muted">Nominee</span><span>${Utils.esc(d.term_nominee)}</span></div>` : ''}
            ${d.term_claim_number ? `<div class="flex-between mb-4"><span class="text-muted">Claim</span><span class="font-mono">${Utils.esc(d.term_claim_number)}</span></div>` : ''}
            ${d.term_notes ? `<div class="text-muted" style="font-size:0.75rem;margin-top:4px;font-style:italic">${Utils.esc(d.term_notes)}</div>` : ''}
          </div>` : '<p class="text-muted" style="font-size:0.75rem;font-style:italic">Click "Edit" to add policy info</p>'}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🏥 Health Insurance</div>
            <button class="btn btn-outline btn-xs" onclick="EssentialsPage.openInsuranceForm('health')">Edit</button>
          </div>
          <div class="stat-value mb-8">${Utils.currency(d.health_insurance || 0)}</div>
          <div class="progress-bar mb-8"><div class="progress-fill ${healthScore >= 75 ? 'green' : healthScore >= 40 ? 'yellow' : 'red'}" style="width:${healthScore}%"></div></div>
          <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px">
            ${healthScore >= 75 ? 'Good health cover' : healthScore >= 40 ? 'Consider top-up' : 'Recommended: ₹10L min'}
          </p>
          ${d.health_policy_id || d.health_provider ? `
          <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.8rem">
            ${d.health_provider ? `<div class="flex-between mb-4"><span class="text-muted">Provider</span><strong>${Utils.esc(d.health_provider)}</strong></div>` : ''}
            ${d.health_policy_id ? `<div class="flex-between mb-4"><span class="text-muted">Policy ID</span><span class="font-mono">${Utils.esc(d.health_policy_id)}</span></div>` : ''}
            ${d.health_premium ? `<div class="flex-between mb-4"><span class="text-muted">Premium</span><span>${Utils.currency(d.health_premium)}/yr</span></div>` : ''}
            ${d.health_expiry ? `<div class="flex-between mb-4"><span class="text-muted">Renewal</span><span>${Utils.formatDate(d.health_expiry)}</span></div>` : ''}
            ${d.health_members ? `<div class="flex-between mb-4"><span class="text-muted">Members</span><span>${Utils.esc(d.health_members)}</span></div>` : ''}
            ${d.health_claim_number ? `<div class="flex-between mb-4"><span class="text-muted">Claim</span><span class="font-mono">${Utils.esc(d.health_claim_number)}</span></div>` : ''}
            ${d.health_notes ? `<div class="text-muted" style="font-size:0.75rem;margin-top:4px;font-style:italic">${Utils.esc(d.health_notes)}</div>` : ''}
          </div>` : '<p class="text-muted" style="font-size:0.75rem;font-style:italic">Click "Edit" to add policy info</p>'}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🏦 Emergency Fund</div>
            <button class="btn btn-outline btn-xs" onclick="EssentialsPage.openLinkAssetsModal()">Link Assets</button>
          </div>
          <div class="stat-value mb-8">${Utils.currency(emergencyTotal)}</div>
          <div class="progress-bar mb-8"><div class="progress-fill ${emergScore >= 75 ? 'green' : emergScore >= 40 ? 'yellow' : 'red'}" style="width:${Math.min(emergMonths / 6 * 100, 100)}%"></div></div>
          <p class="text-muted" style="font-size:0.78rem;margin-bottom:8px">
            ${emergMonths >= 6 ? `✅ ${emergMonths.toFixed(1)} months covered` : emergMonths >= 3 ? `⚠️ ${emergMonths.toFixed(1)} months covered` : monthlyExp > 0 ? `🚨 ${emergMonths.toFixed(1)} months — need 6 months` : 'Set expenses to track'}
          </p>
          ${this.linkedAssets.length > 0 ? `
          <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.8rem">
            <div class="text-muted" style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Linked Assets</div>
            ${this.linkedAssets.map(a => `
              <div class="flex-between mb-4">
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%">${Utils.esc(a.name)}</span>
                <span style="font-weight:500">${Utils.currency(a.current_value_inr || a.current_value)}</span>
              </div>
            `).join('')}
          </div>` : `<p class="text-muted" style="font-size:0.75rem;font-style:italic">Click "Link Assets" to tag assets as emergency fund</p>`}
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

  openInsuranceForm(type) {
    const d = this.data;
    const isHealth = type === 'health';
    const title = isHealth ? 'Health Insurance Details' : 'Term Insurance Details';
    const prefix = isHealth ? 'health' : 'term';

    Modal.open(title, `
      <form onsubmit="EssentialsPage.saveInsurance(event, '${type}')">
        <div class="form-row">
          <div class="form-group">
            <label>Sum Insured / Cover Amount</label>
            <input class="form-control" type="number" step="1" name="${prefix}_insurance" value="${d[prefix + '_insurance'] || 0}">
          </div>
          <div class="form-group">
            <label>Annual Premium</label>
            <input class="form-control" type="number" step="1" name="${prefix}_premium" value="${d[prefix + '_premium'] || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Provider / Company</label>
            <input class="form-control" name="${prefix}_provider" value="${Utils.esc(d[prefix + '_provider'] || '')}" placeholder="e.g. HDFC Life, Star Health">
          </div>
          <div class="form-group">
            <label>Policy ID / Number</label>
            <input class="form-control" name="${prefix}_policy_id" value="${Utils.esc(d[prefix + '_policy_id'] || '')}" placeholder="Policy number">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>${isHealth ? 'Renewal Date' : 'Policy Expiry Date'}</label>
            <input class="form-control" type="date" name="${prefix}_expiry" value="${d[prefix + '_expiry'] || ''}">
          </div>
          <div class="form-group">
            <label>Claim Helpline Number</label>
            <input class="form-control" name="${prefix}_claim_number" value="${Utils.esc(d[prefix + '_claim_number'] || '')}" placeholder="Phone number">
          </div>
        </div>
        <div class="form-group">
          <label>${isHealth ? 'Members Covered' : 'Nominee'}</label>
          <input class="form-control" name="${isHealth ? 'health_members' : 'term_nominee'}" value="${Utils.esc(isHealth ? (d.health_members || '') : (d.term_nominee || ''))}" placeholder="${isHealth ? 'e.g. Self, Spouse, Children' : 'Nominee name'}">
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" name="${prefix}_notes" rows="2" placeholder="Additional details, rider info, etc.">${Utils.esc(d[prefix + '_notes'] || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
  },

  async saveInsurance(e, type) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    try {
      await API.updateEssentials(form);
      Toast.success('Insurance details saved!');
      Modal.close();
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async openLinkAssetsModal() {
    try {
      const namesRes = await API.getAssetNames();
      const assets = namesRes.data || [];
      const linkedIds = new Set(this.linkedAssets.map(a => a.id));

      Modal.open('Link Assets to Emergency Fund', `
        <p class="text-muted" style="font-size:0.85rem;margin-bottom:12px">
          Select assets that should be counted as your emergency fund. These will be automatically included in emergency fund calculations.
        </p>
        <div style="margin-bottom:12px">
          <input type="text" class="form-control" placeholder="Search assets..." id="efSearchInput"
            oninput="EssentialsPage.filterLinkAssets(this.value)"
            style="font-size:0.85rem;padding:8px 12px">
        </div>
        <div id="efAssetList" style="max-height:350px;overflow-y:auto">
          ${this._renderAssetCheckboxes(assets, linkedIds, '')}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Close</button>
        </div>
      `);
      // Store for filtering
      this._allAssetsForLink = assets;
      this._linkedIdsForLink = linkedIds;
    } catch (err) {
      Toast.error('Failed to load assets: ' + err.message);
    }
  },

  _renderAssetCheckboxes(assets, linkedIds, query) {
    const q = query.toLowerCase().trim();
    const filtered = q ? assets.filter(a => a.name.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q)) : assets;
    if (!filtered.length) return '<p class="text-muted" style="padding:16px;text-align:center">No assets found</p>';

    return filtered.map(a => `
      <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s"
        onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
        <input type="checkbox" ${linkedIds.has(a.id) ? 'checked' : ''}
          onchange="EssentialsPage.toggleEmergencyAsset('${a.id}', this.checked)" style="width:16px;height:16px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.esc(a.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${Utils.esc(a.category || '')} · ${Utils.currency(a.current_value_inr || 0)}</div>
        </div>
        ${linkedIds.has(a.id) ? '<span style="font-size:0.72rem;color:var(--green);font-weight:600">LINKED</span>' : ''}
      </label>
    `).join('');
  },

  filterLinkAssets(query) {
    const el = document.getElementById('efAssetList');
    if (!el) return;
    el.innerHTML = this._renderAssetCheckboxes(this._allAssetsForLink || [], this._linkedIdsForLink || new Set(), query);
  },

  async toggleEmergencyAsset(assetId, checked) {
    try {
      const res = await API.toggleAssetEmergencyFund(assetId);
      if (res.is_emergency_fund) {
        this._linkedIdsForLink.add(assetId);
      } else {
        this._linkedIdsForLink.delete(assetId);
      }
      // Refresh the checkbox list to update LINKED labels
      const searchVal = document.getElementById('efSearchInput')?.value || '';
      this.filterLinkAssets(searchVal);
      // Reload essentials data in background
      this.load();
    } catch (err) {
      Toast.error('Failed to update: ' + err.message);
    }
  },
};
