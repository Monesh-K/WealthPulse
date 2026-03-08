/**
 * WealthPulse — AI Chat Page
 */
const AIChatPage = {
  messages: [],

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">AI Chat</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Ask questions about your portfolio</p>
        </div>
      </div>
      <div id="aiChatContent"></div>
    `;
  },

  async init() {
    const aiStatus = await API.getAIStatus().catch(() => ({ enabled: false }));

    if (!aiStatus.enabled) {
      document.getElementById('aiChatContent').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">🤖</div>
            <h3>AI Not Configured</h3>
            <p>Add GROQ_API_KEY to your environment variables to enable AI chat.<br>
            Get a free key at <a href="https://console.groq.com/keys" target="_blank" style="color:var(--accent)">console.groq.com</a></p>
          </div>
        </div>
      `;
      return;
    }

    this.renderChat();
  },

  renderChat() {
    const quickQuestions = [
      'Is my portfolio diversified?',
      'How will my portfolio grow in 10 years?',
      'What is my equity allocation?',
      'Am I overexposed to midcap funds?',
      'What are my top performing assets?',
      'How does my portfolio compare to Nifty 50?',
      'Should I increase my SIP amount?',
      'What is my retirement readiness?',
    ];

    document.getElementById('aiChatContent').innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;height:calc(100vh - 220px);min-height:400px">
        <!-- Chat Messages -->
        <div id="chatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
          ${this.messages.length === 0 ? `
            <div style="text-align:center;padding:40px 20px">
              <div style="font-size:2.5rem;margin-bottom:12px">🤖</div>
              <h3 style="margin-bottom:8px;font-size:1.1rem">Ask me about your portfolio</h3>
              <p class="text-muted" style="font-size:0.85rem;margin-bottom:20px">I can analyze your investments, compare with benchmarks, and provide insights.</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                ${quickQuestions.map(q => `
                  <button class="btn btn-outline btn-sm" onclick="AIChatPage.sendMessage('${q.replace(/'/g, "\\'")}')"
                    style="font-size:0.8rem;padding:6px 12px;border-radius:20px">${q}</button>
                `).join('')}
              </div>
            </div>
          ` : this.messages.map(m => this.renderMessage(m)).join('')}
        </div>

        <!-- Input -->
        <div style="border-top:1px solid var(--border-color);padding:12px 16px;display:flex;gap:8px">
          <input type="text" class="form-control" id="chatInput" placeholder="Ask about your portfolio..."
            style="flex:1;border-radius:20px;padding:8px 16px"
            onkeydown="if(event.key==='Enter')AIChatPage.sendFromInput()">
          <button class="btn btn-primary" onclick="AIChatPage.sendFromInput()" style="border-radius:20px;padding:8px 16px">
            Send
          </button>
        </div>
      </div>
    `;
  },

  renderMessage(msg) {
    if (msg.role === 'user') {
      return `
        <div style="display:flex;justify-content:flex-end">
          <div style="background:var(--accent);color:white;padding:10px 14px;border-radius:16px 16px 4px 16px;max-width:80%;font-size:0.88rem">
            ${Utils.esc(msg.content)}
          </div>
        </div>
      `;
    }
    return `
      <div style="display:flex;justify-content:flex-start;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.85rem">🤖</div>
        <div style="background:var(--bg-secondary);padding:10px 14px;border-radius:4px 16px 16px 16px;max-width:80%;font-size:0.88rem;line-height:1.5">
          ${msg.loading ? '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Thinking...' : this.renderMarkdown(msg.content)}
        </div>
      </div>
    `;
  },

  renderMarkdown(text) {
    if (!text) return '';
    // First escape HTML entities to prevent XSS, then apply markdown transformations
    const escaped = Utils.esc(text);
    return escaped
      .split('\n')
      .map(line => {
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
        if (line.match(/^[\s]*[-•]\s/)) {
          return `<li style="margin-bottom:4px">${line.replace(/^[\s]*[-•]\s/, '')}</li>`;
        }
        if (line.trim() === '') return '';
        return `<p style="margin-bottom:4px">${line}</p>`;
      })
      .join('')
      .replace(/(<li.*?<\/li>)+/g, '<ul style="padding-left:18px;margin:4px 0">$&</ul>');
  },

  sendFromInput() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;
    this.sendMessage(input.value.trim());
    input.value = '';
  },

  async sendMessage(message) {
    // Add user message
    this.messages.push({ role: 'user', content: message });

    // Add loading placeholder
    this.messages.push({ role: 'assistant', content: '', loading: true });
    this.renderChat();

    // Scroll to bottom
    const chatEl = document.getElementById('chatMessages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;

    try {
      const res = await API.chatWithAI(message);
      // Remove loading, add response
      this.messages.pop();
      if (res.success) {
        this.messages.push({ role: 'assistant', content: res.response });
      } else {
        this.messages.push({ role: 'assistant', content: res.error || 'Could not generate response.' });
      }
    } catch (e) {
      this.messages.pop();
      this.messages.push({ role: 'assistant', content: `Error: ${e.message}` });
    }

    this.renderChat();
    const chatEl2 = document.getElementById('chatMessages');
    if (chatEl2) chatEl2.scrollTop = chatEl2.scrollHeight;
  },
};
