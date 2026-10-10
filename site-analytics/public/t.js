/* Real Easy Sites: tiny cookieless page-view + call-tap counter. */
(function () {
  'use strict';
  var w = window, d = document, n = navigator, ls, ss;
  try { ls = w.localStorage; ss = w.sessionStorage; } catch (e) { /* storage blocked */ }

  // Visit any page with #notrack once to stop counting this browser (#track turns it back on).
  try {
    if (location.hash === '#notrack') ls.setItem('sa_off', '1');
    if (location.hash === '#track') ls.removeItem('sa_off');
    if (ls && ls.getItem('sa_off')) return;
  } catch (e) {}
  // Skip automated browsers and local testing (add ?sa_test to a URL to test locally).
  if (!/[?&]sa_test/.test(location.search) && (n.webdriver || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname))) return;

  function send(data) {
    data.p = location.pathname;
    var body = JSON.stringify(data);
    if (n.sendBeacon && n.sendBeacon('/sa/collect', body)) return;
    try { fetch('/sa/collect', { method: 'POST', body: body, keepalive: true, credentials: 'same-origin' }); } catch (e) {}
  }

  // Page view. The first page of a browsing session carries the traffic source.
  var entry = true;
  try { entry = !ss.getItem('sa_s'); ss.setItem('sa_s', '1'); } catch (e) {}
  var qs = new URLSearchParams(location.search);
  var view = { t: 'v', e: entry ? 1 : 0 };
  if (entry) {
    view.r = d.referrer || '';
    view.u = qs.get('utm_source') || qs.get('ref') || '';
    if (qs.get('gclid') || qs.get('gbraid') || qs.get('wbraid')) view.g = 1;
    if (qs.get('fbclid')) view.f = 1;
  }
  send(view);

  // Taps on call / text / email / directions / social links.
  var SOCIAL = { 'facebook.com': 'facebook', 'm.facebook.com': 'facebook', 'fb.com': 'facebook', 'fb.me': 'facebook', 'm.me': 'messenger',
    'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'youtu.be': 'youtube', 'nextdoor.com': 'nextdoor',
    'yelp.com': 'yelp', 'linkedin.com': 'linkedin', 'pinterest.com': 'pinterest', 'x.com': 'x', 'twitter.com': 'x', 'g.page': 'google reviews' };
  d.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '', t = null, l = '';
    if (/^tel:/i.test(h)) { t = 'call'; l = h.slice(4); }
    else if (/^sms:/i.test(h)) { t = 'text'; l = h.slice(4).split('?')[0]; }
    else if (/^mailto:/i.test(h)) { t = 'email'; l = h.slice(7).split('?')[0]; }
    else if (/google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com/i.test(h)) { t = 'directions'; }
    else if (/^https?:/i.test(h)) {
      var host = (a.hostname || '').toLowerCase().replace(/^www\./, '');
      if (SOCIAL[host]) { t = 'social'; l = SOCIAL[host]; }
      else if (/(^|\.)google\.[a-z.]+$/.test(host) && /review|lrd=/i.test(h)) { t = 'social'; l = 'google reviews'; }
    }
    if (t) send({ t: t, l: l });
  }, true);
})();
