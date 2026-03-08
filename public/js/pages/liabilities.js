/**
 * WealthPulse — Liabilities Page
 */
const LiabilitiesPage = {
  items: [],

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Liabilities</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Track loans, credit cards & other liabilities</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="LiabilitiesPage.openForm()">+ Add Liability</button>
      </div>
      <div class="stats-grid" id="liabilityStats"></div>
      <div class="card">
        <div id="liabilitiesTableWrap">
          <div class="loading"><div class="spinner"></div> Loading...</div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.load();
  },

  async load() {
    try {
      const res = await API.getLiabilities();
      this.items = res.data || [];
      this.renderStats();
      this.renderTable();
    } catch (e) {
      document.getElementById('liabilitiesTableWrap').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  renderStats() {
    const total = this.items.reduce((s, l) => s + (l.outstanding || 0), 0);
    const totalEmi = this.items.reduce((s, l) => s + (l.emi || 0), 0);
    const goldLoans = this.items.filter(l => l.type === 'Gold Loan');
    const totalGoldWeight = goldLoans.reduce((s, l) => s + (l.gold_weight || 0), 0);
    const totalGoldPledged = goldLoans.reduce((s, l) => s + (l.pledged_value || 0), 0);
    document.getElementById('liabilityStats').innerHTML = `
      <div class="stat-card red">
        <div class="stat-label">Total Outstanding</div>
        <div class="stat-value">${Utils.currency(total)}</div>
        <div class="stat-sub">${this.items.length} liabilities</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Total Monthly EMI</div>
        <div class="stat-value">${Utils.currency(totalEmi)}</div>
      </div>
      ${goldLoans.length > 0 ? `
      <div class="stat-card" style="border-left:3px solid #f59e0b">
        <div class="stat-label">Gold Pledged</div>
        <div class="stat-value">${totalGoldWeight.toFixed(1)}g</div>
        <div class="stat-sub">${goldLoans.length} gold loan${goldLoans.length > 1 ? 's' : ''}${totalGoldPledged > 0 ? ' · ' + Utils.currency(totalGoldPledged) : ''}</div>
      </div>` : ''}
    `;
  },

  renderTable() {
    if (!this.items.length) {
      document.getElementById('liabilitiesTableWrap').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <h3>No liabilities!</h3>
          <p>That's great! Or add one to track.</p>
          <button class="btn btn-primary btn-sm" onclick="LiabilitiesPage.openForm()">+ Add Liability</button>
        </div>
      `;
      return;
    }

    document.getElementById('liabilitiesTableWrap').innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th class="text-right">Outstanding</th><th class="text-right">Rate</th><th class="text-right">EMI</th><th class="text-right">Tenure</th><th class="text-center">Actions</th></tr></thead>
          <tbody>
            ${this.items.map(l => `
              <tr>
                <td><strong>${Utils.esc(l.name)}</strong>${l.notes ? `<br><span class="text-muted" style="font-size:0.78rem">${Utils.esc(l.notes)}</span>` : ''}${l.type === 'Gold Loan' && l.gold_weight ? `<br><span class="text-muted" style="font-size:0.75rem">${l.gold_weight}g ${l.gold_purity || '22K'} gold</span>` : ''}</td>
                <td><span class="badge badge-expense">${Utils.esc(l.type)}</span></td>
                <td class="text-right font-mono text-red">${Utils.currencyFull(l.outstanding)}</td>
                <td class="text-right font-mono">${l.rate}%</td>
                <td class="text-right font-mono">${Utils.currencyFull(l.emi)}</td>
                <td class="text-right font-mono">${l.tenure ? l.tenure + ' mo' : '-'}</td>
                <td class="text-center">
                  <div class="btn-group" style="justify-content:center">
                    ${l.type === 'Gold Loan' ? `<button class="btn-icon" onclick="LiabilitiesPage.viewGoldLoanDetail('${l.id}')" title="Gold Loan Details">🥇</button>` : ''}
                    <button class="btn-icon" onclick="LiabilitiesPage.viewAmortization('${l.id}')" title="Amortization">📊</button>
                    <button class="btn-icon" onclick="LiabilitiesPage.openForm('${l.id}')" title="Edit">✏️</button>
                    <button class="btn-icon danger" onclick="LiabilitiesPage.deleteItem('${l.id}')" title="Delete">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openForm(id) {
    const l = id ? this.items.find(x => x.id === id) : {};
    const isEdit = !!id;
    const isGoldLoan = l.type === 'Gold Loan';
    Modal.open(isEdit ? 'Edit Liability' : 'Add Liability', `
      <form id="liabilityForm" onsubmit="LiabilitiesPage.save(event, '${id || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label>Name *</label>
            <input class="form-control" name="name" value="${Utils.esc(l.name || '')}" required>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" name="type" onchange="LiabilitiesPage.onTypeChange(this.value)">
              ${['Home Loan','Car Loan','Personal Loan','Gold Loan','Credit Card','Education Loan','Other'].map(t =>
                `<option ${l.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div id="goldLoanFields" style="display:${isGoldLoan ? 'block' : 'none'}">
          <div class="form-row-3">
            <div class="form-group">
              <label>Gold Weight (grams)</label>
              <input class="form-control" type="number" step="0.01" name="gold_weight" value="${l.gold_weight || 0}">
            </div>
            <div class="form-group">
              <label>Gold Purity</label>
              <select class="form-control" name="gold_purity">
                ${['24K','22K','18K','14K'].map(p =>
                  `<option ${(l.gold_purity || '22K') === p ? 'selected' : ''}>${p}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Pledged Value</label>
              <input class="form-control" type="number" step="0.01" name="pledged_value" value="${l.pledged_value || 0}">
            </div>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Outstanding Amount</label>
            <input class="form-control" type="number" step="0.01" name="outstanding" value="${l.outstanding || 0}">
          </div>
          <div class="form-group">
            <label>Interest Rate (%)</label>
            <input class="form-control" type="number" step="0.01" name="rate" value="${l.rate || 0}">
          </div>
          <div class="form-group">
            <label>Monthly EMI</label>
            <input class="form-control" type="number" step="0.01" name="emi" value="${l.emi || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tenure (months)</label>
            <input class="form-control" type="number" name="tenure" value="${l.tenure || 0}">
          </div>
          <div class="form-group">
            <label>Notes</label>
            <input class="form-control" name="notes" value="${Utils.esc(l.notes || '')}">
          </div>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'}</button>
        </div>
      </form>
    `);
  },

  onTypeChange(type) {
    const goldFields = document.getElementById('goldLoanFields');
    if (goldFields) goldFields.style.display = type === 'Gold Loan' ? 'block' : 'none';
  },

  async save(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.outstanding = Number(form.outstanding);
    form.rate = Number(form.rate);
    form.emi = Number(form.emi);
    form.tenure = Number(form.tenure);
    form.gold_weight = Number(form.gold_weight || 0);
    form.pledged_value = Number(form.pledged_value || 0);
    try {
      if (id) { await API.updateLiability(id, form); Toast.success('Updated!'); }
      else { await API.createLiability(form); Toast.success('Added!'); }
      Modal.close();
      await this.load();
    } catch (e) { Toast.error(e.message); }
  },

  async deleteItem(id) {
    const ok = await Modal.confirm('Delete Liability', 'Delete this liability?');
    if (!ok) return;
    try { await API.deleteLiability(id); Toast.success('Deleted'); await this.load(); }
    catch (e) { Toast.error(e.message); }
  },

  async viewAmortization(id) {
    const liability = this.items.find(l => l.id === id);
    if (!liability) return;

    Modal.open(`Amortization Schedule — ${Utils.esc(liability.name)}`, `
      <div id="amortizationContent">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Calculating amortization...
        </div>
      </div>
    `);

    try {
      const res = await API.getAmortization(id);
      const data = res.data || {};
      const schedule = data.schedule || [];
      const summary = data.summary || {};
      const container = document.getElementById('amortizationContent');
      if (!container) return;

      // If API returns empty, compute client-side
      let rows = schedule;
      let totalInterest = summary.totalInterest || 0;
      let totalPaid = summary.totalPaid || 0;
      let monthsRemaining = summary.monthsRemaining || 0;

      if (!rows.length && liability.outstanding > 0 && liability.emi > 0 && liability.rate > 0) {
        // Client-side amortization calculation
        const monthlyRate = (liability.rate / 100) / 12;
        let balance = liability.outstanding;
        let month = 0;
        totalInterest = 0;
        totalPaid = 0;
        rows = [];
        while (balance > 0 && month < 600) {
          month++;
          const interest = balance * monthlyRate;
          const principal = Math.min(liability.emi - interest, balance);
          if (principal <= 0) break;
          balance -= principal;
          totalInterest += interest;
          totalPaid += principal + interest;
          rows.push({ month, emi: principal + interest, principal, interest, balance: Math.max(balance, 0) });
        }
        monthsRemaining = rows.length;
      }

      if (!rows.length) {
        container.innerHTML = '<div class="empty-state" style="padding:24px"><p>Cannot calculate amortization. Ensure outstanding amount, EMI, and interest rate are set.</p></div>';
        return;
      }

      container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:16px">
          <div class="stat-card red">
            <div class="stat-label">Total Interest</div>
            <div class="stat-value">${Utils.currency(totalInterest)}</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-label">Total to be Paid</div>
            <div class="stat-value">${Utils.currency(totalPaid)}</div>
          </div>
          <div class="stat-card blue">
            <div class="stat-label">Months Remaining</div>
            <div class="stat-value">${monthsRemaining}</div>
            <div class="stat-sub">${(monthsRemaining / 12).toFixed(1)} years</div>
          </div>
        </div>
        <div class="table-wrapper" style="max-height:400px; overflow-y:auto">
          <table>
            <thead><tr><th>Month</th><th class="text-right">EMI</th><th class="text-right">Principal</th><th class="text-right">Interest</th><th class="text-right">Balance</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td class="font-mono">${r.month}</td>
                  <td class="text-right font-mono">${Utils.currencyFull(r.emi)}</td>
                  <td class="text-right font-mono text-green">${Utils.currencyFull(r.principal)}</td>
                  <td class="text-right font-mono text-red">${Utils.currencyFull(r.interest)}</td>
                  <td class="text-right font-mono">${Utils.currencyFull(r.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      const container = document.getElementById('amortizationContent');
      if (container) container.innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(err.message)}</p></div>`;
    }
  },

  async viewGoldLoanDetail(id) {
    const l = this.items.find(x => x.id === id);
    if (!l) return;

    const outstanding = l.outstanding || 0;
    const rate = l.rate || 0;
    const tenure = l.tenure || 0;
    const goldWeight = l.gold_weight || 0;
    const pledgedValue = l.pledged_value || 0;
    const purity = l.gold_purity || '22K';

    // Calculate interest breakdown
    const monthlyRate = rate / 12 / 100;
    const monthlyInterest = outstanding * monthlyRate;
    const quarterlyInterest = outstanding * (rate / 4 / 100);

    // LTV (Loan-to-Value ratio)
    const ltv = pledgedValue > 0 ? (outstanding / pledgedValue * 100) : 0;
    const ltvColor = ltv > 75 ? 'var(--red)' : ltv > 60 ? 'var(--yellow)' : 'var(--green)';

    // Total interest over tenure
    const totalInterest = tenure > 0 ? monthlyInterest * tenure : monthlyInterest * 12;
    const totalPayable = outstanding + totalInterest;

    // Purity multiplier for per-gram value
    const purityMap = { '24K': 0.999, '22K': 0.916, '18K': 0.750, '14K': 0.585 };
    const purityFactor = purityMap[purity] || 0.916;
    const perGramPledged = goldWeight > 0 ? pledgedValue / goldWeight : 0;

    Modal.open(`Gold Loan Details — ${Utils.esc(l.name)}`, `
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card" style="border-left:3px solid #f59e0b">
          <div class="stat-label">Gold Pledged</div>
          <div class="stat-value">${goldWeight.toFixed(2)}g</div>
          <div class="stat-sub">${purity} purity (${(purityFactor * 100).toFixed(1)}% pure)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pledged Value</div>
          <div class="stat-value">${Utils.currency(pledgedValue)}</div>
          <div class="stat-sub">${perGramPledged > 0 ? Utils.currency(perGramPledged) + '/gram' : ''}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Loan-to-Value (LTV)</div>
          <div class="stat-value" style="color:${ltvColor}">${ltv.toFixed(1)}%</div>
          <div class="stat-sub">${ltv > 75 ? 'High risk' : ltv > 60 ? 'Moderate' : 'Safe'}</div>
        </div>
        <div class="stat-card red">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">${Utils.currency(outstanding)}</div>
          <div class="stat-sub">Rate: ${rate}% p.a.</div>
        </div>
      </div>

      <div class="card" style="padding:16px;margin-bottom:16px">
        <h4 style="margin:0 0 12px;font-size:0.92rem">Interest Breakdown</h4>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Period</th><th class="text-right">Interest Amount</th></tr></thead>
            <tbody>
              <tr><td>Monthly</td><td class="text-right font-mono text-red">${Utils.currency(monthlyInterest)}</td></tr>
              <tr><td>Quarterly</td><td class="text-right font-mono text-red">${Utils.currency(quarterlyInterest)}</td></tr>
              <tr><td>Half-Yearly</td><td class="text-right font-mono text-red">${Utils.currency(outstanding * rate / 2 / 100)}</td></tr>
              <tr><td>Yearly</td><td class="text-right font-mono text-red">${Utils.currency(outstanding * rate / 100)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      ${tenure > 0 ? `
      <div class="card" style="padding:16px">
        <h4 style="margin:0 0 12px;font-size:0.92rem">Loan Summary (${tenure} months)</h4>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px">
            <div class="text-muted" style="font-size:0.78rem">Total Interest</div>
            <div class="font-mono text-red" style="font-size:1.1rem;font-weight:600">${Utils.currency(totalInterest)}</div>
          </div>
          <div style="flex:1;min-width:120px">
            <div class="text-muted" style="font-size:0.78rem">Total Payable</div>
            <div class="font-mono" style="font-size:1.1rem;font-weight:600">${Utils.currency(totalPayable)}</div>
          </div>
          <div style="flex:1;min-width:120px">
            <div class="text-muted" style="font-size:0.78rem">Interest % of Loan</div>
            <div class="font-mono" style="font-size:1.1rem;font-weight:600">${outstanding > 0 ? (totalInterest / outstanding * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </div>` : ''}
    `);
  },
};
