/**
 * WealthPulse — Auth Routes
 * Google Sign-In, session management, account deletion
 */
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { verifyGoogleToken, generateToken, requireAuth, GOOGLE_CLIENT_ID } = require('../middleware/auth');

// ─── Auth status ──────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    success: true,
    authEnabled: !!GOOGLE_CLIENT_ID,
    googleClientId: GOOGLE_CLIENT_ID || null,
  });
});

// ─── Google Sign-In ───────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Missing Google credential' });
    }

    // Verify the Google ID token
    const googleUser = await verifyGoogleToken(credential);

    // Find or create user in DB
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleUser.googleId);

    if (!user) {
      // New user — create account
      const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      db.prepare(`
        INSERT INTO users (id, google_id, email, name, picture, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, googleUser.googleId, googleUser.email, googleUser.name, googleUser.picture);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      console.log(`[Auth] ✅ New user registered: ${googleUser.email}`);
    } else {
      // Existing user — update last login & picture
      db.prepare(`UPDATE users SET last_login = datetime('now'), picture = ?, name = ? WHERE id = ?`)
        .run(googleUser.picture, googleUser.name, user.id);
      console.log(`[Auth] ✅ User signed in: ${googleUser.email}`);
    }

    // Generate JWT
    const token = generateToken(user);

    // Set cookie
    res.cookie('wp_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error('[Auth] Google sign-in error:', err.message);
    res.status(401).json({ success: false, error: 'Google sign-in failed: ' + err.message });
  }
});

// ─── Get current user profile ─────────────────────
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, picture, created_at, last_login FROM users WHERE id = ?')
      .get(req.user.userId || 'default');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Sign out ─────────────────────────────────────
router.post('/signout', (req, res) => {
  res.clearCookie('wp_token');
  res.json({ success: true, message: 'Signed out' });
});

// ─── Delete account ───────────────────────────────
router.delete('/account', requireAuth, (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId || userId === 'default') {
      return res.status(400).json({ success: false, error: 'Cannot delete default local account' });
    }

    // Delete user
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Clear session
    res.clearCookie('wp_token');

    console.log(`[Auth] 🗑️ Account deleted: ${req.user.email}`);
    res.json({ success: true, message: 'Account deleted successfully. All personal data has been removed.' });
  } catch (err) {
    console.error('[Auth] Account deletion error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
