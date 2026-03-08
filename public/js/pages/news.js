/**
 * WealthPulse — Financial News Page
 */
const NewsPage = {
  items: [],
  activeCategory: 'All',

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Financial News</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Latest market and financial news</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="NewsPage.load()" id="newsRefreshBtn">🔄 Refresh</button>
      </div>
      <div id="newsContent">
        <div class="loading"><div class="spinner"></div> Loading news...</div>
      </div>
    `;
  },

  async init() {
    await this.load();
  },

  async load() {
    try {
      const res = await API.getNews();
      this.items = res.data || [];
      this.renderContent();
    } catch (e) {
      document.getElementById('newsContent').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">📰</div>
            <h3>Could not load news</h3>
            <p>${e.message}</p>
          </div>
        </div>
      `;
    }
  },

  renderContent() {
    if (!this.items.length) {
      document.getElementById('newsContent').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">📰</div>
            <h3>No news available</h3>
            <p>Try refreshing in a few minutes</p>
          </div>
        </div>
      `;
      return;
    }

    const categories = ['All', ...new Set(this.items.map(n => n.category))];
    const filtered = this.activeCategory === 'All' ? this.items : this.items.filter(n => n.category === this.activeCategory);

    document.getElementById('newsContent').innerHTML = `
      <!-- Category Tabs -->
      <div class="card" style="padding:8px 12px;margin-bottom:16px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${categories.map(cat => `
            <button class="btn btn-sm ${cat === this.activeCategory ? 'btn-primary' : 'btn-outline'}"
              onclick="NewsPage.filterCategory('${cat}')" style="font-size:0.82rem;padding:4px 12px">
              ${cat}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- News Items -->
      <div style="display:flex;flex-direction:column;gap:8px">
        ${filtered.map((item, idx) => {
          const timeAgo = this.timeAgo(new Date(item.publishedAt));
          return `
            <div class="card" style="padding:14px 16px;cursor:pointer;transition:transform 0.1s,box-shadow 0.1s"
              onclick="NewsPage.openArticle(${idx})"
              onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
              onmouseleave="this.style.transform='';this.style.boxShadow=''">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="flex:1">
                  <div style="font-size:0.92rem;font-weight:500;color:var(--text-primary);line-height:1.4">
                    ${Utils.esc(item.title)}
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:0.78rem;color:var(--text-muted)">
                    ${item.source ? `<span style="font-weight:500">${Utils.esc(item.source)}</span><span>·</span>` : ''}
                    <span>${timeAgo}</span>
                    <span>·</span>
                    <span class="badge" style="font-size:0.7rem;padding:2px 6px">${Utils.esc(item.category)}</span>
                  </div>
                </div>
                <div style="color:var(--text-muted);font-size:0.85rem;padding-top:2px">›</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  openArticle(idx) {
    const filtered = this.activeCategory === 'All' ? this.items : this.items.filter(n => n.category === this.activeCategory);
    const item = filtered[idx];
    if (!item || !item.url) return;
    // Open article directly in new tab
    window.open(item.url, '_blank', 'noopener');
  },

  async loadArticleContent(url) {
    const container = document.getElementById('newsArticleBody');
    if (!container) return;
    try {
      const res = await API.getArticleContent(url);
      if (res.success && res.content) {
        const paragraphs = res.content.split('\n\n').filter(p => p.trim().length > 0);
        let html = '';
        if (res.image) {
          html += `<img src="${Utils.esc(res.image)}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:16px" onerror="this.style.display='none'">`;
        }
        html += '<div style="font-size:0.92rem;line-height:1.75;color:var(--text-primary)">';
        html += paragraphs.map(p => `<p style="margin:0 0 12px 0">${Utils.esc(p)}</p>`).join('');
        html += '</div>';
        if (res.description && paragraphs.length < 3) {
          html += `<p style="font-size:0.88rem;color:var(--text-secondary);font-style:italic;margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:8px">${Utils.esc(res.description)}</p>`;
        }
        container.innerHTML = html;
      } else {
        container.innerHTML = `
          <div style="text-align:center;padding:24px;color:var(--text-muted)">
            <p style="margin-bottom:12px">Could not extract article content. The source may block automated reading.</p>
            <a href="${Utils.esc(url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="text-decoration:none">Read on Source Website</a>
          </div>
        `;
      }
    } catch (e) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted)">
          <p style="margin-bottom:12px">Failed to load article.</p>
          <a href="${Utils.esc(url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="text-decoration:none">Read on Source Website</a>
        </div>
      `;
    }
  },

  filterCategory(cat) {
    this.activeCategory = cat;
    this.renderContent();
  },

  timeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },
};
