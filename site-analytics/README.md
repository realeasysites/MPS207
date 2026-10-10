# Site Analytics (Real Easy Sites module)

Page views, visitors, traffic sources, devices and **call/text taps**, shown at the top of the client's `/admin` dashboard next to their leads.

- **No cookies, no IPs stored, no cookie banner needed.** Each visitor gets an anonymous daily ID (hash of IP + browser + date + a server secret). The same person counts once per day.
- **Real people only.** Bots, crawlers, link previews (Facebook, iMessage…), headless browsers and the owner's own logged-in visits are skipped. The tracker only runs in a real browser, so most bots never load it at all.
- **No outside service.** Data lives in the site's own SQLite file, in four small `sa_*` tables. Raw rows are kept 400 days.
- **Zero new npm packages.** It uses express + better-sqlite3, which every TBLC site already has.

## Add it to a site (about 5 minutes)

1. **Copy** the `site-analytics/` folder into the project root (next to `server.js`).

2. **server.js**: mount it *before* `app.use('/api', …)` and the static files:

   ```js
   const { requireAdmin, isAuthed } = require('./lib/auth');   // add to the existing auth import
   const mountSiteAnalytics = require('./site-analytics');

   mountSiteAnalytics(app, { db, isAuthed, requireAdmin, timezone: 'America/New_York' });
   ```

   `db` is the site's better-sqlite3 instance from `./db`. If a site's auth file names these differently, pass whatever checks the admin cookie (`isAuthed(req) → true/false`) and the middleware that returns 401 when signed out.

3. **Every public page**: add one line before `</body>`:

   ```html
   <script src="/sa/t.js" defer></script>
   ```

   Skip iframe-only pages (like `crete-quote.html`) and the 404 page.

4. **Admin dashboard** (`dashboard.html`):

   ```html
   <link rel="stylesheet" href="/sa/admin/panel.css">          <!-- in <head> -->
   <section id="site-analytics" aria-label="Website traffic"></section>   <!-- top of <main> -->
   <script src="/sa/admin/panel.js"></script>                  <!-- before </body> -->
   ```

   The panel picks up the dashboard's `--gold`, `--text`, `--muted`, `--line` and `--cream` CSS variables, so it matches each client's admin colors automatically.

5. **Make sure the site has a persistent disk** (see below), then push.

### Leads table

"Form leads" and "Contact rate" count rows in the template's `leads` table (`created_at`). If a site stores leads elsewhere (for example `quotes` or `bookings`), pass a counter:

```js
mountSiteAnalytics(app, {
  db, isAuthed, requireAdmin,
  countLeads: (fromUtc, toUtc) =>
    db.prepare('SELECT COUNT(*) n FROM quotes WHERE created_at >= ? AND created_at < ?').get(fromUtc, toUtc).n
});
```

## ⚠️ Persistent disk is required

Render's normal file system is wiped on every deploy, which resets the SQLite database. That wipes the traffic history **and the leads**. Each site needs:

- Render → service → **Disks** → add a 1 GB disk mounted at `/var/data` (about $0.25/month; needs a paid instance)
- Environment → `DB_PATH=/var/data/<site>.sqlite`

Export the leads CSV from `/admin` **before** adding the disk. Adding it triggers a redeploy, and whatever is in the old database is gone after that.

## What the dashboard shows

| Tile / list | Meaning |
|---|---|
| Visitors | Unique people per day, added up over the range |
| Page views | Every page load |
| Call & text taps | Taps on `tel:` and `sms:` links. These are intent; not every tap becomes a completed call |
| Form leads | Contact-form submissions in the range |
| Contact rate | (form leads + call taps + text taps) ÷ visitors |
| Where visitors came from | Source of the first page in each visit: Google, Facebook, Instagram, Nextdoor, Direct… |
| Most viewed pages | Page loads by page |
| What they browsed on | Phone / computer / tablet |
| Clicked through to | Taps out to Facebook, Instagram, Google reviews, etc. |

Ranges: 7 / 30 / 90 days, each compared with the period before it. Days before tracking started are shaded as "Not tracked yet".

## Tips for clients

- **Google Business Profile**: set the profile's website link to `https://www.theirsite.com/?utm_source=gbp`. Those visits then show as "Google Business Profile" instead of blending into "Google".
- **Flyers, truck wraps and QR codes**: link to `?utm_source=qr` or `?utm_source=truck` so print traffic gets its own line.
- **Don't count your own phone**: open the site once with `#notrack` on the end (e.g. `https://www.site.com/#notrack`). That browser stops being counted; `#track` turns it back on. Being logged into `/admin` already excludes you.

## Files

```
site-analytics/
  index.js              mount(): /sa/t.js, /sa/collect, /sa/admin/*, GET /api/admin/analytics
  lib/store.js          SQLite tables, anonymous visitor IDs, stats queries (time-zone aware)
  lib/classify.js       bot filter, device type, traffic-source names
  public/t.js           the tracker that goes on public pages (~1.5 KB)
  public/admin/panel.*  dashboard panel (no chart library)
```

Endpoints: `POST /sa/collect` always answers 204 and never throws, so tracking can't break a page. It's rate-limited to 120 hits per minute per IP. `GET /api/admin/analytics?days=7|30|90|365` requires an admin login.
