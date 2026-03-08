/**
 * WealthPulse — Utility Functions
 */
const Utils = {
  // Format currency
  currency(val, currency = 'INR') {
    if (val == null || isNaN(val)) return '₹0';
    const abs = Math.abs(val);
    if (currency === 'USD') {
      return (val < 0 ? '-' : '') + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    if (abs >= 10000000) return (val < 0 ? '-' : '') + '₹' + (abs / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return (val < 0 ? '-' : '') + '₹' + (abs / 100000).toFixed(2) + ' L';
    if (abs >= 1000) return (val < 0 ? '-' : '') + '₹' + (abs / 1000).toFixed(1) + ' K';
    return (val < 0 ? '-' : '') + '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  // Full currency format (no abbreviation)
  currencyFull(val) {
    if (val == null || isNaN(val)) return '₹0';
    return (val < 0 ? '-₹' : '₹') + Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  // Percent format
  percent(val, decimals = 1) {
    if (val == null || isNaN(val)) return '0%';
    return val.toFixed(decimals) + '%';
  },

  // Gain/loss class
  gainClass(val) { return val >= 0 ? 'positive' : 'negative'; },
  gainColor(val) { return val >= 0 ? 'text-green' : 'text-red'; },

  // Date format
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatMonth(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + '-01');
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  },

  // Category badge
  categoryBadge(cat) {
    const map = {
      'Equity': 'badge-equity',
      'Debt': 'badge-debt',
      'Gold': 'badge-gold',
      'Cash': 'badge-cash',
      'Real Estate': 'badge-real-estate',
      'International': 'badge-international',
      'Crypto': 'badge-crypto',
    };
    return `<span class="badge ${map[cat] || 'badge-other'}">${cat || 'Other'}</span>`;
  },

  // Generate unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Debounce
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },

  // Escape HTML
  esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  },

  // XIRR calculation (simple approximation using Newton-Raphson)
  xirr(investedValue, currentValue, daysHeld) {
    if (!investedValue || investedValue <= 0 || !currentValue || daysHeld <= 0) return null;
    const years = daysHeld / 365.25;
    if (years < 0.01) return null;
    // CAGR-based XIRR approximation
    const ratio = currentValue / investedValue;
    const xirr = (Math.pow(ratio, 1 / years) - 1) * 100;
    return isFinite(xirr) ? xirr : null;
  },

  // Calculate days since date
  daysSince(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24)));
  },

  // Truncate text with ellipsis
  truncateText(str, maxLen = 20) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  },

  // Format number with commas (Indian numbering)
  formatNumber(val) {
    if (val == null || isNaN(val)) return '0';
    return Number(val).toLocaleString('en-IN');
  },

  // Calculate years between two dates
  yearsBetween(dateStr1, dateStr2) {
    if (!dateStr1) return 0;
    const d1 = new Date(dateStr1);
    const d2 = dateStr2 ? new Date(dateStr2) : new Date();
    return Math.max(0, (d2 - d1) / (365.25 * 24 * 60 * 60 * 1000));
  },
};

// Toast notification system
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const safeMessage = Utils.esc(message);
    toast.innerHTML = `
      <span class="toast-msg">${safeMessage}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
};

// Modal manager
const Modal = {
  open(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
  },
  close() {
    document.getElementById('modalOverlay').classList.remove('active');
  },
  confirm(title, message) {
    return new Promise(resolve => {
      this.open(title, `
        <p style="margin-bottom:20px; color:var(--text-secondary)">${message}</p>
        <div style="display:flex; gap:8px; justify-content:flex-end">
          <button class="btn btn-outline" onclick="Modal.close(); window._modalResolve(false)">Cancel</button>
          <button class="btn btn-danger" onclick="Modal.close(); window._modalResolve(true)">Delete</button>
        </div>
      `);
      window._modalResolve = resolve;
    });
  },
};
