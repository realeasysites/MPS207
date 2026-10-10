'use strict';

// Bots, crawlers, link previewers, uptime pingers and scripted browsers.
const BOT_RE = /bot|crawl|spider|slurp|scrap|fetch|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|skype|python|curl|wget|axios|node-fetch|go-http|java\/|okhttp|httpclient|phantom|selenium|puppeteer|playwright|render\/health/i;

function isBot(ua) {
  return !ua || ua.length < 20 || BOT_RE.test(ua);
}

function device(ua = '') {
  if (/iPad|Tablet|Nexus (7|9|10)|SM-T|Kindle|Silk/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Referrer host -> friendly source name. Order matters (first match wins).
const SOURCES = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yahoo\./, 'Yahoo'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)nextdoor\.com$/, 'Nextdoor'],
  [/(^|\.)yelp\.com$/, 'Yelp'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X / Twitter'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)pinterest\./, 'Pinterest'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)(angi\.com|angieslist\.com|homeadvisor\.com|thumbtack\.com|houzz\.com)$/, 'Home-service sites'],
  [/(^|\.)(bbb\.org)$/, 'BBB'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com)$/, 'AI assistants']
];

const UTM_NAMES = {
  google: 'Google', fb: 'Facebook', facebook: 'Facebook', ig: 'Instagram', instagram: 'Instagram',
  tiktok: 'TikTok', youtube: 'YouTube', nextdoor: 'Nextdoor', yelp: 'Yelp', bing: 'Bing',
  email: 'Email', newsletter: 'Email', qr: 'QR code', flyer: 'Flyer / print', print: 'Flyer / print',
  card: 'Business card', truck: 'Truck / yard sign', sign: 'Truck / yard sign', gbp: 'Google Business Profile'
};

function title(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
}

/**
 * Work out where a visit came from.
 * Priority: utm_source > ad click ids > referrer host > in-app browser > Direct.
 */
function source({ referrer, utm, gclid, fbclid, ownHost, ua = '' }) {
  if (utm) {
    const key = String(utm).toLowerCase().trim();
    if (key === 'gbp' || key === 'google_business' || key === 'gmb') return 'Google Business Profile';
    return UTM_NAMES[key] || title(key);
  }
  if (gclid) return 'Google Ads';
  let host = '';
  try { host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : ''; } catch (e) { host = ''; }
  if (host && ownHost && (host === ownHost || host.endsWith('.' + ownHost))) host = '';
  if (host) {
    for (const [re, name] of SOURCES) if (re.test(host)) return name;
    return host.slice(0, 60);
  }
  if (fbclid) return 'Facebook';
  // Facebook / Instagram in-app browsers often send no referrer.
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  return 'Direct';
}

module.exports = { isBot, device, source };
