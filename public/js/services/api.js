/**
 * WealthPulse — API Service
 * Centralized HTTP client for all backend calls
 */
const API = {
  BASE: '/api',
  _token: localStorage.getItem('wp_auth_token') || null,

  setToken(token) {
    this._token = token;
    if (token) {
      localStorage.setItem('wp_auth_token', token);
    } else {
      localStorage.removeItem('wp_auth_token');
    }
  },

  getToken() {
    return this._token;
  },

  async request(endpoint, options = {}) {
    const url = this.BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };

    // Attach auth token
    if (this._token) {
      config.headers['Authorization'] = 'Bearer ' + this._token;
    }

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }
    if (config.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    try {
      const res = await fetch(url, config);

      // Handle auth errors — redirect to login
      if (res.status === 401) {
        this.setToken(null);
        if (typeof Auth !== 'undefined' && Auth.showLogin) {
          Auth.showLogin();
        }
        throw new Error('Session expired. Please sign in again.');
      }

      const data = await res.json();
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Dashboard
  getDashboard() { return this.request('/dashboard'); },

  // Assets
  getAssets(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('/assets' + (qs ? '?' + qs : ''));
  },
  getAsset(id) { return this.request(`/assets/${id}`); },
  createAsset(data) { return this.request('/assets', { method: 'POST', body: data }); },
  updateAsset(id, data) { return this.request(`/assets/${id}`, { method: 'PUT', body: data }); },
  deleteAsset(id) { return this.request(`/assets/${id}`, { method: 'DELETE' }); },
  bulkAssets(assets) { return this.request('/assets/bulk', { method: 'POST', body: { assets } }); },
  getAssetAllocation() { return this.request('/assets/allocation'); },
  getAssetNames() { return this.request('/assets/names'); },
  mergeAssetDuplicates() { return this.request('/assets/merge-duplicates', { method: 'POST' }); },
  getAssetFilters() { return this.request('/assets/filters'); },

  // Liabilities
  getLiabilities() { return this.request('/liabilities'); },
  createLiability(data) { return this.request('/liabilities', { method: 'POST', body: data }); },
  updateLiability(id, data) { return this.request(`/liabilities/${id}`, { method: 'PUT', body: data }); },
  deleteLiability(id) { return this.request(`/liabilities/${id}`, { method: 'DELETE' }); },

  // Goals
  getGoals() { return this.request('/goals'); },
  createGoal(data) { return this.request('/goals', { method: 'POST', body: data }); },
  updateGoal(id, data) { return this.request(`/goals/${id}`, { method: 'PUT', body: data }); },
  deleteGoal(id) { return this.request(`/goals/${id}`, { method: 'DELETE' }); },

  // Transactions
  getTransactions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('/transactions' + (qs ? '?' + qs : ''));
  },
  getTransactionSummary(months = 12) { return this.request(`/transactions/summary?months=${months}`); },
  getTransactionCategories(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('/transactions/categories' + (qs ? '?' + qs : ''));
  },
  getTransactionSubcategories(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('/transactions/subcategories' + (qs ? '?' + qs : ''));
  },
  getSubcategoryList(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('/transactions/subcategory-list' + (qs ? '?' + qs : ''));
  },
  createTransaction(data) { return this.request('/transactions', { method: 'POST', body: data }); },
  updateTransaction(id, data) { return this.request(`/transactions/${id}`, { method: 'PUT', body: data }); },
  deleteTransaction(id) { return this.request(`/transactions/${id}`, { method: 'DELETE' }); },

  // Snapshots
  getSnapshots() { return this.request('/snapshots'); },
  takeSnapshot() { return this.request('/snapshots', { method: 'POST' }); },
  deleteSnapshot(id) { return this.request(`/snapshots/${id}`, { method: 'DELETE' }); },

  // Essentials
  getEssentials() { return this.request('/essentials'); },
  updateEssentials(data) { return this.request('/essentials', { method: 'PUT', body: data }); },

  // Settings
  getSettings() { return this.request('/settings'); },
  updateSettings(data) { return this.request('/settings', { method: 'PUT', body: data }); },
  exportData() { return this.request('/settings/export'); },
  importData(data) { return this.request('/settings/import', { method: 'POST', body: { data } }); },

  // Market
  refreshPrices() { return this.request('/market/refresh', { method: 'POST' }); },
  getMarketStatus() { return this.request('/market/status'); },
  getMFNav(code) { return this.request(`/market/mf/${code}`); },
  getStockPrice(ticker) { return this.request(`/market/stock/${ticker}`); },
  getGoldPrice() { return this.request('/market/gold'); },
  getForexRate() { return this.request('/market/forex'); },

  // File Import
  importAssetFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('/import/assets', { method: 'POST', body: fd });
  },
  importTransactionFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('/import/transactions', { method: 'POST', body: fd });
  },
  importAutoDetect(file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('/import/auto', { method: 'POST', body: fd });
  },
  importPreview(file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('/import/preview', { method: 'POST', body: fd });
  },

  // Bank Accounts
  getBankAccounts() { return this.request('/bank-accounts'); },
  createBankAccount(data) { return this.request('/bank-accounts', { method: 'POST', body: data }); },
  updateBankAccount(id, data) { return this.request(`/bank-accounts/${id}`, { method: 'PUT', body: data }); },
  deleteBankAccount(id) { return this.request(`/bank-accounts/${id}`, { method: 'DELETE' }); },
  getBankAccountSummary() { return this.request('/bank-accounts/summary'); },

  // AI Insights
  getAIInsight(type, data = {}) { return this.request('/ai/insight', { method: 'POST', body: { type, data } }); },
  getAIStatus() { return this.request('/ai/status'); },

  // Auth
  getAuthStatus() { return this.request('/auth/status'); },
  googleSignIn(credential) { return this.request('/auth/google', { method: 'POST', body: { credential } }); },
  getMe() { return this.request('/auth/me'); },
  signOut() { return this.request('/auth/signout', { method: 'POST' }); },
  deleteAccount() { return this.request('/auth/account', { method: 'DELETE' }); },
};
