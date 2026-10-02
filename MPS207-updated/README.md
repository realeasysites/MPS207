# MPS207 — McGillivary Plumbing Services Website

Full rebuild of mps207.com: Node/Express + SQLite backend with a lead-capture
form, email notifications, and a password-protected admin dashboard — plus a
6-page frontend that leans heavily into Keith's social following (30K+ IG,
22K+ TikTok).

## Pages
- `/` — Home (hero, social proof stats, services, IG reels, testimonial, about teaser)
- `/services` — Full service list
- `/heat-pump-water-heaters` — Dedicated Rheem/Efficiency Maine rebate funnel page
- `/gallery` — Heavy social page: embedded IG reels, stats, links to every platform
- `/about` — Keith's story
- `/contact` — Quote request form + map + contact info
- `/admin` — Password-protected leads dashboard

## Local Setup
```bash
npm install
cp .env.example .env   # then fill in real values
npm start
```
Visit http://localhost:3000. Admin dashboard: http://localhost:3000/admin
(login with the ADMIN_USERNAME / ADMIN_PASSWORD you set in `.env`).

## Required Environment Variables (see `.env.example`)
- `SESSION_SECRET` — random string, protects admin login sessions
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin dashboard login
- `NOTIFY_EMAIL` — inbox that gets emailed on every new quote request
  (currently defaults to mcgillivary77@gmail.com in the example — **confirm
  with Keith which inbox he actually wants leads sent to**, same as the other
  client builds)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` —
  sending email account. If using Gmail, `SMTP_USER`/`SMTP_PASS` must be a
  Gmail **App Password**, not the real account password.

If SMTP isn't configured, the form still works and every lead is still saved
to the SQLite database — it just skips sending the email notification (and
logs a warning) until SMTP is set up.

## Deploying (Render, same pattern as the other client sites)
1. Push this folder to a new GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install` · Start command: `npm start`
4. **Set Node to 20.x** — either Render auto-detects the committed
   `.node-version` file, or set the `NODE_VERSION` env var to `20.11.0`
   manually. This project uses `better-sqlite3`, which has no prebuilt
   binary for newer Node versions — same issue hit on the TBLC, Laundry
   Lounge, Barry Larry's, and Dunn Lawn builds.
5. Add all the environment variables from `.env.example` in Render's
   dashboard (Environment tab).
6. **Add a persistent disk** mounted at `/db` (or wherever `db/mps207.db`
   ends up) if you want lead data to survive redeploys — Render's default
   filesystem is ephemeral. Alternatively, swap SQLite for a managed
   Postgres later if lead volume grows.

## Updating Photos / Reels Later
- Photos live in `public/images/`. Swap the file and keep the same filename,
  or update the `<img src>` references across the HTML pages.
- Instagram Reels are embedded via Instagram's official oEmbed format
  (`<blockquote class="instagram-media" data-instgrm-permalink="...">`).
  To swap a reel: grab a new post URL from instagram.com/mps_207/reel/<ID>/
  and paste it into `data-instgrm-permalink` on the home and gallery pages.
  No script changes needed.

## Open Items / To Confirm With Keith Before Launch
- [ ] Which inbox should `NOTIFY_EMAIL` actually point to?
- [ ] Real Gmail App Password (or other SMTP provider) for sending mail
- [ ] Admin dashboard password (change from the placeholder before launch)
- [ ] Whether he wants "MPS SWAG" merch / Amazon storefront pulled onto the
      site itself, or left on Linktree (per the research brief — don't build
      this speculatively)
- [ ] Whether the quote form should instead post into his existing **Jobber**
      account (go.getjobber.com/keithmcgillivary) instead of/alongside this
      database, so leads land in the tool he already uses day-to-day
