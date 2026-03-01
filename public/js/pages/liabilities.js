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
                <td><strong>${Utils.esc(l.name)}</strong>${l.notes ? `<br><span class="text-muted" style="font-size:0.78rem">${Utils.esc(l.notes)}</span>` : ''}</td>
                <td><span class="badge badge-expense">${Utils.esc(l.type)}</span></td>
                <td class="text-right font-mono text-red">${Utils.currencyFull(l.outstanding)}</td>
                <td class="text-right font-mono">${l.rate}%</td>
                <td class="text-right font-mono">${Utils.currencyFull(l.emi)}</td>
                <td class="text-right font-mono">${l.tenure ? l.tenure + ' mo' : '-'}</td>
                <td class="text-center">
                  <div class="btn-group" style="justify-content:center">
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
    Modal.open(isEdit ? 'Edit Liability' : 'Add Liability', `
      <form id="liabilityForm" onsubmit="LiabilitiesPage.save(event, '${id || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label>Name *</label>
            <input class="form-control" name="name" value="${Utils.esc(l.name || '')}" required>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select class="form-control" name="type">
              ${['Home Loan','Car Loan','Personal Loan','Credit Card','Education Loan','Other'].map(t =>
                `<option ${l.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
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

  async save(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.outstanding = Number(form.outstanding);
    form.rate = Number(form.rate);
    form.emi = Number(form.emi);
    form.tenure = Number(form.tenure);
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
};
