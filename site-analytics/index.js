'use strict';

// Site Analytics: drop-in page-view + call-tap tracking for Real Easy Sites (TBLC template).
//
// In the site's server.js, BEFORE app.use('/api', ...) and the static files:
//
//   require('./site-analytics')(app, {
//     db,                      // the site's better-sqlite3 instance
//     isAuthed,                // from lib/auth: the owner's own visits aren't counted
//     requireAdmin,            // from lib/auth: protects the stats API
//     timezone: 'America/New_York'
//   });
//
// Then add  <script src="/sa/t.js" defer></script>  to every public page,
// and the panel to the admin dashboard (see README.md).

const path = require('path');
const express = require('express');
const { createStore } = require('./lib/store');
const { isBot, device, source } = require('./lib/classify');

const EVENT_TYPES = ['call', 'text', 'email', 'directions', 'social'];
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

module.exports = function mountSiteAnalytics(app, opts = {}) {
  if (!opts.db) throw new Error('site-analytics: pass { db } (the site\'s better-sqlite3 instance)');
  const store = createStore(opts.db, opts);
  const isAuthed = opts.isAuthed || (() => false);
  const requireAdmin = opts.requireAdmin;
  if (!requireAdmin) throw new Error('site-analytics: pass { requireAdmin } so the stats API is protected');

  // Contact-form leads in a time window (UTC 'YYYY-MM-DD HH:MM:SS' strings).
  // Default: the template's `leads` table. Override with opts.countLeads(fromUtc, toUtc).
  const countLeads = opts.countLeads || (() => {
    let stmt;
    try { stmt = opts.db.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at >= ? AND created_at < ?'); } catch (e) { return () => 0; }
    return (from, to) => stmt.get(from, to).n;
  })();

  // Simple per-IP flood guard for the beacon (silently drops the excess).
  const hits = new Map();
  setInterval(() => hits.clear(), 60000).unref();
  const flooded = (ip) => {
    const n = (hits.get(ip) || 0) + 1;
    hits.set(ip, n);
    return n > 120;
  };

  // Tracker script.
  app.get('/sa/t.js', (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, 'public', 't.js'));
  });
  // Dashboard panel assets (harmless to serve publicly: they show nothing without a login).
  app.use('/sa/admin', express.static(path.join(__dirname, 'public', 'admin'), { maxAge: '1h' }));

  // Beacon endpoint. Always answers 204 so it never shows errors to visitors.
  app.post('/sa/collect', express.text({ type: '*/*', limit: '2kb' }), (req, res) => {
    res.status(204).end();
    try {
      const ua = String(req.headers['user-agent'] || '');
      if (isBot(ua) || isAuthed(req) || flooded(req.ip)) return;
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      let p = clip(b.p, 200).split(/[?#]/)[0] || '/';
      if (!p.startsWith('/')) return;
      p = p.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1');
      const base = { ip: req.ip, ua, path: p };

      if (b.t === 'v') {
        const ownHost = String(req.hostname || '').toLowerCase().replace(/^www\./, '');
        store.recordView({
          ...base,
          entry: !!b.e,
          device: device(ua),
          source: source({ referrer: clip(b.r, 400), utm: clip(b.u, 60), gclid: !!b.g, fbclid: !!b.f, ownHost, ua })
        });
      } else if (EVENT_TYPES.includes(b.t)) {
        store.recordEvent({ ...base, type: b.t, label: clip(b.l, 80) || null });
      }
    } catch (e) { /* never let tracking break anything */ }
  });

  // Stats for the admin panel.
  app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.set('Cache-Control', 'no-store');
    res.json(store.stats(days, countLeads));
  });

  return store;
};
