const crypto = require('crypto');

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
}

// True when the request comes from Keith's logged-in admin session
// (used so his own visits to the site aren't counted as traffic).
function isAuthed(req) {
  return Boolean(req.session && req.session.isAdmin);
}

// For JSON APIs (like the traffic stats): answer 401 instead of redirecting to the login page.
function requireAdminApi(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: 'Not signed in' });
}

// Constant-time string compare so login checks don't leak timing information.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// No built-in fallback password: this repo is public, so any default here would
// be public too. Until ADMIN_PASSWORD is set in Render (8+ characters), the
// admin dashboard simply refuses every login.
const MIN_PASSWORD_LENGTH = 8;
const adminConfigured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= MIN_PASSWORD_LENGTH);
if (!adminConfigured) {
  console.warn('[auth] ADMIN_PASSWORD is not set (or shorter than 8 characters) — admin login is disabled until it is set in Render.');
}

function checkCredentials(username, password) {
  if (!adminConfigured) return false;
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  return safeEqual(username, validUser) && safeEqual(password, process.env.ADMIN_PASSWORD);
}

module.exports = { requireAdmin, requireAdminApi, isAuthed, checkCredentials, adminConfigured };
