/**
 * WealthPulse — Authentication Middleware
 * Google OAuth 2.0 + JWT session management
 */
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const TOKEN_EXPIRY = '7d';

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/**
 * Verify Google ID token and return user payload
 */
async function verifyGoogleToken(idToken) {
  if (!googleClient) throw new Error('Google OAuth not configured');
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || '',
  };
}

/**
 * Generate a JWT for the session
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, googleId: user.google_id, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Express middleware: require authentication
 * Checks Authorization header (Bearer <token>) or wp_token cookie
 */
function requireAuth(req, res, next) {
  // If auth is not configured (no GOOGLE_CLIENT_ID), skip auth
  if (!GOOGLE_CLIENT_ID) {
    req.user = { id: 'default', email: 'local@wealthpulse', name: 'Local User' };
    return next();
  }

  let token = null;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Check cookie fallback
  if (!token && req.cookies?.wp_token) {
    token = req.cookies.wp_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session. Please sign in again.' });
  }
}

/**
 * Optional auth: sets req.user if token present, but doesn't block
 */
function optionalAuth(req, res, next) {
  if (!GOOGLE_CLIENT_ID) {
    req.user = { id: 'default', email: 'local@wealthpulse', name: 'Local User' };
    return next();
  }

  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token && req.cookies?.wp_token) {
    token = req.cookies.wp_token;
  }

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch { /* ignore */ }
  }
  next();
}

module.exports = {
  verifyGoogleToken,
  generateToken,
  requireAuth,
  optionalAuth,
  GOOGLE_CLIENT_ID,
  JWT_SECRET,
};
