/**
 * WealthPulse — Auth Module
 * Google Sign-In (OAuth2 popup), session management, login/logout UI
 */
const Auth = {
  user: null,
  authEnabled: false,
  googleClientId: null,
  _gsiReady: false,

  async init() {
    try {
      const status = await API.getAuthStatus();
      this.authEnabled = status.authEnabled;
      this.googleClientId = status.googleClientId;

      if (!this.authEnabled) {
        // No Google Client ID → local mode, no login needed
        return true;
      }

      // Load Google Identity Services immediately
      await this.loadGoogleScript();

      // Check for stored token
      const token = API.getToken();
      if (token) {
        try {
          const res = await API.getMe();
          this.user = res.user;
          this.updateUI();
          return true;
        } catch {
          API.setToken(null);
        }
      }

      // No valid session → show login
      this.showLogin();
      return false;
    } catch (err) {
      console.error('[Auth] Init error:', err);
      return true; // fail-open in local mode
    }
  },

  // ─── Login Page ───────────────────────────────────
  showLogin() {
    const mainContent = document.getElementById('mainContent');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const fabContainer = document.getElementById('fabContainer');

    if (sidebar) sidebar.style.display = 'none';
    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'none';

    if (mainContent) {
      mainContent.style.marginLeft = '0';
      mainContent.innerHTML = `
        <div class="login-page">
          <div class="login-card">
            <div class="login-logo">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h1 class="login-title">WealthPulse</h1>
            <p class="login-subtitle">Your personal portfolio tracker</p>
            <div class="login-divider"></div>

            <!-- Google renders its official button here -->
            <div id="googleButtonContainer" style="display:flex;justify-content:center;min-height:50px;align-items:center;"></div>

            <!-- Manual fallback button (shown if GSI render fails) -->
            <button id="googleFallbackBtn" class="google-signin-btn" onclick="Auth.signInWithPopup()" style="display:none;">
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              <span>Sign in with Google</span>
            </button>

            <p id="loginStatus" style="color:var(--text-muted);font-size:0.85rem;margin-top:12px;"></p>
            <p class="login-footer">Secure • Private • Free</p>
          </div>
        </div>
      `;
    }

    // Render the official Google Sign-In button
    this._renderGoogleButton();
  },

  // ─── Load Google Identity Services SDK ────────────
  loadGoogleScript() {
    return new Promise((resolve) => {
      if (this._gsiReady && window.google?.accounts) {
        resolve();
        return;
      }

      if (document.getElementById('google-gsi-script')) {
        const check = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(check);
            this._initGSI();
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 5000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this._initGSI();
        resolve();
      };
      script.onerror = () => {
        console.error('[Auth] Failed to load Google Identity Services');
        resolve();
      };
      document.head.appendChild(script);
    });
  },

  _initGSI() {
    if (!window.google?.accounts || !this.googleClientId) return;
    try {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response) => this.onGoogleResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this._gsiReady = true;
      console.log('[Auth] Google Identity Services initialized');
    } catch (err) {
      console.error('[Auth] GSI init error:', err);
    }
  },

  // ─── Render the Official Google Button ────────────
  _renderGoogleButton() {
    const container = document.getElementById('googleButtonContainer');
    const fallbackBtn = document.getElementById('googleFallbackBtn');
    const statusEl = document.getElementById('loginStatus');

    if (!container) return;

    if (window.google?.accounts?.id) {
      try {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
        console.log('[Auth] Google button rendered');
        return;
      } catch (err) {
        console.error('[Auth] renderButton failed:', err);
      }
    }

    // GSI not ready yet — wait and retry
    if (!this._gsiReady) {
      if (statusEl) statusEl.textContent = 'Loading Google Sign-In...';

      const retry = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(retry);
          this._initGSI();
          if (statusEl) statusEl.textContent = '';
          this._renderGoogleButton();
        }
      }, 300);

      // After 5 seconds, show manual fallback
      setTimeout(() => {
        clearInterval(retry);
        if (!container.querySelector('div[role="button"]') && !container.querySelector('iframe')) {
          if (statusEl) statusEl.textContent = '';
          if (fallbackBtn) fallbackBtn.style.display = 'inline-flex';
        }
      }, 5000);
    } else {
      // GSI loaded but render failed — show fallback
      if (fallbackBtn) fallbackBtn.style.display = 'inline-flex';
    }
  },

  // ─── Fallback: trigger One Tap or OAuth2 popup ────
  signInWithPopup() {
    if (!this.googleClientId) {
      alert('Google Sign-In not configured. Set GOOGLE_CLIENT_ID in .env');
      return;
    }

    if (window.google?.accounts?.id) {
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('[Auth] One Tap skipped, reason:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.());
          this._openOAuth2Popup();
        }
      });
    } else {
      this._openOAuth2Popup();
    }
  },

  _openOAuth2Popup() {
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'openid email profile';
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(this.googleClientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&nonce=${nonce}` +
      `&prompt=select_account`;

    const w = 500, h = 600;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const popup = window.open(url, 'GoogleSignIn', `width=${w},height=${h},left=${left},top=${top}`);

    if (!popup) {
      alert('Popup blocked! Please allow popups for this site.');
      return;
    }

    const pollTimer = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(pollTimer); return; }
        const popupUrl = popup.location.href;
        if (popupUrl.includes('/auth/google/callback')) {
          clearInterval(pollTimer);
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const idToken = params.get('id_token');
          popup.close();
          if (idToken) {
            this.onGoogleResponse({ credential: idToken });
          } else {
            const statusEl = document.getElementById('loginStatus');
            if (statusEl) statusEl.textContent = 'Sign-in cancelled or failed.';
          }
        }
      } catch {
        // Cross-origin while on Google domain — keep polling
      }
    }, 500);
  },

  // ─── Handle Google Credential ─────────────────────
  async onGoogleResponse(response) {
    const statusEl = document.getElementById('loginStatus');
    try {
      if (statusEl) statusEl.textContent = 'Signing you in...';
      const res = await API.googleSignIn(response.credential);
      if (res.success) {
        API.setToken(res.token);
        this.user = res.user;
        window.location.reload();
      } else {
        if (statusEl) statusEl.textContent = 'Sign-in failed. Please try again.';
      }
    } catch (err) {
      console.error('[Auth] Sign-in error:', err);
      if (statusEl) statusEl.textContent = 'Error: ' + err.message;
    }
  },

  // ─── Sign Out ─────────────────────────────────────
  async signOut() {
    // Clear token and user immediately for instant UI response
    API.setToken(null);
    this.user = null;
    if (window.google?.accounts) {
      try { google.accounts.id.disableAutoSelect(); } catch { }
    }
    // Show login immediately (no page reload)
    Charts.destroyAll();
    this.showLogin();
    // Fire-and-forget server signout
    try { await API.signOut(); } catch { /* ignore */ }
  },

  // ─── Delete Account ───────────────────────────────
  async deleteAccount() {
    const confirmed = confirm(
      '⚠️ DELETE ACCOUNT\n\n' +
      'This will permanently delete your account.\n' +
      'Your financial data will remain but your login will be removed.\n\n' +
      'Are you sure?'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('This action CANNOT be undone. Delete your account?');
    if (!doubleConfirm) return;

    try {
      await API.deleteAccount();
      API.setToken(null);
      this.user = null;
      alert('Account deleted successfully.');
      window.location.reload();
    } catch (err) {
      alert('Failed to delete account: ' + err.message);
    }
  },

  // ─── Topbar Avatar & Dropdown ─────────────────────
  updateUI() {
    const topbarActions = document.querySelector('.topbar-actions');
    if (!topbarActions || !this.user) return;

    const existing = document.getElementById('authMenu');
    if (existing) existing.remove();

    const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const name = esc(this.user.name);
    const email = esc(this.user.email);
    const initial = (this.user.name || 'U')[0].toUpperCase();

    const authHtml = `
      <div class="auth-menu" id="authMenu">
        <button class="auth-avatar-btn" onclick="Auth.toggleMenu()" title="${name}">
          ${this.user.picture
            ? `<img src="${this.user.picture}" alt="${name}" class="auth-avatar" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="auth-avatar-fallback" style="display:none">${initial}</span>`
            : `<span class="auth-avatar-fallback">${initial}</span>`
          }
        </button>
        <div class="auth-dropdown" id="authDropdown">
          <div class="auth-dropdown-header">
            <strong>${name}</strong>
            <small>${email}</small>
          </div>
          <div class="auth-dropdown-divider"></div>
          <button class="auth-dropdown-item" onclick="Auth.signOut()">
            🚪 Sign Out
          </button>
          <button class="auth-dropdown-item auth-dropdown-danger" onclick="Auth.deleteAccount()">
            🗑️ Delete Account
          </button>
        </div>
      </div>
    `;
    topbarActions.insertAdjacentHTML('beforeend', authHtml);
  },

  toggleMenu() {
    const dropdown = document.getElementById('authDropdown');
    if (dropdown) dropdown.classList.toggle('open');

    const close = (e) => {
      if (!e.target.closest('#authMenu')) {
        dropdown?.classList.remove('open');
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
  },
};
