require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const quoteRoutes = require('./routes/quote');
const adminRoutes = require('./routes/admin');
const db = require('./db/init');
const { isAuthed, requireAdminApi } = require('./lib/auth');
const mountSiteAnalytics = require('./site-analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Render terminates HTTPS at its proxy; trust it so secure cookies work.
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// A guessable session secret would let anyone forge an admin session, and this
// repo is public. If SESSION_SECRET isn't set, use a random one per boot (admin
// just has to log in again after a restart).
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[session] SESSION_SECRET not set — using a random secret for this run.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.RENDER), // Render sets RENDER=true; keeps local dev on http working
  },
}));

// Website traffic: page views, visitors, sources and call/text taps, shown at the
// top of the /admin dashboard. Cookieless; skips bots and Keith's own admin visits.
mountSiteAnalytics(app, { db, isAuthed, requireAdmin: requireAdminApi, timezone: 'America/New_York' });

// Static site (public/index.html, /about -> about.html, etc.)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use(quoteRoutes);
app.use(adminRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`MPS207 site running on http://localhost:${PORT}`);
});
