/**
 * WealthPulse — Settings Page
 * Profile, target allocation, salary structure, EPF/NPS, backup & restore
 */
const SettingsPage = {
  settings: {},

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Settings</h2>
          <p class="text-m  async saveEpfNps(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const epfNpsConfig = {};
    Object.entries(form).forEach(([k, v]) => {
      epfNpsConfig[k] = k === 'nps_scheme' ? v : Number(v);
    });

    // Auto-calculate NPS monthly from basic pay if salary is configured
    try {
      const settingsRes = await API.getSettings();
      const salary = settingsRes.data?.salaryStructure || {};
      const basicPay = salary.basic_pay || 0;
      if (basicPay > 0) {
        epfNpsConfig.nps_monthly = Math.round(basicPay * (epfNpsConfig.nps_pct || 12) / 100);
      }
    } catch { /* ignore */ }

    try {
      await API.updateSettings({ epfNpsConfig });
      Toast.success('EPF/NPS config saved!');

      // Auto-sync EPF and NPS as assets
      await this.syncRetirementAssets(epfNpsConfig);

      // Reload settings and re-render so saved values appear
      await this.load();
    } catch (err) { Toast.error(err.message); }
  },nt-size:0.85rem; margin-top:4px">Configure preferences, target allocation, salary, backup & restore</p>
        </div>
      </div>
      <div id="settingsContent">
        <div class="loading"><div class="spinner"></div> Loading...</div>
      </div>
    `;
  },

  async init() {
    await this.load();
  },

  async load() {
    try {
      const res = await API.getSettings();
      this.settings = res.data || {};
      this.renderContent();
    } catch (e) {
      document.getElementById('settingsContent').innerHTML = `<div class="empty-state"><p>Error: ${Utils.esc(e.message)}</p></div>`;
    }
  },

  renderContent() {
    const s = this.settings;
    const alloc = s.targetAllocation || {};
    const cats = ['Equity', 'Debt', 'Gold', 'Cash', 'Real Estate', 'International', 'Crypto', 'Retirement'];
    const salary = s.salaryStructure || {};
    const epfNps = s.epfNpsConfig || {};

    document.getElementById('settingsContent').innerHTML = `
      <div class="grid-2">
        <!-- Profile -->
        <div class="card">
          <div class="card-header"><div class="card-title">👤 Profile</div></div>
          <form onsubmit="SettingsPage.saveProfile(event)">
            <div class="form-row">
              <div class="form-group">
                <label>Name</label>
                <input class="form-control" name="name" value="${Utils.esc(s.name || 'User')}">
              </div>
              <div class="form-group">
                <label>Age</label>
                <input class="form-control" type="number" name="age" min="1" max="120" value="${Utils.esc(s.age || '')}" placeholder="e.g. 30">
              </div>
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select class="form-control" name="currency">
                <option value="INR" ${s.currency !== 'USD' ? 'selected' : ''}>₹ INR (Indian Rupee)</option>
                <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>$ USD (US Dollar)</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
          </form>
        </div>

        <!-- Target Allocation -->
        <div class="card">
          <div class="card-header"><div class="card-title">🎯 Target Allocation</div></div>
          <form onsubmit="SettingsPage.saveAllocation(event)">
            ${cats.map(c => `
              <div class="flex-between mb-8" style="align-items:center">
                <label style="font-size:0.85rem; font-weight:500; min-width:120px">${c}</label>
                <div style="display:flex; align-items:center; gap:8px">
                  <input class="form-control" type="number" step="1" min="0" max="100" name="${c}"
                    value="${alloc[c] || 0}" style="width:80px; text-align:right" oninput="SettingsPage.updateAllocTotal()">
                  <span class="text-muted">%</span>
                </div>
              </div>
            `).join('')}
            <div class="flex-between mt-16" style="border-top:1px solid var(--border-color); padding-top:12px">
              <span class="text-muted" style="font-size:0.85rem">Total: <strong id="allocTotal">${cats.reduce((s, c) => s + (alloc[c] || 0), 0)}%</strong></span>
              <button type="submit" class="btn btn-primary btn-sm">Save Allocation</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Family Profiles -->
      <div class="card mt-24">
        <div class="card-header">
          <div class="card-title">👨‍👩‍👧‍👦 Family Profiles</div>
          <button class="btn btn-primary btn-sm" onclick="SettingsPage.openProfileForm()">+ Add Profile</button>
        </div>
        <p class="text-muted" style="font-size:0.82rem; margin-bottom:16px">Manage family member profiles to track net worth separately</p>
        <div id="familyProfilesList">
          <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:12px 0">
            <div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Loading profiles...
          </div>
        </div>
      </div>

      <!-- Salary Structure -->
      <div class="card mt-24">
        <div class="card-header"><div class="card-title">💰 Salary Structure</div></div>
        <p class="text-muted" style="font-size:0.82rem; margin-bottom:16px">Configure your monthly salary breakdown for auto-calculating EPF/NPS contributions</p>
        <form onsubmit="SettingsPage.saveSalary(event)">
          <div class="grid-3">
            <div class="form-group">
              <label>Basic Pay (Monthly)</label>
              <input class="form-control" type="number" step="1" name="basic_pay" value="${salary.basic_pay || 0}" oninput="SettingsPage.previewEPF()">
            </div>
            <div class="form-group">
              <label>HRA</label>
              <input class="form-control" type="number" step="1" name="hra" value="${salary.hra || 0}" oninput="SettingsPage.previewEPF()">
            </div>
            <div class="form-group">
              <label>Special Allowance</label>
              <input class="form-control" type="number" step="1" name="special_allowance" value="${salary.special_allowance || 0}" oninput="SettingsPage.previewEPF()">
            </div>
            <div class="form-group">
              <label>DA (Dearness Allowance)</label>
              <input class="form-control" type="number" step="1" name="da" value="${salary.da || 0}" oninput="SettingsPage.previewEPF()">
            </div>
            <div class="form-group">
              <label>Other Allowances</label>
              <input class="form-control" type="number" step="1" name="other_allowances" value="${salary.other_allowances || 0}" oninput="SettingsPage.previewEPF()">
            </div>
            <div class="form-group">
              <label>Gross Monthly Salary</label>
              <input class="form-control" type="number" step="1" name="gross_salary" value="${salary.gross_salary || 0}" id="grossSalaryField" readonly style="background:var(--bg-secondary)">
            </div>
          </div>
          <div id="epfPreview" style="margin:12px 0; padding:12px; border-radius:8px; background:var(--bg-secondary); font-size:0.85rem"></div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px; gap:8px">
            <button type="button" class="btn btn-outline btn-sm" onclick="SettingsPage.getAISalaryInsight()">🤖 AI Tax Tips</button>
            <button type="submit" class="btn btn-primary btn-sm">Save Salary Structure</button>
          </div>
        </form>
      </div>

      <!-- EPF / NPS Config -->
      <div class="card mt-24">
        <div class="card-header"><div class="card-title">🏛️ EPF & NPS Configuration</div></div>
        <p class="text-muted" style="font-size:0.82rem; margin-bottom:16px">Employee EPF, Employer EPF, and NPS are each <strong>12% of Basic Pay</strong>. Adjust below if needed.</p>
        <form onsubmit="SettingsPage.saveEpfNps(event)">
          <div class="grid-2">
            <div>
              <h4 style="font-size:0.9rem; margin-bottom:12px">Employee Provident Fund (EPF)</h4>
              <div class="form-group">
                <label>Employee Contribution (%)</label>
                <input class="form-control" type="number" step="0.1" name="epf_employee_pct" value="${epfNps.epf_employee_pct ?? 12}" max="100" oninput="SettingsPage.previewEPF()">
                <small class="text-muted">Default: 12% of Basic Pay</small>
              </div>
              <div class="form-group">
                <label>Employer Contribution (%)</label>
                <input class="form-control" type="number" step="0.1" name="epf_employer_pct" value="${epfNps.epf_employer_pct ?? 12}" max="100" oninput="SettingsPage.previewEPF()">
                <small class="text-muted">Default: 12% of Basic Pay (3.67% EPF + 8.33% EPS)</small>
              </div>
              <div class="form-group">
                <label>Current EPF Balance</label>
                <input class="form-control" type="number" step="1" name="epf_balance" value="${epfNps.epf_balance || 0}">
              </div>
              <div class="form-group">
                <label>EPF Interest Rate (%)</label>
                <input class="form-control" type="number" step="0.1" name="epf_interest_rate" value="${epfNps.epf_interest_rate || 8.25}">
              </div>
            </div>
            <div>
              <h4 style="font-size:0.9rem; margin-bottom:12px">National Pension System (NPS)</h4>
              <div class="form-group">
                <label>NPS Contribution (%)</label>
                <input class="form-control" type="number" step="0.1" name="nps_pct" value="${epfNps.nps_pct ?? 12}" max="100" oninput="SettingsPage.previewEPF()">
                <small class="text-muted">Default: 12% of Basic Pay</small>
              </div>
              <div class="form-group">
                <label>NPS Monthly Contribution (auto-calculated)</label>
                <input class="form-control" type="number" step="1" name="nps_monthly" value="${epfNps.nps_monthly || 0}" id="npsMonthlyField" readonly style="background:var(--bg-tertiary)">
                <small class="text-muted">Calculated from Basic × NPS%</small>
              </div>
              <div class="form-group">
                <label>Current NPS Balance</label>
                <input class="form-control" type="number" step="1" name="nps_balance" value="${epfNps.nps_balance || 0}">
              </div>
              <div class="form-group">
                <label>Expected NPS Return (%)</label>
                <input class="form-control" type="number" step="0.1" name="nps_return_rate" value="${epfNps.nps_return_rate || 10}">
              </div>
              <div class="form-group">
                <label>NPS Scheme</label>
                <select class="form-control" name="nps_scheme">
                  <option value="aggressive" ${epfNps.nps_scheme==='aggressive'?'selected':''}>Aggressive (75% Equity)</option>
                  <option value="moderate" ${epfNps.nps_scheme==='moderate'||!epfNps.nps_scheme?'selected':''}>Moderate (50% Equity)</option>
                  <option value="conservative" ${epfNps.nps_scheme==='conservative'?'selected':''}>Conservative (25% Equity)</option>
                </select>
              </div>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px">
            <button type="submit" class="btn btn-primary btn-sm">Save EPF/NPS Config</button>
          </div>
        </form>
      </div>

      <!-- Backup & Restore -->
      <div class="card mt-24">
        <div class="card-header"><div class="card-title">💾 Backup & Restore</div></div>
        <div class="grid-2">
          <div>
            <h4 style="font-size:0.95rem; margin-bottom:8px">Export Data</h4>
            <p class="text-muted mb-16" style="font-size:0.85rem">Download all your data as a JSON backup file</p>
            <button class="btn btn-outline" onclick="SettingsPage.exportData()">📥 Export Backup</button>
          </div>
          <div>
            <h4 style="font-size:0.95rem; margin-bottom:8px">Restore Data</h4>
            <p class="text-muted mb-16" style="font-size:0.85rem">Upload a previously exported backup to restore all data</p>
            <div class="file-upload-zone" onclick="document.getElementById('restoreInput').click()" style="padding:16px">
              <p>Click to select backup file (JSON)</p>
            </div>
            <input type="file" id="restoreInput" accept=".json" style="display:none" onchange="SettingsPage.importData(this.files[0])">
          </div>
        </div>
      </div>

      <!-- Cloud Backup -->
      <div class="card mt-24" id="cloudBackupCard">
        <div class="card-header"><div class="card-title">☁️ Cloud Backup (GitHub Gist)</div></div>
        <div id="cloudBackupStatus" style="padding:4px 0">
          <p class="text-muted" style="font-size:0.85rem">Checking cloud backup status...</p>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card mt-24" style="border-color: var(--red)">
        <div class="card-header"><div class="card-title" style="color:var(--red)">⚠️ Danger Zone</div></div>
        <p class="text-muted mb-16" style="font-size:0.85rem">These actions are irreversible. Be careful!</p>
        <button class="btn btn-danger btn-sm" onclick="SettingsPage.resetData()">🗑️ Reset All Data</button>
      </div>
    `;

    this.previewEPF();
    this.loadCloudBackupStatus();
    this.loadFamilyProfiles();
  },

  async loadCloudBackupStatus() {
    try {
      const res = await API.request('/settings/cloud-backup/status');
      const el = document.getElementById('cloudBackupStatus');
      if (!el) return;
      if (res.data?.enabled) {
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span style="color:var(--green);font-size:1.2rem">●</span>
            <span style="font-size:0.9rem;font-weight:600;color:var(--green)">Active</span>
            <span class="text-muted" style="font-size:0.82rem">— Data auto-saves to GitHub Gist after changes, every 5 min, and on shutdown</span>
          </div>
          ${res.data.lastBackupTime ? `<div class="text-muted" style="font-size:0.82rem;margin-bottom:8px">Last backup: ${new Date(res.data.lastBackupTime).toLocaleString()}</div>` : ''}
          ${res.data.lastRestoreTime ? `<div class="text-muted" style="font-size:0.82rem;margin-bottom:8px">Last restore: ${new Date(res.data.lastRestoreTime).toLocaleString()}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="SettingsPage.cloudBackupSave()">⬆️ Save Now</button>
            <button class="btn btn-outline btn-sm" onclick="SettingsPage.cloudBackupRestore()">⬇️ Restore from Cloud</button>
          </div>`;
      } else {
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="color:var(--text-muted);font-size:1.2rem">○</span>
            <span style="font-size:0.9rem;font-weight:600;color:var(--text-muted)">Not Configured</span>
          </div>
          <p class="text-muted" style="font-size:0.82rem;line-height:1.5">
            To enable cloud backup, set <code>GITHUB_TOKEN</code> and <code>GIST_ID</code> environment variables on your hosting platform.
            This ensures your data survives server restarts on free hosting (Render, etc.).<br>
            <a href="https://github.com/settings/tokens" target="_blank" style="color:var(--primary)">Create GitHub Token</a> →
            <a href="https://gist.github.com" target="_blank" style="color:var(--primary)">Create Gist</a>
          </p>`;
      }
    } catch (e) {
      const el = document.getElementById('cloudBackupStatus');
      if (el) el.innerHTML = `<p class="text-muted" style="font-size:0.85rem">Could not check cloud backup status</p>`;
    }
  },

  async cloudBackupSave() {
    if (!confirm('Save current data to cloud backup?')) return;
    try {
      Toast.info('Saving to cloud...');
      await API.request('/settings/cloud-backup/save', { method: 'POST' });
      Toast.success('Cloud backup saved!');
    } catch (e) { Toast.error('Cloud save failed: ' + e.message); }
  },

  async cloudBackupRestore() {
    if (!confirm('Restore data from cloud backup? This will overwrite local data if the database is empty.')) return;
    try {
      Toast.info('Restoring from cloud...');
      const res = await API.request('/settings/cloud-backup/restore', { method: 'POST' });
      Toast.success(res.message || 'Restore complete');
      setTimeout(() => location.reload(), 1000);
    } catch (e) { Toast.error('Cloud restore failed: ' + e.message); }
  },

  updateAllocTotal() {
    const cats = ['Equity', 'Debt', 'Gold', 'Cash', 'Real Estate', 'International', 'Crypto', 'Retirement'];
    const form = document.querySelector('[onsubmit="SettingsPage.saveAllocation(event)"]');
    if (!form) return;
    const total = cats.reduce((s, c) => {
      const inp = form.querySelector(`input[name="${c}"]`);
      return s + (inp ? Number(inp.value) || 0 : 0);
    }, 0);
    const el = document.getElementById('allocTotal');
    if (el) {
      el.textContent = total + '%';
      el.style.color = total === 100 ? 'var(--green)' : 'var(--red)';
    }
  },

  previewEPF() {
    const el = document.getElementById('epfPreview');
    if (!el) return;
    const basic = Number(document.querySelector('input[name="basic_pay"]')?.value) || 0;
    const da = Number(document.querySelector('input[name="da"]')?.value) || 0;
    const epfWage = basic + da;

    // Read configurable percentages (default 12% each)
    const empPct = Number(document.querySelector('input[name="epf_employee_pct"]')?.value) || 12;
    const erPct = Number(document.querySelector('input[name="epf_employer_pct"]')?.value) || 12;
    const npsPct = Number(document.querySelector('input[name="nps_pct"]')?.value) || 12;

    const employeeEPF = Math.round(epfWage * empPct / 100);
    const employerTotal = Math.round(epfWage * erPct / 100);
    const employerEPS = Math.round(Math.min(epfWage, 15000) * 0.0833);
    const employerEPF = employerTotal - employerEPS;
    const npsMonthly = Math.round(basic * npsPct / 100);

    // Update NPS monthly field
    const npsField = document.getElementById('npsMonthlyField');
    if (npsField) npsField.value = npsMonthly;

    // Also update the hidden nps_monthly input
    const npsInput = document.querySelector('input[name="nps_monthly"]');
    if (npsInput) npsInput.value = npsMonthly;

    // Update gross salary
    const hra = Number(document.querySelector('input[name="hra"]')?.value) || 0;
    const special = Number(document.querySelector('input[name="special_allowance"]')?.value) || 0;
    const other = Number(document.querySelector('input[name="other_allowances"]')?.value) || 0;
    const gross = basic + da + hra + special + other;
    const grossField = document.getElementById('grossSalaryField');
    if (grossField) grossField.value = gross;

    const totalMonthlyRetirement = employeeEPF + employerTotal + npsMonthly;

    el.innerHTML = `
      <strong>Retirement Contribution Preview (Monthly):</strong>
      <div style="display:flex; gap:16px; margin-top:8px; flex-wrap:wrap; font-size:0.85rem">
        <span>EPF Wage (Basic+DA): <strong>${Utils.currency(epfWage)}</strong></span>
        <span>Employee EPF (${empPct}%): <strong class="text-green">${Utils.currency(employeeEPF)}</strong></span>
        <span>Employer EPF (${erPct}%): <strong class="text-green">${Utils.currency(employerTotal)}</strong></span>
        <span style="font-size:0.78rem;color:var(--text-muted)">(EPF: ${Utils.currency(employerEPF)} + EPS: ${Utils.currency(employerEPS)})</span>
      </div>
      <div style="display:flex; gap:16px; margin-top:6px; flex-wrap:wrap; font-size:0.85rem">
        <span>NPS (${npsPct}% of Basic): <strong class="text-green">${Utils.currency(npsMonthly)}</strong></span>
        <span>Total Monthly Retirement: <strong class="text-accent">${Utils.currency(totalMonthlyRetirement)}</strong></span>
        <span>Total Annual: <strong>${Utils.currency(totalMonthlyRetirement * 12)}</strong></span>
      </div>
    `;
  },

  async saveProfile(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    try { await API.updateSettings(form); Toast.success('Profile saved!'); }
    catch (err) { Toast.error(err.message); }
  },

  async saveAllocation(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const targetAllocation = {};
    Object.entries(form).forEach(([k, v]) => { targetAllocation[k] = Number(v); });
    const total = Object.values(targetAllocation).reduce((s, v) => s + v, 0);
    if (total !== 100) { Toast.error(`Allocation must total 100% (currently ${total}%)`); return; }
    try { await API.updateSettings({ targetAllocation }); Toast.success('Target allocation saved!'); }
    catch (err) { Toast.error(err.message); }
  },

  async saveSalary(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const salaryStructure = {};
    Object.entries(form).forEach(([k, v]) => { salaryStructure[k] = Number(v); });

    // Always recalculate gross salary as sum of components
    salaryStructure.gross_salary = (salaryStructure.basic_pay || 0) +
      (salaryStructure.hra || 0) +
      (salaryStructure.da || 0) +
      (salaryStructure.special_allowance || 0) +
      (salaryStructure.other_allowances || 0);

    try {
      await API.updateSettings({ salaryStructure });
      Toast.success('Salary structure saved!');

      // Auto-update NPS monthly contribution in EPF/NPS config if exists
      const settingsRes = await API.getSettings();
      const epfNps = settingsRes.data?.epfNpsConfig || {};
      const basicPay = salaryStructure.basic_pay || 0;
      if (basicPay > 0) {
        const npsPct = epfNps.nps_pct ?? 12;
        epfNps.nps_monthly = Math.round(basicPay * npsPct / 100);
        await API.updateSettings({ epfNpsConfig: epfNps });
        // Re-sync retirement assets
        await this.syncRetirementAssets(epfNps);
      }

      // Reload settings and re-render so saved values appear
      await this.load();
    }
    catch (err) { Toast.error(err.message); }
  },

  async saveEpfNps(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const epfNpsConfig = {};
    Object.entries(form).forEach(([k, v]) => {
      epfNpsConfig[k] = k === 'nps_scheme' ? v : Number(v);
    });
    try {
      await API.updateSettings({ epfNpsConfig });
      Toast.success('EPF/NPS config saved!');

      // Auto-sync EPF and NPS as assets
      await this.syncRetirementAssets(epfNpsConfig);
    } catch (err) { Toast.error(err.message); }
  },

  async syncRetirementAssets(config) {
    try {
      // Get salary to calculate monthly contributions
      let basicPay = 0;
      try {
        const settingsRes = await API.getSettings();
        const salary = settingsRes.data?.salaryStructure || {};
        basicPay = salary.basic_pay || 0;
      } catch { /* ignore */ }

      const da = 0; // DA can be 0 for most
      const epfWage = basicPay + da;
      const empPct = config.epf_employee_pct ?? 12;
      const erPct = config.epf_employer_pct ?? 12;
      const monthlyEmpEPF = Math.round(epfWage * empPct / 100);
      const monthlyErEPF = Math.round(epfWage * erPct / 100);
      const totalMonthlyEPF = monthlyEmpEPF + monthlyErEPF;

      // Sync EPF as an asset if balance > 0
      if (config.epf_balance > 0) {
        const epfAssets = (await API.getAssets({ search: 'EPF' })).data || [];
        const existing = epfAssets.find(a => a.name === 'Employee Provident Fund (EPF)' || (a.subtype || '').toLowerCase().includes('epf'));
        const data = {
          name: 'Employee Provident Fund (EPF)',
          asset_class: 'Fixed Income',
          category: 'Retirement',
          subtype: 'EPF',
          retirement_subtype: 'EPF',
          invested_value: config.epf_balance,
          current_value: config.epf_balance,
          interest_rate: config.epf_interest_rate || 8.25,
          monthly_contribution: totalMonthlyEPF,
          notes: `Auto-synced. Employee ${empPct}% + Employer ${erPct}%. Monthly: ₹${totalMonthlyEPF}`,
        };
        if (existing) { await API.updateAsset(existing.id, data); }
        else { await API.createAsset(data); }
      }

      // Sync NPS as an asset if balance > 0
      const npsPct = config.nps_pct ?? 12;
      const npsMonthly = config.nps_monthly || Math.round(basicPay * npsPct / 100);
      if (config.nps_balance > 0) {
        const npsAssets = (await API.getAssets({ search: 'NPS' })).data || [];
        const existing = npsAssets.find(a => a.name === 'National Pension System (NPS)' || (a.subtype || '').toLowerCase().includes('nps'));
        const data = {
          name: 'National Pension System (NPS)',
          asset_class: 'Fixed Income',
          category: 'Retirement',
          subtype: 'NPS',
          retirement_subtype: 'NPS',
          invested_value: config.nps_balance,
          current_value: config.nps_balance,
          monthly_contribution: npsMonthly,
          notes: `Auto-synced. ${npsPct}% of Basic. Scheme: ${config.nps_scheme || 'moderate'}, Expected: ${config.nps_return_rate || 10}%`,
        };
        if (existing) { await API.updateAsset(existing.id, data); }
        else { await API.createAsset(data); }
      }

      Toast.info('EPF & NPS synced as assets');
    } catch (err) {
      console.error('EPF/NPS asset sync failed:', err);
    }
  },

  // ─── Family Profiles ────────────────────────────
  async loadFamilyProfiles() {
    const container = document.getElementById('familyProfilesList');
    if (!container) return;

    try {
      const res = await API.getProfiles();
      const profiles = res.data || [];
      const profileColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316'];

      if (!profiles.length) {
        container.innerHTML = `
          <div class="empty-state" style="padding:24px">
            <p class="text-muted">No profiles yet. Add family members to track their finances separately.</p>
            <button class="btn btn-primary btn-sm" onclick="SettingsPage.openProfileForm()" style="margin-top:8px">+ Add Profile</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${profiles.map((p, i) => {
            const color = p.color || profileColors[i % profileColors.length];
            const assetCount = p.assetCount || 0;
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-secondary);border-radius:8px">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
                  <div>
                    <strong style="font-size:0.9rem">${Utils.esc(p.name)}</strong>
                    ${p.relationship ? `<span class="text-muted" style="font-size:0.8rem;margin-left:6px">(${Utils.esc(p.relationship)})</span>` : ''}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="text-muted" style="font-size:0.8rem">${assetCount} asset${assetCount !== 1 ? 's' : ''}</span>
                  <div class="btn-group">
                    <button class="btn-icon" onclick="SettingsPage.openProfileForm('${p.id}')" title="Edit">✏️</button>
                    <button class="btn-icon danger" onclick="SettingsPage.deleteProfile('${p.id}')" title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p class="text-muted" style="font-size:0.85rem">Could not load profiles.</p>`;
    }
  },

  openProfileForm(id) {
    // If editing, find the profile from the DOM data or re-fetch
    const isEdit = !!id;

    // Pre-fill fields if editing - we'll fetch the data
    if (isEdit) {
      this._openProfileFormWithData(id);
    } else {
      this._renderProfileModal({}, false);
    }
  },

  async _openProfileFormWithData(id) {
    try {
      const res = await API.getProfiles();
      const profiles = res.data || [];
      const profile = profiles.find(p => p.id === id) || {};
      this._renderProfileModal(profile, true);
    } catch {
      this._renderProfileModal({}, false);
    }
  },

  _renderProfileModal(profile, isEdit) {
    const colorOptions = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#ef4444', '#64748b'];

    Modal.open(isEdit ? 'Edit Profile' : 'Add Profile', `
      <form onsubmit="SettingsPage.saveProfile2(event, '${profile.id || ''}')">
        <div class="form-group">
          <label>Name *</label>
          <input class="form-control" name="name" value="${Utils.esc(profile.name || '')}" required placeholder="e.g. Spouse, Child">
        </div>
        <div class="form-group">
          <label>Relationship</label>
          <select class="form-control" name="relationship">
            <option value="">Select...</option>
            ${['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(r =>
              `<option value="${r}" ${profile.relationship === r ? 'selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            ${colorOptions.map(c => `
              <label style="cursor:pointer">
                <input type="radio" name="color" value="${c}" ${(profile.color || '#6366f1') === c ? 'checked' : ''} style="display:none">
                <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${(profile.color || '#6366f1') === c ? 'var(--text-primary)' : 'transparent'};transition:border 0.15s"></span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Profile</button>
        </div>
      </form>
    `);
  },

  async saveProfile2(e, id) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    try {
      if (id) {
        await API.updateProfile(id, form);
        Toast.success('Profile updated!');
      } else {
        await API.createProfile(form);
        Toast.success('Profile added!');
      }
      Modal.close();
      this.loadFamilyProfiles();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteProfile(id) {
    const ok = await Modal.confirm('Delete Profile', 'Delete this family profile? Assets assigned to it will be unlinked.');
    if (!ok) return;
    try {
      await API.deleteProfile(id);
      Toast.success('Profile deleted');
      this.loadFamilyProfiles();
    } catch (e) { Toast.error(e.message); }
  },

  async getAISalaryInsight() {
    const salary = this.settings.salaryStructure || {};
    const epfNps = this.settings.epfNpsConfig || {};
    const data = {
      basic_pay: salary.basic_pay || 0,
      hra: salary.hra || 0,
      da: salary.da || 0,
      special_allowance: salary.special_allowance || 0,
      other_allowances: salary.other_allowances || 0,
      gross_salary: (salary.basic_pay || 0) + (salary.hra || 0) + (salary.da || 0) + (salary.special_allowance || 0) + (salary.other_allowances || 0),
      epf_employee_pct: epfNps.epf_employee_pct ?? 12,
      epf_employer_pct: epfNps.epf_employer_pct ?? 12,
      nps_pct: epfNps.nps_pct ?? 0,
    };

    Modal.open('🤖 AI Tax Optimization Tips', `
      <div id="aiSalaryInsight">
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:20px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing salary structure...
        </div>
      </div>
    `);

    try {
      const result = await API.getAIInsight('salary', data);
      const container = document.getElementById('aiSalaryInsight');
      if (container) {
        if (result.success && result.insight) {
          container.innerHTML = this._renderMarkdown(result.insight);
        } else {
          container.innerHTML = `<p class="text-muted">${result.error || 'Could not generate insight'}</p>`;
        }
      }
    } catch (err) {
      const container = document.getElementById('aiSalaryInsight');
      if (container) container.innerHTML = `<p class="text-muted">AI unavailable: ${err.message}</p>`;
    }
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

  async exportData() {
    try {
      const res = await API.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wealthpulse-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Backup downloaded!');
    } catch (e) { Toast.error(e.message); }
  },

  async importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = await Modal.confirm('Restore Data', 'This will REPLACE all current data. Are you sure?');
      if (!ok) return;
      await API.importData(data);
      Toast.success('Data restored successfully!');
      window.location.reload();
    } catch (e) { Toast.error('Restore failed: ' + e.message); }
  },

  async resetData() {
    const ok = await Modal.confirm('Reset All Data', 'This will DELETE everything. This cannot be undone. Are you absolutely sure?');
    if (!ok) return;
    try {
      await API.importData({ assets: [], liabilities: [], goals: [], transactions: [], snapshots: [] });
      Toast.success('All data reset!');
      window.location.reload();
    } catch (e) { Toast.error(e.message); }
  },
};
