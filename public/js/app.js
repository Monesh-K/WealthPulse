/**
 * WealthPulse — App Router & Initialization
 */
const App = {
  pages: {
    dashboard: DashboardPage,
    assets: AssetsPage,
    liabilities: LiabilitiesPage,
    goals: GoalsPage,
    transactions: TransactionsPage,
    import: ImportPage,
    snapshots: SnapshotsPage,
    essentials: EssentialsPage,
    calculators: CalculatorsPage,
    settings: SettingsPage,
    marketcharts: MarketChartsPage,
    news: NewsPage,
    aichat: AIChatPage,
  },

  currentPage: null,

  init() {
    // Theme
    const savedTheme = localStorage.getItem('wp_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon();

    // Event listeners
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('hamburger').addEventListener('click', () => this.openSidebar());
    document.getElementById('sidebarClose').addEventListener('click', () => this.closeSidebar());
    document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeSidebar());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) Modal.close();
    });
    document.getElementById('modalClose').addEventListener('click', () => Modal.close());
    document.getElementById('refreshPricesBtn').addEventListener('click', () => this.refreshPrices());

    // Close sidebar on nav click (mobile only)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebarOverlay').classList.remove('active');
        }
      });
    });

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
      const fab = document.getElementById('fabContainer');
      if (fab && !fab.contains(e.target)) {
        App.closeFab();
      }
    });

    // Route handling
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('active');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  },

  openSidebar() {
    this.toggleSidebar();
  },

  closeSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    } else {
      document.body.classList.add('sidebar-collapsed');
    }
  },

  async route() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const page = this.pages[hash];
    if (!page) {
      window.location.hash = '#dashboard';
      return;
    }

    this.currentPage = hash;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === hash);
    });

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      assets: 'Assets & Investments',
      liabilities: 'Liabilities',
      goals: 'Financial Goals',
      transactions: 'Income & Expenses',
      import: 'Import Center',
      snapshots: 'Net Worth Snapshots',
      essentials: 'Financial Essentials',
      calculators: 'Financial Calculators',
      settings: 'Settings',
      marketcharts: 'Market Charts',
      news: 'Financial News',
      aichat: 'AI Chat',
    };
    document.getElementById('pageTitle').textContent = titles[hash] || 'WealthPulse';

    // Destroy existing charts
    Charts.destroyAll();

    // Render page
    const container = document.getElementById('pageContainer');
    container.innerHTML = await page.render();

    // Initialize page (load data, etc.)
    if (page.init) await page.init();

    // Scroll to top
    window.scrollTo(0, 0);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('wp_theme', next);
    this.updateThemeIcon();
  },

  updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';
  },

  async refreshPrices() {
    const btn = document.getElementById('refreshPricesBtn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Refreshing...';
    try {
      const res = await API.refreshPrices();
      Toast.success(`Market prices refreshed! ${res.updated || 0} assets updated.`);
      // Reload current page data without navigating
      const page = this.pages[this.currentPage];
      if (page) {
        const container = document.getElementById('pageContainer');
        container.innerHTML = await page.render();
        if (page.init) await page.init();
      }
    } catch (e) {
      Toast.error('Price refresh failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  },

  // ─── Quick Add FAB ─────────────────────────────
  toggleFab() {
    const btn = document.getElementById('fabBtn');
    const menu = document.getElementById('fabMenu');
    btn.classList.toggle('open');
    menu.classList.toggle('open');
  },

  closeFab() {
    document.getElementById('fabBtn')?.classList.remove('open');
    document.getElementById('fabMenu')?.classList.remove('open');
  },

  async fabAction(action) {
    this.closeFab();
    if (action === 'income' || action === 'expense') {
      // Navigate to transactions and open form
      window.location.hash = '#transactions';
      await new Promise(r => setTimeout(r, 300));
      TransactionsPage.openForm(action);
    } else if (action === 'asset') {
      window.location.hash = '#assets';
      await new Promise(r => setTimeout(r, 300));
      if (AssetsPage.openForm) AssetsPage.openForm();
    } else if (action === 'snapshot') {
      try {
        await API.takeSnapshot();
        Toast.success('Snapshot taken!');
      } catch (e) {
        Toast.error('Snapshot failed: ' + e.message);
      }
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  const authed = await Auth.init();
  if (authed) {
    App.init();
  }
  // Remove loading spinner
  const loader = document.getElementById('appLoader');
  if (loader) loader.remove();
});
