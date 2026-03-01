/**
 * WealthPulse — Goals Page
 */
const GoalsPage = {
  items: [],
  assetNames: [],

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Financial Goals</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Plan and track progress towards your financial targets</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="GoalsPage.openForm()">+ Add Goal</button>
      </div>
      <div id="goalsContent">
        <div class="loading"><div class="spinner"></div> Loading goals...</div>
      </div>
    `;
  },

  async init() {
    await Promise.all([this.load(), this.loadAssetNames()]);
  },

  async load() {
    try {
      const res = await API.getGoals();
      this.items = res.data || [];
      this.renderContent();
    } catch (e) {
      document.getElementById('goalsContent').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  async loadAssetNames() {
    try {
      const res = await API.getAssetNames();
      this.assetNames = res.data || [];
    } catch (e) { console.error('Failed to load asset names:', e); }
  },

  renderContent() {
    if (!this.items.length) {
      document.getElementById('goalsContent').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">🎯</div>
            <h3>No goals yet</h3>
            <p>Create financial goals to track your progress</p>
            <button class="btn btn-primary btn-sm" onclick="GoalsPage.openForm()">+ Create Goal</button>
          </div>
        </div>
      `;
      return;
    }

    const now = new Date().getFullYear();
    document.getElementById('goalsContent').innerHTML = `
      <div class="goals-grid">
        ${this.items.map(g => {
          const years = Math.max((g.target_year || 2030) - now, 0);
          const inflAdj = g.target_amount * Math.pow(1 + (g.inflation || 6) / 100, years);
          const pct = inflAdj > 0 ? Math.min((g.current_value / inflAdj) * 100, 100) : 0;
          const gap = Math.max(inflAdj - g.current_value, 0);
          const cls = pct >= 75 ? 'green' : pct >= 40 ? 'yellow' : 'red';
          const monthlyNeeded = years > 0 ? gap / (years * 12) : gap;

          // Find linked asset details
          const linkedAsset = g.linked_asset ? this.assetNames.find(a => a.name === g.linked_asset || a.id === g.linked_asset) : null;

          return `
            <div class="card">
              <div class="card-header">
                <div class="card-title">🎯 ${Utils.esc(g.name)}</div>
                <div class="btn-group">
                  <button class="btn-icon" onclick="GoalsPage.openForm('${g.id}')" title="Edit">✏️</button>
                  <button class="btn-icon danger" onclick="GoalsPage.deleteItem('${g.id}')" title="Delete">🗑️</button>
                </div>
              </div>

              <div class="progress-bar mb-8" style="height:10px">
                <div class="progress-fill ${cls}" style="width:${pct}%"></div>
              </div>
              <div class="flex-between mb-16" style="font-size:0.82rem">
                <span class="${Utils.gainColor(pct >= 50 ? 1 : -1)}" style="font-weight:600">${Utils.percent(pct)}</span>
                <span class="text-muted">${years > 0 ? years + ' years left' : 'Target year reached'}</span>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem">
                <div>
                  <div class="text-muted" style="font-size:0.75rem">Current Value</div>
                  <div style="font-weight:600">${Utils.currency(g.current_value)}</div>
                </div>
                <div>
                  <div class="text-muted" style="font-size:0.75rem">Target (Nominal)</div>
                  <div style="font-weight:600">${Utils.currency(g.target_amount)}</div>
                </div>
                <div>
                  <div class="text-muted" style="font-size:0.75rem">Inflation-Adjusted Target</div>
                  <div style="font-weight:600">${Utils.currency(inflAdj)}</div>
                </div>
                <div>
                  <div class="text-muted" style="font-size:0.75rem">Gap</div>
                  <div style="font-weight:600; color:var(--red)">${Utils.currency(gap)}</div>
                </div>
              </div>

              ${years > 0 ? `
                <div style="margin-top:12px; padding:10px; background:var(--accent-bg); border-radius:8px; font-size:0.82rem">
                  💡 Monthly SIP needed: <strong>${Utils.currency(monthlyNeeded)}</strong>
                </div>
              ` : ''}

              ${linkedAsset ? `
                <div style="margin-top:8px; padding:8px 10px; background:var(--bg-tertiary); border-radius:8px; font-size:0.8rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap">
                  🔗 <strong>${Utils.esc(linkedAsset.name)}</strong>
                  <span class="badge badge-other" style="font-size:0.7rem">${Utils.esc(linkedAsset.category || '')}</span>
                  <span class="text-muted" style="margin-left:auto">${Utils.currency(linkedAsset.current_value_inr)}</span>
                </div>
              ` : g.linked_asset ? `
                <div style="margin-top:8px; font-size:0.8rem; color:var(--text-muted)">
                  🔗 Linked to: ${Utils.esc(g.linked_asset)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  openForm(id) {
    const g = id ? this.items.find(x => x.id === id) : {};
    const isEdit = !!id;

    // Group assets by class for the dropdown
    const grouped = {};
    this.assetNames.forEach(a => {
      const cls = a.asset_class || 'Other';
      if (!grouped[cls]) grouped[cls] = [];
      grouped[cls].push(a);
    });

    Modal.open(isEdit ? 'Edit Goal' : 'Create Goal', `
      <form id="goalForm" onsubmit="GoalsPage.save(event, '${id || ''}')">
        <div class="form-group">
          <label>Goal Name *</label>
          <input class="form-control" name="name" value="${Utils.esc(g.name || '')}" required placeholder="e.g. Retirement Fund, Child Education">
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Target Amount (₹)</label>
            <input class="form-control" type="number" step="0.01" name="target_amount" value="${g.target_amount || 0}">
          </div>
          <div class="form-group">
            <label>Current Value (₹)</label>
            <input class="form-control" type="number" step="0.01" name="current_value" value="${g.current_value || 0}" id="goalCurrentValue">
          </div>
          <div class="form-group">
            <label>Target Year</label>
            <input class="form-control" type="number" name="target_year" value="${g.target_year || new Date().getFullYear() + 5}" min="2024" max="2100">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Inflation Rate (%)</label>
            <input class="form-control" type="number" step="0.1" name="inflation" value="${g.inflation || 6}">
          </div>
          <div class="form-group">
            <label>Linked Asset</label>
            <select class="form-control" name="linked_asset" id="goalLinkedAsset" onchange="GoalsPage.onLinkedAssetChange()">
              <option value="">— None (manual value) —</option>
              ${Object.keys(grouped).sort().map(cls => `
                <optgroup label="${Utils.esc(cls)}">
                  ${grouped[cls].map(a => `
                    <option value="${Utils.esc(a.name)}" data-value="${a.current_value_inr}" ${g.linked_asset === a.name ? 'selected' : ''}>
                      ${Utils.esc(a.name)} (${Utils.currency(a.current_value_inr)})
                    </option>
                  `).join('')}
                </optgroup>
              `).join('')}
            </select>
            <span class="text-muted" style="font-size:0.75rem; margin-top:4px; display:block">Selecting an asset auto-fills the current value</span>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" name="notes" rows="2">${Utils.esc(g.notes || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Goal</button>
        </div>
      </form>
    `);

    // If editing with linked asset, trigger value fill
    if (g.linked_asset) this.onLinkedAssetChange();
  },

  onLinkedAssetChange() {
    const select = document.getElementById('goalLinkedAsset');
    const cvInput = document.getElementById('goalCurrentValue');
    if (!select || !cvInput) return;
    const opt = select.options[select.selectedIndex];
    if (opt && opt.dataset.value) {
      cvInput.value = Number(opt.dataset.value).toFixed(2);
    }
  },

  async save(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.target_amount = Number(form.target_amount);
    form.current_value = Number(form.current_value);
    form.target_year = Number(form.target_year);
    form.inflation = Number(form.inflation);
    try {
      if (id) { await API.updateGoal(id, form); Toast.success('Goal updated!'); }
      else { await API.createGoal(form); Toast.success('Goal created!'); }
      Modal.close();
      await this.load();
    } catch (e) { Toast.error(e.message); }
  },

  async deleteItem(id) {
    const ok = await Modal.confirm('Delete Goal', 'Delete this goal?');
    if (!ok) return;
    try { await API.deleteGoal(id); Toast.success('Deleted'); await this.load(); }
    catch (e) { Toast.error(e.message); }
  },
};
