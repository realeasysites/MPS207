'use strict';

const crypto = require('crypto');

const DAY_MS = 86400000;

/** 'YYYY-MM-DD' for a timestamp in the business's time zone. */
function dayKey(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** UTC ms of local midnight that starts the given 'YYYY-MM-DD' in tz. */
function localMidnight(day, tz) {
  const [y, m, d] = day.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    guess -= asUtc - Date.UTC(y, m - 1, d);
  }
  return guess;
}

/** SQLite datetime('now')-style UTC string, for comparing against leads.created_at. */
function sqlUtc(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function createStore(db, opts = {}) {
  const tz = opts.timezone || 'America/New_York';
  const retentionDays = opts.retentionDays || 400;

  db.exec(`
    CREATE TABLE IF NOT EXISTS sa_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sa_views (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts       INTEGER NOT NULL,
      day      TEXT NOT NULL,
      path     TEXT NOT NULL,
      visitor  TEXT NOT NULL,
      entry    INTEGER NOT NULL DEFAULT 0,
      source   TEXT,
      device   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sa_views_ts ON sa_views(ts);
    CREATE TABLE IF NOT EXISTS sa_events (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts       INTEGER NOT NULL,
      day      TEXT NOT NULL,
      type     TEXT NOT NULL,
      label    TEXT,
      path     TEXT,
      visitor  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sa_events_ts ON sa_events(ts);
  `);

  const getMeta = db.prepare('SELECT v FROM sa_meta WHERE k = ?');
  const setMeta = db.prepare('INSERT OR IGNORE INTO sa_meta (k, v) VALUES (?, ?)');
  setMeta.run('secret', crypto.randomBytes(32).toString('hex'));
  setMeta.run('started', String(Date.now()));
  const secret = getMeta.get('secret').v;
  const started = Number(getMeta.get('started').v);

  const ins = {
    view: db.prepare('INSERT INTO sa_views (ts, day, path, visitor, entry, source, device) VALUES (@ts, @day, @path, @visitor, @entry, @source, @device)'),
    event: db.prepare('INSERT INTO sa_events (ts, day, type, label, path, visitor) VALUES (@ts, @day, @type, @label, @path, @visitor)')
  };

  /**
   * Anonymous visitor id: a hash of IP + browser + today's date + a server secret.
   * No cookies and no IPs are stored; the same person counts once per day.
   */
  function visitorId(ip, ua, day) {
    return crypto.createHash('sha256').update(`${secret}|${day}|${ip}|${ua}`).digest('hex').slice(0, 20);
  }

  function recordView({ ip, ua, path, entry, source, device }) {
    const ts = Date.now();
    const day = dayKey(ts, tz);
    ins.view.run({ ts, day, path, visitor: visitorId(ip, ua, day), entry: entry ? 1 : 0, source: entry ? source : null, device });
  }

  function recordEvent({ ip, ua, type, label, path }) {
    const ts = Date.now();
    const day = dayKey(ts, tz);
    ins.event.run({ ts, day, type, label, path, visitor: visitorId(ip, ua, day) });
  }

  function purge() {
    const cutoff = Date.now() - retentionDays * DAY_MS;
    db.prepare('DELETE FROM sa_views WHERE ts < ?').run(cutoff);
    db.prepare('DELETE FROM sa_events WHERE ts < ?').run(cutoff);
  }
  purge();
  setInterval(purge, DAY_MS).unref();

  const q = {
    totals: db.prepare(`SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors, COALESCE(SUM(entry), 0) AS visits
                        FROM sa_views WHERE ts >= ? AND ts < ?`),
    events: db.prepare('SELECT type, COUNT(*) AS n FROM sa_events WHERE ts >= ? AND ts < ? GROUP BY type'),
    daily: db.prepare(`SELECT day, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors
                       FROM sa_views WHERE ts >= ? AND ts < ? GROUP BY day`),
    dailyEvents: db.prepare(`SELECT day, COUNT(*) AS n FROM sa_events WHERE ts >= ? AND ts < ? AND type IN ('call','text') GROUP BY day`),
    pages: db.prepare(`SELECT path, COUNT(*) AS views FROM sa_views WHERE ts >= ? AND ts < ?
                       GROUP BY path ORDER BY views DESC LIMIT 8`),
    sources: db.prepare(`SELECT source, COUNT(*) AS visits FROM sa_views WHERE ts >= ? AND ts < ? AND entry = 1
                         GROUP BY source ORDER BY visits DESC LIMIT 8`),
    devices: db.prepare(`SELECT device, COUNT(DISTINCT visitor) AS n FROM sa_views WHERE ts >= ? AND ts < ? GROUP BY device`),
    social: db.prepare(`SELECT label, COUNT(*) AS n FROM sa_events WHERE ts >= ? AND ts < ? AND type = 'social'
                        GROUP BY label ORDER BY n DESC LIMIT 5`)
  };

  function range(days) {
    const today = dayKey(Date.now(), tz);
    const start = localMidnight(dayKey(localMidnight(today, tz) - (days - 1) * DAY_MS + DAY_MS / 2, tz), tz);
    const end = Date.now() + 1;
    const prevStart = localMidnight(dayKey(start - days * DAY_MS + DAY_MS / 2, tz), tz);
    return { start, end, prevStart, prevEnd: start, today };
  }

  function sums(from, to, countLeads) {
    const t = q.totals.get(from, to);
    const ev = Object.fromEntries(q.events.all(from, to).map((r) => [r.type, r.n]));
    // leads.created_at has 1-second resolution, so round the window end up to include this second.
    const leads = countLeads(sqlUtc(from), sqlUtc(Math.ceil(to / 1000) * 1000 + 1000));
    const calls = ev.call || 0;
    const texts = ev.text || 0;
    const reached = leads + calls + texts;
    return {
      visitors: t.visitors, pageviews: t.pageviews, visits: t.visits,
      calls, texts, emails: ev.email || 0, directions: ev.directions || 0, social: ev.social || 0,
      leads,
      contactRate: t.visitors ? Math.min(1, reached / t.visitors) : 0
    };
  }

  /** Everything the dashboard panel needs for the last `days` days. */
  function stats(days, countLeads) {
    const w = range(days);
    const current = sums(w.start, w.end, countLeads);
    const previous = sums(w.prevStart, w.prevEnd, countLeads);

    const byDay = Object.fromEntries(q.daily.all(w.start, w.end).map((r) => [r.day, r]));
    const evByDay = Object.fromEntries(q.dailyEvents.all(w.start, w.end).map((r) => [r.day, r.n]));
    const startedDay = dayKey(started, tz);
    const daily = [];
    for (let i = 0; i < days; i++) {
      const day = dayKey(w.start + i * DAY_MS + DAY_MS / 2, tz);
      const r = byDay[day] || {};
      daily.push({ day, visitors: r.visitors || 0, pageviews: r.pageviews || 0, taps: evByDay[day] || 0, tracked: day >= startedDay });
    }

    const devs = { mobile: 0, desktop: 0, tablet: 0 };
    for (const r of q.devices.all(w.start, w.end)) if (r.device in devs) devs[r.device] = r.n;

    return {
      days, timezone: tz, trackingSince: started, previousAvailable: started <= w.prevStart,
      current, previous, daily,
      pages: q.pages.all(w.start, w.end),
      sources: q.sources.all(w.start, w.end),
      devices: devs,
      social: q.social.all(w.start, w.end)
    };
  }

  return { recordView, recordEvent, stats, purge, _dayKey: (ms) => dayKey(ms, tz) };
}

module.exports = { createStore, dayKey, localMidnight };
