/**
 * WealthPulse — Chart Helpers
 * Wrapper around Chart.js for consistent styling
 */
const Charts = {
  instances: {},

  colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#64748b'],

  _chartReady() {
    return typeof Chart !== 'undefined';
  },

  /** Wait for Chart.js to become available (up to 3 seconds — should be instant since it's local now) */
  async waitForChartJs() {
    if (typeof Chart !== 'undefined') return true;
    return new Promise((resolve) => {
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (typeof Chart !== 'undefined') { clearInterval(iv); resolve(true); }
        else if (tries > 30) { clearInterval(iv); console.error('[Charts] Chart.js failed to load'); resolve(false); }
      }, 100);
    });
  },

  /** Ensure Chart.js is loaded before rendering */
  async _ensureReady() {
    if (this._chartReady()) return true;
    console.warn('[Charts] Waiting for Chart.js...');
    return await this.waitForChartJs();
  },

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: isDark ? '#a0a5bd' : '#5a6178',
      grid: isDark ? '#2d3154' : '#e2e6ef',
      bg: isDark ? '#1a1d2e' : '#ffffff',
    };
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  destroyAll() {
    Object.keys(this.instances).forEach(id => this.destroy(id));
  },

  // Doughnut chart for allocation
  async doughnut(canvasId, labels, data, options = {}) {
    if (!await this._ensureReady()) return null;
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const theme = this.getThemeColors();
    this.instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: this.colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: theme.bg,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.text, padding: 12, font: { size: 12 }, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${Utils.currency(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
        ...options,
      },
    });
    return this.instances[canvasId];
  },

  // Line chart for trends
  async line(canvasId, labels, datasets, options = {}) {
    if (!await this._ensureReady()) return null;
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const theme = this.getThemeColors();
    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color || this.colors[i],
          backgroundColor: (ds.color || this.colors[i]) + '20',
          fill: ds.fill !== false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          ...ds,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { color: theme.grid },
            ticks: { color: theme.text, font: { size: 11 } },
          },
          y: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              font: { size: 11 },
              callback: val => Utils.currency(val),
            },
          },
        },
        plugins: {
          legend: {
            labels: { color: theme.text, padding: 12, font: { size: 12 }, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${Utils.currency(ctx.parsed.y)}`,
            },
          },
        },
        ...options,
      },
    });
    return this.instances[canvasId];
  },

  // Bar chart
  async bar(canvasId, labels, datasets, options = {}) {
    if (!await this._ensureReady()) return null;
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const theme = this.getThemeColors();
    
    const defaultScales = {
      x: {
        grid: { display: false },
        ticks: { color: theme.text, font: { size: 11 } },
      },
      y: {
        grid: { color: theme.grid },
        ticks: {
          color: theme.text,
          font: { size: 11 },
          callback: val => Utils.currency(val),
        },
      },
    };
    
    const mergedOptions = {
      responsive: true,
      maintainAspectRatio: false,
      ...(options.indexAxis ? { indexAxis: options.indexAxis } : {}),
      scales: { ...defaultScales, ...(options.scales || {}) },
      plugins: {
        legend: {
          labels: { color: theme.text, padding: 12, font: { size: 12 }, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Utils.currency(ctx.parsed.y)}`,
          },
        },
        ...(options.plugins || {}),
      },
    };
    
    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color || this.colors[i],
          borderRadius: 6,
          borderSkipped: false,
          ...ds,
        })),
      },
      options: mergedOptions,
    });
    return this.instances[canvasId];
  },
};
